import { useEffect, useState, useCallback } from 'react';
import {
    getAnalyticsOverview,
    getAnalyticsDetails,
    trackActivity,
    type DashboardStats,
    type UserEngagementMetrics,
    type ActivityTrends,
    type AnalyticsDetailMetric,
    type AnalyticsDetailItem,
} from '../../api';

export interface AnalyticsState {
    loading: boolean;
    error: string | null;
    refreshing: boolean;
    dashboardStats: DashboardStats | null;
    engagementMetrics: UserEngagementMetrics | null;
    activityTrends: ActivityTrends | null;
    hourlyChart: { labels: string[]; data: number[] };
    maxHourly: number;
    growthChart: { labels: string[]; data: number[] };
    featureUsage: Array<{
        feature: string;
        count: number;
        percentage: number;
        displayName: string;
    }>;
}

export interface DetailsState {
    open: boolean;
    metric: AnalyticsDetailMetric | null;
    items: AnalyticsDetailItem[];
    loading: boolean;
    error: string | null;
}

export function useAnalyticsData(token: string) {
    const [state, setState] = useState<AnalyticsState>(() => ({
        loading: true,
        error: null,
        refreshing: false,
        dashboardStats: null,
        engagementMetrics: null,
        activityTrends: null,
        hourlyChart: { labels: [], data: [] },
        maxHourly: 1,
        growthChart: { labels: [], data: [] },
        featureUsage: [],
    }));

    const [details, setDetails] = useState<DetailsState>({
        open: false,
        metric: null,
        items: [],
        loading: false,
        error: null,
    });

    // initial view tracking
    useEffect(() => {
        trackActivity(token, 'analytics_view').catch(console.error);
    }, [token]);

    const computeDerived = useCallback(
        (
            _dashboard: DashboardStats | null,
            engagement: UserEngagementMetrics | null,
            trends: ActivityTrends | null
        ) => {
            // Hourly chart: adjust server offset
            let hourlyChart = { labels: [] as string[], data: [] as number[] };
            let maxHourly = 1;
            if (trends?.hourlyActivity) {
                const serverOffset = trends.serverOffsetMinutes ?? 0;
                const clientOffset = new Date().getTimezoneOffset();
                const shiftHours = Math.round(
                    (serverOffset - clientOffset) / 60
                );
                const buckets = new Array<number>(24).fill(0);
                for (const h of trends.hourlyActivity) {
                    const shifted = (((h.hour + shiftHours) % 24) + 24) % 24;
                    buckets[shifted] += h.count;
                }
                hourlyChart = {
                    labels: buckets.map(
                        (_, hour) => `${hour.toString().padStart(2, '0')}:00`
                    ),
                    data: buckets,
                };
                maxHourly = buckets.length ? Math.max(...buckets, 1) : 1;
            }

            // Growth chart
            let growthChart = { labels: [] as string[], data: [] as number[] };
            if (engagement?.userGrowthTrend) {
                growthChart = {
                    labels: engagement.userGrowthTrend.map((d) =>
                        new Date(d.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                        })
                    ),
                    data: engagement.userGrowthTrend.map((d) => d.totalUsers),
                };
            }

            // Feature usage
            const featureUsage =
                trends?.featureUsage?.map((f) => ({
                    ...f,
                    displayName: f.feature
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase()),
                })) || [];

            return { hourlyChart, maxHourly, growthChart, featureUsage };
        },
        []
    );

    const load = useCallback(async () => {
        try {
            setState((s) => ({ ...s, error: null }));
            const data = await getAnalyticsOverview(token);
            const derived = computeDerived(
                data.dashboard,
                data.engagement,
                data.trends
            );
            setState((s) => ({
                ...s,
                loading: false,
                refreshing: false,
                dashboardStats: data.dashboard,
                engagementMetrics: data.engagement,
                activityTrends: data.trends,
                ...derived,
            }));
        } catch (err) {
            console.error('Failed to load analytics:', err);
            setState((s) => ({
                ...s,
                loading: false,
                refreshing: false,
                error:
                    err instanceof Error
                        ? err.message
                        : 'Failed to load analytics',
            }));
        }
    }, [token, computeDerived]);

    useEffect(() => {
        load();
    }, [load]);

    const refresh = async () => {
        setState((s) => ({ ...s, refreshing: true }));
        await load();
    };

    const openDetails = async (metric: AnalyticsDetailMetric) => {
        setDetails({
            open: true,
            metric,
            items: [],
            loading: true,
            error: null,
        });
        try {
            const res = await getAnalyticsDetails(token, metric);
            setDetails({
                open: true,
                metric,
                items: res.details.items,
                loading: false,
                error: null,
            });
        } catch (err) {
            setDetails((d) => ({
                ...d,
                loading: false,
                error:
                    err instanceof Error
                        ? err.message
                        : 'Failed to load details',
            }));
        }
    };

    const closeDetails = () => setDetails((d) => ({ ...d, open: false }));

    const formatDuration = (minutes?: number) => {
        if (!minutes) return 'N/A';
        if (minutes < 60) return `${Math.round(minutes)}m`;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    };

    const formatHourLocal = (hour?: number) => {
        if (hour === undefined || hour === null) return 'N/A';
        const serverOffset = state.dashboardStats?.serverOffsetMinutes ?? 0;
        const clientOffset = new Date().getTimezoneOffset();
        const shifted =
            (((hour + Math.round((serverOffset - clientOffset) / 60)) % 24) +
                24) %
            24;
        return `${shifted.toString().padStart(2, '0')}:00`;
    };

    return {
        state,
        details,
        refresh,
        openDetails,
        closeDetails,
        formatDuration,
        formatHourLocal,
    };
}
