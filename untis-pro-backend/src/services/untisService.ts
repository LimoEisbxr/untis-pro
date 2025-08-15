import { WebUntis } from 'webuntis';
import { prisma } from '../store/prisma.js';
import { UNTIS_DEFAULT_SCHOOL, UNTIS_HOST } from '../server/config.js';
import { AppError } from '../server/errors.js';

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

    let data: any;
    const sd = args.start ? new Date(args.start) : undefined;
    const ed = args.end ? new Date(args.end) : undefined;
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
            // fallback try generic method list
            console.debug(
                '[timetable] calling getTimetableForToday (fallback)'
            );
            data = await untis.getTimetableForToday?.();
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

    const sample = Array.isArray(payload) ? payload.slice(0, 2) : payload;
    console.debug('[timetable] response summary', {
        hasPayload: !!payload,
        type: typeof payload,
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
