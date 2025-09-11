import { prisma } from '../../store/prisma.js';
import { getLocalDayRange } from './time.js';
import type { ActivityTrends } from './types.js';

export async function getActivityTrends(): Promise<ActivityTrends> {
    const { dateKey: today } = getLocalDayRange(0);

    const hourlyStats = await (prisma as any).hourlyStats.findMany({
        where: { date: today },
        orderBy: { hour: 'asc' },
    });
    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
        const stat = hourlyStats.find((s: any) => s.hour === hour);
        return {
            hour,
            count:
                (stat?.logins || 0) +
                (stat?.timetableViews || 0) +
                (stat?.searchQueries || 0),
            label: `${hour.toString().padStart(2, '0')}:00`,
        };
    });

    const dailyStats = await (prisma as any).dailyStats.findMany({
        where: { date: { gte: getLocalDayRange(-7).dateKey } },
        orderBy: { date: 'asc' },
    });
    const dailyActivity = dailyStats.map((stat: any) => ({
        date: stat.date,
        logins: stat.totalLogins,
        timetableViews: stat.timetableViews,
        searches: stat.searchQueries,
    }));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const featureUsageRaw = await (prisma as any).userActivity.groupBy({
        by: ['action'],
        where: { createdAt: { gte: sevenDaysAgo } },
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
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
        serverOffsetMinutes: new Date().getTimezoneOffset(),
    };
}
