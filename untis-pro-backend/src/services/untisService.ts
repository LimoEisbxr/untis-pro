import { WebUntis } from 'webuntis';
import { prisma } from '../store/prisma.js';
import { UNTIS_DEFAULT_SCHOOL, UNTIS_HOST } from '../server/config.js';
import { AppError } from '../server/errors.js';
import { Prisma } from '@prisma/client';

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
    const target = await prisma.user.findUnique({
        where: { id: args.targetUserId },
    });
    if (!target) throw new Error('Target user not found');

    // Fetch fresh from WebUntis
    const school = UNTIS_DEFAULT_SCHOOL;
    const host = toHost();
    console.debug('[timetable] using Untis', {
        school,
        host,
        username: target.username,
    });
    const untis = new WebUntis(
        school,
        target.username,
        target.password,
        host
    ) as any;
    try {
        await untis.login();
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
    let homeworkData: any = [];
    let examData: any = [];
    const sd = args.start ? new Date(args.start) : undefined;
    const ed = args.end ? new Date(args.end) : undefined;
    
    try {
        // Fetch all lessons using getOwnTimetableForRange
        if (typeof untis.getOwnTimetableForRange === 'function' && sd && ed) {
            console.debug('[timetable] calling getOwnTimetableForRange', {
                start: sd,
                end: ed,
            });
            lessonsData = await untis.getOwnTimetableForRange(sd, ed);
        } else if (typeof untis.getOwnTimetableForToday === 'function') {
            console.debug('[timetable] falling back to getOwnTimetableForToday');
            lessonsData = await untis.getOwnTimetableForToday();
        } else {
            console.debug('[timetable] calling getTimetableForToday (fallback)');
            lessonsData = await untis.getTimetableForToday?.();
        }
        
        // Fetch homework separately using getHomeWorksFor
        if (sd && ed && typeof untis.getHomeWorksFor === 'function') {
            console.debug('[timetable] calling getHomeWorksFor', {
                start: sd,
                end: ed,
            });
            try {
                homeworkData = await untis.getHomeWorksFor(sd, ed);
            } catch (e: any) {
                console.warn('[timetable] getHomeWorksFor failed, continuing without homework', e?.message);
                homeworkData = [];
            }
        }
        
        // Fetch exams for the range if available
        if (sd && ed && typeof untis.getExamsForRange === 'function') {
            console.debug('[timetable] calling getExamsForRange', {
                start: sd,
                end: ed,
            });
            try {
                examData = await untis.getExamsForRange(sd, ed);
            } catch (e: any) {
                console.warn('[timetable] getExamsForRange failed, continuing without exams', e?.message);
                examData = [];
            }
        }
        
    } catch (e: any) {
        const msg = String(e?.message || '').toLowerCase();
        // Treat "no result" from Untis as an empty timetable instead of erroring
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

    // Store homework and exam data in database
    if (homeworkData && Array.isArray(homeworkData) && homeworkData.length > 0) {
        try {
            await storeHomeworkData(target.id, homeworkData);
        } catch (e: any) {
            console.warn('[timetable] failed to store homework data', e?.message);
        }
    }
    
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

    try {
        await untis.logout?.();
    } catch {}

    const payload = enrichedLessons;
    const rangeStart = sd ?? null;
    const rangeEnd = ed ?? null;

    const sample = Array.isArray(payload) ? payload.slice(0, 2) : payload;
    console.debug('[timetable] response summary', {
        hasPayload: !!payload,
        type: typeof payload,
        lessonsCount: Array.isArray(lessonsData) ? lessonsData.length : 0,
        homeworkCount: Array.isArray(homeworkData) ? homeworkData.length : 0,
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

async function storeHomeworkData(userId: string, homeworkData: any[]) {
    for (const hw of homeworkData) {
        try {
            await (prisma as any).homework.upsert({
                where: { untisId: hw.id },
                update: {
                    lessonId: hw.lessonId,
                    date: hw.date,
                    subjectId: hw.subject?.id,
                    subject: hw.subject?.name || '',
                    text: hw.text || '',
                    remark: hw.remark,
                    completed: hw.completed || false,
                    fetchedAt: new Date(),
                },
                create: {
                    untisId: hw.id,
                    userId,
                    lessonId: hw.lessonId,
                    date: hw.date,
                    subjectId: hw.subject?.id,
                    subject: hw.subject?.name || '',
                    text: hw.text || '',
                    remark: hw.remark,
                    completed: hw.completed || false,
                },
            });
        } catch (e: any) {
            console.warn(`[homework] failed to store homework ${hw.id}:`, e?.message);
        }
    }
}

async function storeExamData(userId: string, examData: any[]) {
    for (const exam of examData) {
        try {
            await (prisma as any).exam.upsert({
                where: { untisId: exam.id },
                update: {
                    date: exam.date,
                    startTime: exam.startTime,
                    endTime: exam.endTime,
                    subjectId: exam.subject?.id,
                    subject: exam.subject?.name || '',
                    name: exam.name || '',
                    text: exam.text,
                    // Store as JSON or set null when absent
                    teachers: exam.teachers ?? null,
                    rooms: exam.rooms ?? null,
                    fetchedAt: new Date(),
                },
                create: {
                    untisId: exam.id,
                    userId,
                    date: exam.date,
                    startTime: exam.startTime,
                    endTime: exam.endTime,
                    subjectId: exam.subject?.id,
                    subject: exam.subject?.name || '',
                    name: exam.name || '',
                    text: exam.text,
                    // Store as JSON or set null when absent
                    teachers: exam.teachers ?? null,
                    rooms: exam.rooms ?? null,
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

    // Get homework and exams for the date range
    const whereClause: any = { userId };
    if (startDate && endDate) {
        const startDateInt = parseInt(startDate.toISOString().slice(0, 10).replace(/-/g, ''));
        const endDateInt = parseInt(endDate.toISOString().slice(0, 10).replace(/-/g, ''));
        whereClause.date = {
            gte: startDateInt,
            lte: endDateInt,
        };
    }

    const [homework, exams] = await Promise.all([
        (prisma as any).homework.findMany({ where: whereClause }),
        (prisma as any).exam.findMany({ where: whereClause }),
    ]);

    // Enrich lessons with homework and exam data
    return lessons.map((lesson) => {
        const lessonHomework = homework.filter((hw: any) => 
            hw.lessonId === lesson.id || 
            (hw.date === lesson.date && hw.subject === lesson.su?.[0]?.name)
        ).map((hw: any) => ({
            id: hw.untisId,
            lessonId: hw.lessonId,
            date: hw.date,
            subject: { id: hw.subjectId, name: hw.subject },
            text: hw.text,
            remark: hw.remark,
            completed: hw.completed,
        }));

        const lessonExams = exams.filter((exam: any) =>
            exam.date === lesson.date && exam.subject === lesson.su?.[0]?.name
        ).map((exam: any) => ({
            id: exam.untisId,
            date: exam.date,
            startTime: exam.startTime,
            endTime: exam.endTime,
            subject: { id: exam.subjectId, name: exam.subject },
            // Values are already JSON in DB
            teachers: exam.teachers ?? undefined,
            rooms: exam.rooms ?? undefined,
            name: exam.name,
            text: exam.text,
        }));

        return {
            ...lesson,
            homework: lessonHomework.length > 0 ? lessonHomework : undefined,
            exams: lessonExams.length > 0 ? lessonExams : undefined,
        };
    });
}


