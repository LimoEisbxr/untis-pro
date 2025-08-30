import { WebUntis } from 'webuntis';
import { prisma } from '../store/prisma.js';
import { decryptSecret } from '../server/crypto.js';
import { UNTIS_DEFAULT_SCHOOL, UNTIS_HOST } from '../server/config.js';
import { AppError } from '../server/errors.js';

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
            const keepIds = new Set(keep.map((k) => k.id));
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

    let data: any;
    try {
        if (sd && ed && typeof untis.getOwnTimetableForRange === 'function') {
            console.debug('[timetable] calling getOwnTimetableForRange', {
                start: sd,
                end: ed,
                startType: typeof sd,
                endType: typeof ed,
            });
            data = await untis.getOwnTimetableForRange(sd, ed);
        } else if (typeof untis.getOwnTimetableForToday === 'function') {
            console.debug('[timetable] calling getOwnTimetableForToday');
            data = await untis.getOwnTimetableForToday();
        } else {
            console.debug(
                '[timetable] calling getTimetableForToday (fallback)'
            );
            data = await untis.getTimetableForToday?.();
        }
    } catch (e: any) {
        const msg = String(e?.message || '').toLowerCase();
        if (
            msg.includes("didn't return any result") ||
            msg.includes('did not return any result') ||
            msg.includes('no result')
        ) {
            console.warn('[timetable] no result from Untis, returning empty');
            data = [];
        } else {
            throw new AppError('Untis fetch failed', 502, 'UNTIS_FETCH_FAILED');
        }
    }

    try {
        await untis.logout?.();
    } catch {}

    const payload = data ?? [];
    const rangeStart = sd ?? null;
    const rangeEnd = ed ?? null;

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
