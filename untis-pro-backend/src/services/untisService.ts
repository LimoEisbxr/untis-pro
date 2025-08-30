import { WebUntis } from 'webuntis';
import { prisma } from '../store/prisma.js';
import { decryptSecret } from '../server/crypto.js';
import { UNTIS_DEFAULT_SCHOOL, UNTIS_HOST } from '../server/config.js';
import { AppError } from '../server/errors.js';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Timetable caching strategy
// ---------------------------------------------------------------------------
// Goals:
// 1. Avoid hitting WebUntis if we fetched the SAME week in the last 5 minutes.
// 2. Prefetch previous + next week (fire & forget) after a cache miss fetch.
// 3. Periodically prune old timetable cache rows to keep table small.
//    - Remove rows older than MAX_AGE_DAYS
//    - For a (userId, rangeStart, rangeEnd) keep only the most recent MAX_HISTORY_PER_RANGE rows
// 4. Keep implementation lightweight: no extra tables; in‑memory throttle for cleanup.

const WEEK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_AGE_DAYS = 45; // Hard limit for any cached timetable
const MAX_HISTORY_PER_RANGE = 2; // Keep at most 2 historical copies per week
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // Run pruning at most every 6h per process

let lastCleanupRun = 0; // In‑memory marker; acceptable for single process / ephemeral scaling

function startOfDay(d: Date) {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    return nd;
}

function endOfDay(d: Date) {
    const nd = new Date(d);
    nd.setHours(23, 59, 59, 999);
    return nd;
}

function startOfISOWeek(date: Date) {
    const d = startOfDay(date);
    // ISO week starts Monday (1); JS Sunday = 0
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    d.setDate(d.getDate() + diff);
    return d;
}

function endOfISOWeek(date: Date) {
    const start = startOfISOWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return endOfDay(end);
}

function normalizeRange(start?: string, end?: string) {
    if (!start || !end) return { normStart: undefined, normEnd: undefined };
    // Treat ranges spanning a full week the same by snapping to ISO week
    const sd = new Date(start);
    const ed = new Date(end);
    // If the provided range length >= 5 days we assume week intentions and snap
    const spanMs = ed.getTime() - sd.getTime();
    if (spanMs >= 5 * 24 * 60 * 60 * 1000) {
        return { normStart: startOfISOWeek(sd), normEnd: endOfISOWeek(sd) };
    }
    // Otherwise just normalize to day bounds
    return { normStart: startOfDay(sd), normEnd: endOfDay(ed) };
}

async function pruneOldTimetables() {
    const now = Date.now();
    if (now - lastCleanupRun < CLEANUP_INTERVAL_MS) return; // throttle
    lastCleanupRun = now;
    const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    try {
        // Delete very old rows
        await prisma.timetable.deleteMany({
            where: { createdAt: { lt: cutoff } },
        });

        // For each (ownerId, rangeStart, rangeEnd) keep only newest MAX_HISTORY_PER_RANGE
        // This is a bit heavy to do naively; limit to recent owners touched (lightweight): we pull ids via raw query.
        const rows: Array<{
            ownerId: string;
            rangeStart: Date | null;
            rangeEnd: Date | null;
        }> = await (prisma as any).$queryRawUnsafe(
            `SELECT DISTINCT "ownerId", "rangeStart", "rangeEnd" FROM "Timetable" WHERE "rangeStart" IS NOT NULL AND "rangeEnd" IS NOT NULL`
        );
        for (const r of rows) {
            const keep = await prisma.timetable.findMany({
                where: {
                    ownerId: r.ownerId,
                    rangeStart: r.rangeStart,
                    rangeEnd: r.rangeEnd,
                },
                orderBy: { createdAt: 'desc' },
                skip: 0,
                take: MAX_HISTORY_PER_RANGE,
            });
            const keepIds = new Set(keep.map((k: any) => k.id));
            await prisma.timetable.deleteMany({
                where: {
                    ownerId: r.ownerId,
                    rangeStart: r.rangeStart,
                    rangeEnd: r.rangeEnd,
                    NOT: { id: { in: Array.from(keepIds) } },
                },
            });
        }
    } catch (e) {
        console.warn('[timetable][cleanup] failed', e);
    }
}

async function getCachedRange(ownerId: string, start: Date, end: Date) {
    const since = new Date(Date.now() - WEEK_CACHE_TTL_MS);
    return prisma.timetable.findFirst({
        where: {
            ownerId,
            rangeStart: start,
            rangeEnd: end,
            createdAt: { gt: since },
        },
        orderBy: { createdAt: 'desc' },
    });
}

async function fetchAndStoreUntis(args: {
    target: any;
    sd?: Date | undefined;
    ed?: Date | undefined;
}) {
    const { target, sd, ed } = args;
    // Fetch fresh from WebUntis
    const school = UNTIS_DEFAULT_SCHOOL;
    const host = toHost();
    console.debug('[timetable] using Untis', {
        school,
        host,
        username: target.username,
    });
    if (!target.untisSecretCiphertext || !target.untisSecretNonce) {
        throw new AppError(
            'User missing encrypted Untis credential',
            400,
            'MISSING_UNTIS_SECRET'
        );
    }
    let untisPassword: string;
    try {
        untisPassword = decryptSecret({
            ciphertext: target.untisSecretCiphertext as any,
            nonce: target.untisSecretNonce as any,
            keyVersion: target.untisSecretKeyVersion || 1,
        });
    } catch (e) {
        console.error('[timetable] decrypt secret failed', e);
        throw new AppError(
            'Credential decryption failed',
            500,
            'DECRYPT_FAILED'
        );
    }
    const untis = new WebUntis(
        school,
        target.username,
        untisPassword,
        host
    ) as any;
    
    let userKlasseId: number | undefined = undefined;
    
    try {
        await untis.login();
        
        // Try to get user's class information for exam API
        try {
            if (typeof untis.getOwnClassesList === 'function') {
                const classes = await untis.getOwnClassesList();
                if (Array.isArray(classes) && classes.length > 0 && classes[0]?.id) {
                    userKlasseId = classes[0].id;
                    console.debug('[timetable] found user class ID', userKlasseId);
                }
            }
        } catch (e) {
            console.debug('[timetable] could not get user class info, continuing without');
        }
    } catch (e: any) {
        const msg = e?.message || '';
        if (msg.includes('bad credentials')) {
            throw new AppError(
                'Invalid Untis credentials',
                401,
                'BAD_CREDENTIALS'
            );
        }
        throw new AppError('Untis login failed', 502, 'UNTIS_LOGIN_FAILED');
    }

    let lessonsData: any;
    let homeworkData: any[] = [];
    let examData: any = [];

    try {
        // Fetch all lessons using getOwnTimetableForRange
        if (sd && ed && typeof untis.getOwnTimetableForRange === 'function') {
            console.debug('[timetable] calling getOwnTimetableForRange', {
                start: sd,
                end: ed,
                startType: typeof sd,
                endType: typeof ed,
            });
            lessonsData = await untis.getOwnTimetableForRange(sd, ed);
            console.debug('[timetable] fetched lessons data', {
                count: Array.isArray(lessonsData) ? lessonsData.length : 0,
                sampleLesson: Array.isArray(lessonsData) && lessonsData.length > 0 ? {
                    id: lessonsData[0].id,
                    date: lessonsData[0].date,
                    hasInfo: 'info' in lessonsData[0],
                    infoValue: lessonsData[0].info,
                    hasLstext: 'lstext' in lessonsData[0],
                    lstextValue: lessonsData[0].lstext,
                    allKeys: Object.keys(lessonsData[0]),
                } : null,
            });
        } else if (typeof untis.getOwnTimetableForToday === 'function') {
            console.debug('[timetable] calling getOwnTimetableForToday');
            lessonsData = await untis.getOwnTimetableForToday();
        } else {
            console.debug(
                '[timetable] calling getTimetableForToday (fallback)'
            );
            lessonsData = await untis.getTimetableForToday?.();
        }

        // Fetch homework separately using getHomeWorksFor
        if (sd && ed && typeof untis.getHomeWorksFor === 'function') {
            console.debug('[timetable] calling getHomeWorksFor', {
                start: sd,
                end: ed,
            });
            try {
                const hwResp = await untis.getHomeWorksFor(sd, ed);
                // Extract array of homework items from response shape
                homeworkData = Array.isArray(hwResp)
                    ? hwResp
                    : Array.isArray(hwResp?.homeworks)
                    ? hwResp.homeworks
                    : [];
                // Build a map of lessonId -> subject string if available
                const lessonSubjectByLessonId: Map<number, string> = new Map();
                const lessonsArr: any[] = Array.isArray(hwResp?.lessons)
                    ? hwResp.lessons
                    : [];
                for (const l of lessonsArr) {
                    if (
                        typeof l?.id === 'number' &&
                        typeof l?.subject === 'string'
                    ) {
                        lessonSubjectByLessonId.set(l.id, l.subject);
                    }
                }
                console.debug(
                    '[timetable] fetched homework count',
                    homeworkData.length
                );
                // Persist with subject enrichment and due dates
                if (homeworkData.length > 0) {
                    try {
                        await storeHomeworkData(
                            target.id,
                            homeworkData,
                            lessonSubjectByLessonId
                        );
                    } catch (e: any) {
                        console.warn(
                            '[timetable] failed to store homework data',
                            e?.message
                        );
                    }
                }
            } catch (e: any) {
                console.warn(
                    '[timetable] getHomeWorksFor failed, continuing without homework',
                    e?.message
                );
                homeworkData = [];
            }
        }

        // Fetch exams for the range if available
        if (sd && ed && typeof untis.getExamsForRange === 'function') {
            console.debug('[timetable] calling getExamsForRange', {
                start: sd,
                end: ed,
                klasseId: userKlasseId,
            });
            try {
                // Try with klasseId if available, otherwise without
                examData = userKlasseId 
                    ? await untis.getExamsForRange(sd, ed, userKlasseId)
                    : await untis.getExamsForRange(sd, ed);
                console.debug('[timetable] fetched exam data', {
                    count: Array.isArray(examData) ? examData.length : 0,
                    sample: Array.isArray(examData) && examData.length > 0 ? examData[0] : null,
                });
            } catch (e: any) {
                console.warn(
                    '[timetable] getExamsForRange failed, trying getHomeWorkAndLessons fallback',
                    e?.message
                );
                // Try alternative method that might include exams
                if (typeof untis.getHomeWorkAndLessons === 'function') {
                    try {
                        console.debug('[timetable] trying getHomeWorkAndLessons fallback');
                        const hwAndLessons = await untis.getHomeWorkAndLessons(sd, ed);
                        // Extract exams if available in the response
                        examData = hwAndLessons?.exams || [];
                        console.debug('[timetable] fallback exam data', {
                            count: Array.isArray(examData) ? examData.length : 0,
                        });
                    } catch (fallbackError: any) {
                        console.warn('[timetable] getHomeWorkAndLessons fallback also failed', fallbackError?.message);
                        examData = [];
                    }
                } else {
                    examData = [];
                }
            }
        }
    } catch (e: any) {
        const msg = String(e?.message || '').toLowerCase();
        if (
            msg.includes("didn't return any result") ||
            msg.includes('did not return any result') ||
            msg.includes('no result')
        ) {
            console.warn('[timetable] no result from Untis, returning empty');
            lessonsData = [];
            homeworkData = [];
            examData = [];
        } else {
            throw new AppError('Untis fetch failed', 502, 'UNTIS_FETCH_FAILED');
        }
    }

    try {
        await untis.logout?.();
    } catch {}

    // Store exam data in database
    if (examData && Array.isArray(examData) && examData.length > 0) {
        try {
            await storeExamData(target.id, examData);
        } catch (e: any) {
            console.warn('[timetable] failed to store exam data', e?.message);
        }
    }

    // Combine homework and exam data with lessons
    const enrichedLessons = await enrichLessonsWithHomeworkAndExams(
        target.id,
        lessonsData || [],
        sd,
        ed
    );

    const payload = enrichedLessons;
    const rangeStart = sd ?? null;
    const rangeEnd = ed ?? null;

    const sample = Array.isArray(payload) ? payload.slice(0, 2) : payload;
    console.debug('[timetable] response summary', {
        hasPayload: !!payload,
        type: typeof payload,
        lessonsCount: Array.isArray(lessonsData) ? lessonsData.length : 0,
        homeworkCount: homeworkData.length,
        examsCount: Array.isArray(examData) ? examData.length : 0,
        sample: (() => {
            try {
                return JSON.stringify(sample).slice(0, 500);
            } catch {
                return '[unserializable]';
            }
        })(),
    });

    await prisma.timetable.create({
        data: {
            ownerId: target.id,
            payload,
            rangeStart,
            rangeEnd,
        },
    });

    return { userId: target.id, rangeStart, rangeEnd, payload };
}

// Host is fixed via env. Keep helper for future flexibility.
function toHost() {
    return UNTIS_HOST;
}

function parseDate(date?: string) {
    return date ? new Date(date) : undefined;
}

export async function getOrFetchTimetableRange(args: {
    requesterId: string;
    targetUserId: string;
    start?: string | undefined;
    end?: string | undefined;
}) {
    console.debug('[timetable] request', {
        requesterId: args.requesterId,
        targetUserId: args.targetUserId,
        start: args.start,
        end: args.end,
    });
    const target: any = await (prisma as any).user.findUnique({
        where: { id: args.targetUserId },
        select: {
            id: true,
            username: true,
            untisSecretCiphertext: true,
            untisSecretNonce: true,
            untisSecretKeyVersion: true,
        },
    });
    if (!target) throw new Error('Target user not found');

    const { normStart, normEnd } = normalizeRange(args.start, args.end);
    let sd = normStart;
    let ed = normEnd;
    let cached: any = undefined;
    if (sd && ed) {
        try {
            cached = await getCachedRange(target.id, sd, ed);
        } catch (e) {
            console.warn('[timetable] cache lookup failed', e);
        }
        if (cached) {
            return {
                userId: target.id,
                rangeStart: cached.rangeStart,
                rangeEnd: cached.rangeEnd,
                payload: cached.payload,
                cached: true,
            };
        }
    } else {
        // Range not provided: treat as 'today', define single-day normalization
        if (args.start) sd = startOfDay(new Date(args.start));
        if (args.end) ed = endOfDay(new Date(args.end));
    }

    const fresh = await fetchAndStoreUntis({ target, sd, ed });

    // Fire & forget adjacent week prefetch if week context present
    if (sd && ed) {
        setTimeout(() => {
            const prevStart = new Date(sd!);
            prevStart.setDate(prevStart.getDate() - 7);
            const prevEnd = new Date(ed!);
            prevEnd.setDate(prevEnd.getDate() - 7);
            const nextStart = new Date(sd!);
            nextStart.setDate(nextStart.getDate() + 7);
            const nextEnd = new Date(ed!);
            nextEnd.setDate(nextEnd.getDate() + 7);
            const tasks = [
                { s: prevStart, e: prevEnd },
                { s: nextStart, e: nextEnd },
            ];
            tasks.forEach(async ({ s, e }) => {
                try {
                    const existing = await getCachedRange(target.id, s, e);
                    if (!existing) {
                        await fetchAndStoreUntis({ target, sd: s, ed: e });
                    }
                } catch (e) {
                    console.debug('[timetable][prefetch] skipped', e);
                }
            });
            pruneOldTimetables();
        }, 5); // slight delay to avoid blocking response
    }

    return fresh;
}

export async function verifyUntisCredentials(
    username: string,
    password: string
) {
    const school = UNTIS_DEFAULT_SCHOOL;
    const host = UNTIS_HOST;
    const untis = new WebUntis(school, username, password, host) as any;
    try {
        await untis.login();
        try {
            await untis.logout?.();
        } catch {}
    } catch (e: any) {
        const msg = e?.message || '';
        if (msg.includes('bad credentials')) {
            throw new AppError(
                'Invalid Untis credentials',
                401,
                'BAD_CREDENTIALS'
            );
        }
        throw new AppError('Untis login failed', 502, 'UNTIS_LOGIN_FAILED');
    }
}

export async function getUserClassInfo(
    username: string,
    password: string
): Promise<string[]> {
    const school = UNTIS_DEFAULT_SCHOOL;
    const host = UNTIS_HOST;
    const untis = new WebUntis(school, username, password, host) as any;
    
    try {
        await untis.login();
        
        // Try to get user's classes/grades
        let classes: string[] = [];
        
        try {
            // Get current user info which might include class information
            if (typeof untis.getOwnClassesList === 'function') {
                const classList = await untis.getOwnClassesList();
                classes = Array.isArray(classList) 
                    ? classList.map((c: any) => c.name || c.longName || String(c)).filter(Boolean)
                    : [];
            } else if (typeof untis.getOwnStudentId === 'function') {
                // Alternative approach: get student info
                const studentId = await untis.getOwnStudentId();
                if (studentId && typeof untis.getStudent === 'function') {
                    const student = await untis.getStudent(studentId);
                    if (student?.klasse) {
                        classes = Array.isArray(student.klasse) 
                            ? student.klasse.map((k: any) => k.name || k.longName || String(k)).filter(Boolean)
                            : [String(student.klasse)];
                    }
                }
            }
            
            // If we still don't have classes, try to get them from the general classes list
            if (classes.length === 0 && typeof untis.getClasses === 'function') {
                const allClasses = await untis.getClasses();
                if (Array.isArray(allClasses)) {
                    // This is a fallback - we can't determine user's specific class this way
                    // but we'll return empty array and rely on username whitelist
                    classes = [];
                }
            }
        } catch (e: any) {
            console.warn('[whitelist] failed to get user class info', e?.message);
            classes = [];
        }
        
        try {
            await untis.logout?.();
        } catch {}
        
        return classes;
    } catch (e: any) {
        const msg = e?.message || '';
        if (msg.includes('bad credentials')) {
            throw new AppError(
                'Invalid Untis credentials',
                401,
                'BAD_CREDENTIALS'
            );
        }
        throw new AppError('Untis login failed', 502, 'UNTIS_LOGIN_FAILED');
    }
}

async function storeHomeworkData(
    userId: string,
    homeworkData: any[],
    lessonSubjectByLessonId?: Map<number, string>
) {
    for (const hw of homeworkData) {
        try {
            // Determine subject string via mapping (fallback to hw.subject?.name)
            const subjectStr =
                (typeof hw.lessonId === 'number' &&
                    lessonSubjectByLessonId?.get(hw.lessonId)) ||
                hw.subject?.name ||
                '';
            await (prisma as any).homework.upsert({
                where: { untisId: hw.id },
                update: {
                    lessonId: hw.lessonId,
                    // Store due date; Untis returns both date (assigned) and dueDate
                    date: hw.dueDate ?? hw.date,
                    subjectId: Number.isInteger(hw.subject?.id)
                        ? hw.subject?.id
                        : 0,
                    subject: subjectStr,
                    text: hw.text || '',
                    remark: hw.remark,
                    completed: hw.completed || false,
                    fetchedAt: new Date(),
                },
                create: {
                    untisId: hw.id,
                    userId,
                    lessonId: hw.lessonId,
                    // Store due date; Untis returns both date (assigned) and dueDate
                    date: hw.dueDate ?? hw.date,
                    subjectId: Number.isInteger(hw.subject?.id)
                        ? hw.subject?.id
                        : 0,
                    subject: subjectStr,
                    text: hw.text || '',
                    remark: hw.remark,
                    completed: hw.completed || false,
                },
            });
        } catch (e: any) {
            console.warn(
                `[homework] failed to store homework ${hw?.id}:`,
                e?.message
            );
        }
    }
}

async function storeExamData(userId: string, examData: any[]) {
    for (const exam of examData) {
        try {
            // Handle the correct WebUntis API response format
            // examDate vs date, subject string vs object, etc.
            const examDate = exam.examDate || exam.date;
            const subjectName = typeof exam.subject === 'string' 
                ? exam.subject 
                : exam.subject?.name || '';
            const subjectId = typeof exam.subject === 'object' 
                ? exam.subject?.id 
                : null;
            
            await (prisma as any).exam.upsert({
                where: { untisId: exam.id },
                update: {
                    date: examDate,
                    startTime: exam.startTime,
                    endTime: exam.endTime,
                    subjectId: subjectId,
                    subject: subjectName,
                    name: exam.name || '',
                    text: exam.text || null,
                    // Handle teachers and rooms arrays
                    teachers: Array.isArray(exam.teachers) ? exam.teachers : null,
                    rooms: Array.isArray(exam.rooms) ? exam.rooms : null,
                    fetchedAt: new Date(),
                },
                create: {
                    untisId: exam.id,
                    userId,
                    date: examDate,
                    startTime: exam.startTime,
                    endTime: exam.endTime,
                    subjectId: subjectId,
                    subject: subjectName,
                    name: exam.name || '',
                    text: exam.text || null,
                    // Handle teachers and rooms arrays
                    teachers: Array.isArray(exam.teachers) ? exam.teachers : null,
                    rooms: Array.isArray(exam.rooms) ? exam.rooms : null,
                },
            });
        } catch (e: any) {
            console.warn(`[exam] failed to store exam ${exam.id}:`, e?.message);
        }
    }
}

async function enrichLessonsWithHomeworkAndExams(
    userId: string,
    lessons: any[],
    startDate?: Date,
    endDate?: Date
): Promise<any[]> {
    if (!Array.isArray(lessons)) return lessons;

    // Get homework and exams for the date range (due date for homework)
    const whereClause: any = { userId };
    if (startDate && endDate) {
        const startDateInt = parseInt(
            startDate.toISOString().slice(0, 10).replace(/-/g, '')
        );
        const endDateInt = parseInt(
            endDate.toISOString().slice(0, 10).replace(/-/g, '')
        );
        whereClause.date = {
            gte: startDateInt,
            lte: endDateInt,
        };
    }

    const [homework, exams] = await Promise.all([
        (prisma as any).homework.findMany({ where: whereClause }),
        (prisma as any).exam.findMany({ where: whereClause }),
    ]);

    console.debug('[enrichLessonsWithHomeworkAndExams]', {
        lessonsCount: lessons.length,
        homeworkCount: homework.length,
        examsCount: exams.length,
        exampleExam: exams.length > 0 ? exams[0] : null,
        exampleLesson: lessons.length > 0 ? {
            date: lessons[0].date,
            subject: lessons[0].su?.[0]?.name,
        } : null,
    });

    const lessonMatchesHw = (hw: any, lesson: any) => {
        const idsToCheck = [
            lesson?.id,
            lesson?.lsnumber,
            lesson?.lsNumber,
            lesson?.ls,
            lesson?.lessonId,
        ].filter((v) => typeof v === 'number');
        return idsToCheck.some((v) => v === hw.lessonId);
    };

    // Enrich lessons with homework and exam data
    return lessons.map((lesson) => {
        const subjectName = lesson.su?.[0]?.name;
        
        // Debug lesson data to see what fields are available
        if (lesson.id === lessons[0]?.id) {
            console.debug('[enrichLessonsWithHomeworkAndExams] first lesson sample', {
                hasInfo: !!lesson.info,
                hasLstext: !!lesson.lstext,
                hasAlternativeInfo: !!(lesson.periodInfo || lesson.lessonText),
                hasAlternativeText: !!lesson.periodText,
            });
        }
        
        const lessonHomework = homework
            .filter(
                (hw: any) =>
                    lessonMatchesHw(hw, lesson) ||
                    (hw.date === lesson.date &&
                        hw.subject &&
                        subjectName &&
                        hw.subject === subjectName)
            )
            .map((hw: any) => ({
                id: hw.untisId,
                lessonId: hw.lessonId,
                date: hw.date,
                subject: { id: hw.subjectId, name: hw.subject },
                text: hw.text,
                remark: hw.remark,
                completed: hw.completed,
            }));

        const lessonExams = exams
            .filter(
                (exam: any) => {
                    // Match by date first
                    if (exam.date !== lesson.date) return false;
                    
                    // Try to match by subject name - be more flexible with matching
                    const lessonSubject = lesson.su?.[0]?.name;
                    if (!lessonSubject || !exam.subject) return false;
                    
                    // Direct match or case-insensitive match
                    const matches = exam.subject === lessonSubject || 
                           exam.subject.toLowerCase() === lessonSubject.toLowerCase();
                           
                    // Log only when matches are found for debugging
                    if (matches) {
                        console.debug('[enrichLessonsWithHomeworkAndExams] exam matched to lesson', {
                            examId: exam.untisId,
                            examSubject: exam.subject,
                            lessonSubject: lessonSubject,
                        });
                    }
                    
                    return matches;
                }
            )
            .map((exam: any) => ({
                id: exam.untisId,
                date: exam.date,
                startTime: exam.startTime,
                endTime: exam.endTime,
                subject: { id: exam.subjectId, name: exam.subject },
                // Handle teachers and rooms - they might be arrays of strings or objects
                teachers: Array.isArray(exam.teachers) 
                    ? exam.teachers.map((t: any) => typeof t === 'string' ? { name: t } : t)
                    : undefined,
                rooms: Array.isArray(exam.rooms)
                    ? exam.rooms.map((r: any) => typeof r === 'string' ? { name: r } : r) 
                    : undefined,
                name: exam.name,
                text: exam.text,
            }));

        return {
            ...lesson,
            // Ensure lesson info fields are preserved, check alternative field names
            info: lesson.info || lesson.periodInfo || lesson.lessonText || undefined,
            lstext: lesson.lstext || lesson.periodText || undefined,
            homework: lessonHomework.length > 0 ? lessonHomework : undefined,
            exams: lessonExams.length > 0 ? lessonExams : undefined,
        };
    });
}
