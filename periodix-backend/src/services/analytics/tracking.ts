import { prisma } from '../../store/prisma.js';
import { getLocalDayRange, pad2 } from './time.js';
import type { TrackingData } from './types.js';

export async function trackActivity(data: TrackingData): Promise<void> {
    try {
        if (data.userId === 'admin') return; // ignore pseudo-admin user

        try {
            await (prisma as any).userActivity.create({
                data: {
                    userId: data.userId,
                    action: data.action,
                    details: data.details || {},
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    sessionId: data.sessionId,
                },
            });
        } catch (err) {
            console.error('Failed to insert user activity:', err);
        }

        try {
            await updateHourlyStats(data.action);
        } catch (err) {
            console.error('Failed to update hourly stats:', err);
        }

        updateDailyStats(data.userId, data.action).catch((err) =>
            console.error('Failed to update daily stats:', err)
        );
    } catch (error) {
        console.error('Failed to track activity:', error);
    }
}

async function updateHourlyStats(action: string): Promise<void> {
    const { dateKey: date } = getLocalDayRange(0);
    const hour = new Date().getHours();
    try {
        await (prisma as any).hourlyStats.upsert({
            where: { date_hour: { date, hour } },
            update: {
                logins: { increment: action === 'login' ? 1 : 0 },
                timetableViews: {
                    increment: action === 'timetable_view' ? 1 : 0,
                },
                searchQueries: { increment: action === 'search' ? 1 : 0 },
            },
            create: {
                date,
                hour,
                activeUsers: 0,
                logins: action === 'login' ? 1 : 0,
                timetableViews: action === 'timetable_view' ? 1 : 0,
                searchQueries: action === 'search' ? 1 : 0,
            },
        });
    } catch (error) {
        console.error('Failed to update hourly stats:', error);
    }
}

async function updateDailyStats(userId: string, action: string): Promise<void> {
    const {
        start: todayStart,
        end: todayEnd,
        dateKey: today,
    } = getLocalDayRange(0);
    try {
        const user = await (prisma as any).user.findUnique({
            where: { id: userId },
            select: { createdAt: true },
        });
        const isNewUser = !!(
            user?.createdAt &&
            (() => {
                const created = new Date(user.createdAt);
                const key = `${created.getFullYear()}-${pad2(
                    created.getMonth() + 1
                )}-${pad2(created.getDate())}`;
                return key === today;
            })()
        );

        const existingStats = await (prisma as any).dailyStats.findUnique({
            where: { date: today },
        });
        if (existingStats) {
            const activeUsersToday = await (prisma as any).userActivity.groupBy(
                {
                    by: ['userId'],
                    where: { createdAt: { gte: todayStart, lte: todayEnd } },
                    _count: { userId: true },
                }
            );
            const uniqueLoginsToday = await (
                prisma as any
            ).userActivity.groupBy({
                by: ['userId'],
                where: {
                    action: 'login',
                    createdAt: { gte: todayStart, lte: todayEnd },
                },
                _count: { userId: true },
            });
            await (prisma as any).dailyStats.update({
                where: { date: today },
                data: {
                    activeUsers: activeUsersToday.length,
                    uniqueLogins: uniqueLoginsToday.length,
                    totalUsers: await (prisma as any).user.count(),
                    totalLogins: { increment: action === 'login' ? 1 : 0 },
                    timetableViews: {
                        increment: action === 'timetable_view' ? 1 : 0,
                    },
                    searchQueries: { increment: action === 'search' ? 1 : 0 },
                    settingsOpened: {
                        increment: action === 'settings' ? 1 : 0,
                    },
                    colorChanges: {
                        increment: action === 'color_change' ? 1 : 0,
                    },
                    newUsers: { increment: isNewUser ? 1 : 0 },
                },
            });
        } else {
            await (prisma as any).dailyStats.create({
                data: {
                    date: today,
                    totalUsers: await (prisma as any).user.count(),
                    activeUsers: 1,
                    newUsers: isNewUser ? 1 : 0,
                    uniqueLogins: action === 'login' ? 1 : 0,
                    totalLogins: action === 'login' ? 1 : 0,
                    timetableViews: action === 'timetable_view' ? 1 : 0,
                    searchQueries: action === 'search' ? 1 : 0,
                    settingsOpened: action === 'settings' ? 1 : 0,
                    colorChanges: action === 'color_change' ? 1 : 0,
                },
            });
        }
    } catch (error) {
        console.error('Failed to update daily stats:', error);
    }
}
