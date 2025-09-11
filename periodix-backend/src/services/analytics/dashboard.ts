import { prisma } from '../../store/prisma.js';
import { getLocalDayRange } from './time.js';
import type { DashboardStats } from './types.js';

export async function getDashboardStats(): Promise<DashboardStats> {
    const { start: todayStart, end: todayEnd, dateKey } = getLocalDayRange(0);

    const totalUsers = await (prisma as any).user.count();
    const activeUsersToday = await (prisma as any).user.count({
        where: {
            activities: {
                some: { createdAt: { gte: todayStart, lte: todayEnd } },
            },
        },
    });
    const newUsersToday = await (prisma as any).user.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
    });

    const todayStats = await (prisma as any).dailyStats.findUnique({
        where: { date: dateKey },
    });

    let peakHour: number | undefined = todayStats?.peakHour ?? undefined;
    try {
        const hourly = await (prisma as any).hourlyStats.findMany({
            where: { date: dateKey },
            orderBy: { hour: 'asc' },
        });
        if (hourly?.length) {
            let max = -1;
            let maxHour = 0;
            for (const h of hourly as any[]) {
                const count =
                    (h.logins || 0) +
                    (h.timetableViews || 0) +
                    (h.searchQueries || 0);
                if (count > max) {
                    max = count;
                    maxHour = h.hour;
                }
            }
            if (max >= 0) peakHour = maxHour;
        }
    } catch (e) {
        console.error('Failed to derive peak hour:', e);
    }

    let avgSessionDuration: number | undefined =
        todayStats?.avgSessionDuration ?? undefined;
    try {
        const ACTIVE_GAP_MS = 5 * 60 * 1000;
        const activities: Array<{ userId: string; createdAt: Date }> = await (
            prisma as any
        ).userActivity.findMany({
            where: { createdAt: { gte: todayStart, lte: todayEnd } },
            select: { userId: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        const byUser = new Map<string, Date[]>();
        for (const a of activities) {
            if (!byUser.has(a.userId)) byUser.set(a.userId, []);
            byUser.get(a.userId)!.push(new Date(a.createdAt));
        }
        const perUser: number[] = [];
        for (const times of byUser.values()) {
            if (times.length < 2) continue;
            let activeMs = 0;
            for (let i = 1; i < times.length; i++) {
                const prev = times[i - 1];
                const curr = times[i];
                if (!prev || !curr) continue;
                const gap = curr.getTime() - prev.getTime();
                if (gap > 0 && gap <= ACTIVE_GAP_MS) activeMs += gap;
            }
            if (activeMs > 0) perUser.push(activeMs / 60000);
        }
        if (perUser.length) {
            const avg = perUser.reduce((a, b) => a + b, 0) / perUser.length;
            avgSessionDuration = Math.round(avg * 10) / 10;
        }
    } catch (e) {
        console.error('Failed to derive avg session duration:', e);
    }

    const base: DashboardStats = {
        totalUsers,
        activeUsersToday,
        newUsersToday,
        totalLoginsToday: todayStats?.totalLogins || 0,
        timetableViewsToday: todayStats?.timetableViews || 0,
        searchQueriesToday: todayStats?.searchQueries || 0,
    };
    if (avgSessionDuration !== undefined)
        (base as any).avgSessionDuration = avgSessionDuration;
    if (peakHour !== undefined) (base as any).peakHour = peakHour;
    (base as any).serverOffsetMinutes = new Date().getTimezoneOffset();
    return base;
}
