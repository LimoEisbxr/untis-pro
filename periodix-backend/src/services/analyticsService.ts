import { prisma } from '../store/prisma.js';

export interface TrackingData {
    userId: string;
    action: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
}

export interface DashboardStats {
    totalUsers: number;
    activeUsersToday: number;
    newUsersToday: number;
    totalLoginsToday: number;
    timetableViewsToday: number;
    searchQueriesToday: number;
    avgSessionDuration?: number;
    peakHour?: number;
}

export interface UserEngagementMetrics {
    mostActiveUsers: Array<{
        userId: string;
        username: string;
        displayName: string | null;
        activityCount: number;
        lastActivity: Date;
    }>;
    userGrowthTrend: Array<{
        date: string;
        newUsers: number;
        totalUsers: number;
    }>;
    retentionRate: number;
}

export interface ActivityTrends {
    hourlyActivity: Array<{
        hour: number;
        count: number;
        label: string;
    }>;
    dailyActivity: Array<{
        date: string;
        logins: number;
        timetableViews: number;
        searches: number;
    }>;
    featureUsage: Array<{
        feature: string;
        count: number;
        percentage: number;
    }>;
}

/**
 * Track a user activity event
 */
export async function trackActivity(data: TrackingData): Promise<void> {
    try {
        // Skip tracking for admin pseudo-user (no DB row, FK would fail). We also exclude admin from stats.
        if (data.userId === 'admin') return;

        // Best-effort: insert activity row
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

        // Update hourly stats (best-effort)
        try {
            await updateHourlyStats(data.action);
        } catch (err) {
            console.error('Failed to update hourly stats:', err);
        }

        // Update daily stats (async, don't wait)
        updateDailyStats(data.userId, data.action).catch((err) =>
            console.error('Failed to update daily stats:', err)
        );
    } catch (error) {
        console.error('Failed to track activity:', error);
        // Don't throw - tracking failures shouldn't break app functionality
    }
}

/**
 * Get dashboard statistics for today
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const todayEnd = new Date(today + 'T23:59:59.999Z');

    // Get total users count
    const totalUsers = await (prisma as any).user.count();

    // Get users active today
    const activeUsersToday = await (prisma as any).user.count({
        where: {
            activities: {
                some: {
                    createdAt: {
                        gte: todayStart,
                        lte: todayEnd,
                    },
                },
            },
        },
    });

    // Get new users today
    const newUsersToday = await (prisma as any).user.count({
        where: {
            createdAt: {
                gte: todayStart,
                lte: todayEnd,
            },
        },
    });

    // Get today's activity stats
    const todayStats = await (prisma as any).dailyStats.findUnique({
        where: { date: today },
    });

    // Derive peak hour from hourly stats if not yet stored
    let peakHour: number | undefined = todayStats?.peakHour ?? undefined;
    try {
        const hourly = await (prisma as any).hourlyStats.findMany({
            where: { date: today },
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

    // Derive average session duration (very rough): for users with >=2 activities today,
    // duration = max(createdAt) - min(createdAt); average over users, minutes.
    let avgSessionDuration: number | undefined =
        todayStats?.avgSessionDuration ?? undefined;
    try {
        const grouped = await (prisma as any).userActivity.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: todayStart, lte: todayEnd } },
            _count: { _all: true },
            _min: { createdAt: true },
            _max: { createdAt: true },
        });
        const durations: number[] = [];
        for (const g of grouped as any[]) {
            if (
                (g?._count?._all ?? 0) >= 2 &&
                g._min?.createdAt &&
                g._max?.createdAt
            ) {
                const diffMs =
                    new Date(g._max.createdAt).getTime() -
                    new Date(g._min.createdAt).getTime();
                if (diffMs > 0) durations.push(diffMs / 60000); // minutes
            }
        }
        if (durations.length) {
            avgSessionDuration =
                Math.round(
                    (durations.reduce((a, b) => a + b, 0) / durations.length) *
                        10
                ) / 10;
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
    return base;
}

/**
 * Get user engagement metrics
 */
export async function getUserEngagementMetrics(): Promise<UserEngagementMetrics> {
    // Most active users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const mostActiveUsers = await (prisma as any).user.findMany({
        select: {
            id: true,
            username: true,
            displayName: true,
            activities: {
                where: {
                    createdAt: {
                        gte: sevenDaysAgo,
                    },
                },
                select: {
                    createdAt: true,
                },
            },
        },
        orderBy: {
            activities: {
                _count: 'desc',
            },
        },
        take: 10,
    });

    const processedActiveUsers = mostActiveUsers
        .map((user: any) => ({
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            activityCount: user.activities.length,
            lastActivity:
                user.activities.length > 0
                    ? new Date(
                          Math.max(
                              ...user.activities.map((a: any) =>
                                  new Date(a.createdAt).getTime()
                              )
                          )
                      )
                    : new Date(0),
        }))
        .filter((user: any) => user.activityCount > 0);

    // User growth trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyUserStats = await (prisma as any).dailyStats.findMany({
        where: {
            date: {
                gte: thirtyDaysAgo.toISOString().split('T')[0],
            },
        },
        orderBy: {
            date: 'asc',
        },
        select: {
            date: true,
            newUsers: true,
            totalUsers: true,
        },
    });

    const userGrowthTrend = dailyUserStats.map((stat: any) => ({
        date: stat.date,
        newUsers: stat.newUsers,
        totalUsers: stat.totalUsers,
    }));

    // Calculate retention rate (users who logged in today and 7 days ago)
    const today = new Date().toISOString().split('T')[0];
    const retentionRate = await calculateRetentionRate();

    return {
        mostActiveUsers: processedActiveUsers,
        userGrowthTrend,
        retentionRate,
    };
}

/**
 * Get activity trends and patterns
 */
export async function getActivityTrends(): Promise<ActivityTrends> {
    const today = new Date().toISOString().split('T')[0];

    // Hourly activity for today
    const hourlyStats = await (prisma as any).hourlyStats.findMany({
        where: { date: today },
        orderBy: { hour: 'asc' },
    });

    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
        const stat = hourlyStats.find((s: any) => s.hour === hour);
        return {
            hour,
            // Only count event totals to avoid double-counting (activeUsers is not an event counter)
            count:
                (stat?.logins || 0) +
                (stat?.timetableViews || 0) +
                (stat?.searchQueries || 0),
            label: `${hour.toString().padStart(2, '0')}:00`,
        };
    });

    // Daily activity for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await (prisma as any).dailyStats.findMany({
        where: {
            date: {
                gte: sevenDaysAgo.toISOString().split('T')[0],
            },
        },
        orderBy: { date: 'asc' },
    });

    const dailyActivity = dailyStats.map((stat: any) => ({
        date: stat.date,
        logins: stat.totalLogins,
        timetableViews: stat.timetableViews,
        searches: stat.searchQueries,
    }));

    // Feature usage (last 7 days)
    const featureUsageRaw = await (prisma as any).userActivity.groupBy({
        by: ['action'],
        where: {
            createdAt: {
                gte: sevenDaysAgo,
            },
        },
        _count: {
            action: true,
        },
        orderBy: {
            _count: {
                action: 'desc',
            },
        },
    });

    const totalFeatureUsage = featureUsageRaw.reduce(
        (sum: number, item: any) => sum + item._count.action,
        0
    );
    const featureUsage = featureUsageRaw.map((item: any) => ({
        feature: item.action,
        count: item._count.action,
        percentage:
            totalFeatureUsage > 0
                ? Math.round((item._count.action / totalFeatureUsage) * 100)
                : 0,
    }));

    return {
        hourlyActivity,
        dailyActivity,
        featureUsage,
    };
}

/**
 * Update hourly statistics
 */
async function updateHourlyStats(action: string): Promise<void> {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getHours();

    try {
        await (prisma as any).hourlyStats.upsert({
            where: {
                date_hour: {
                    date,
                    hour,
                },
            },
            update: {
                // activeUsers is not a strict counter here; avoid incrementing to prevent double counting
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

/**
 * Update daily statistics
 */
async function updateDailyStats(userId: string, action: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const todayEnd = new Date(today + 'T23:59:59.999Z');

    try {
        // Check if user is new today
        const user = await (prisma as any).user.findUnique({
            where: { id: userId },
            select: { createdAt: true },
        });

        const isNewUser = !!(
            user?.createdAt &&
            new Date(user.createdAt).toISOString().split('T')[0] === today
        );

        // Get current stats or create new
        const existingStats = await (prisma as any).dailyStats.findUnique({
            where: { date: today },
        });

        if (existingStats) {
            // Count distinct users who were active today (including the current activity)
            const activeUsersToday = await (prisma as any).userActivity.groupBy(
                {
                    by: ['userId'],
                    where: {
                        createdAt: {
                            gte: todayStart,
                            lte: todayEnd,
                        },
                    },
                    _count: { userId: true },
                }
            );

            const currentActiveUsers = activeUsersToday.length;

            // Count unique users who logged in today
            const uniqueLoginsToday = await (
                prisma as any
            ).userActivity.groupBy({
                by: ['userId'],
                where: {
                    action: 'login',
                    createdAt: {
                        gte: todayStart,
                        lte: todayEnd,
                    },
                },
                _count: { userId: true },
            });

            const currentUniqueLogins = uniqueLoginsToday.length;

            // Update existing record with correct counts
            await (prisma as any).dailyStats.update({
                where: { date: today },
                data: {
                    activeUsers: currentActiveUsers,
                    uniqueLogins: currentUniqueLogins,
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
            // Create new record
            await (prisma as any).dailyStats.create({
                data: {
                    date: today,
                    totalUsers: await (prisma as any).user.count(),
                    activeUsers: 1, // First user active today
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

/**
 * Calculate 7-day retention rate
 */
async function calculateRetentionRate(): Promise<number> {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const todayStart = new Date(
        today.toISOString().split('T')[0] + 'T00:00:00.000Z'
    );
    const todayEnd = new Date(
        today.toISOString().split('T')[0] + 'T23:59:59.999Z'
    );
    const sevenDaysAgoStart = new Date(
        sevenDaysAgo.toISOString().split('T')[0] + 'T00:00:00.000Z'
    );
    const sevenDaysAgoEnd = new Date(
        sevenDaysAgo.toISOString().split('T')[0] + 'T23:59:59.999Z'
    );

    try {
        // Users active 7 days ago
        const usersActiveSevenDaysAgo = await (prisma as any).user.findMany({
            where: {
                activities: {
                    some: {
                        createdAt: {
                            gte: sevenDaysAgoStart,
                            lte: sevenDaysAgoEnd,
                        },
                    },
                },
            },
            select: { id: true },
        });

        if (usersActiveSevenDaysAgo.length === 0) return 0;

        // Of those users, how many are active today?
        const retainedUsers = await (prisma as any).user.count({
            where: {
                id: {
                    in: usersActiveSevenDaysAgo.map((u: any) => u.id),
                },
                activities: {
                    some: {
                        createdAt: {
                            gte: todayStart,
                            lte: todayEnd,
                        },
                    },
                },
            },
        });

        return Math.round(
            (retainedUsers / usersActiveSevenDaysAgo.length) * 100
        );
    } catch (error) {
        console.error('Failed to calculate retention rate:', error);
        return 0;
    }
}
