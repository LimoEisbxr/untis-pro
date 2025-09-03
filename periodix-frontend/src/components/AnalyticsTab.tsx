import { useEffect, useState, useMemo } from 'react';
import { 
    getAnalyticsOverview, 
    trackActivity,
    type DashboardStats, 
    type UserEngagementMetrics, 
    type ActivityTrends 
} from '../api';

interface AnalyticsTabProps {
    token: string;
}

interface ChartData {
    labels: string[];
    data: number[];
    colors?: string[];
}

export default function AnalyticsTab({ token }: AnalyticsTabProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [engagementMetrics, setEngagementMetrics] = useState<UserEngagementMetrics | null>(null);
    const [activityTrends, setActivityTrends] = useState<ActivityTrends | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Track analytics view
    useEffect(() => {
        trackActivity(token, 'analytics_view').catch(console.error);
    }, [token]);

    const loadAnalytics = async () => {
        try {
            setError(null);
            const data = await getAnalyticsOverview(token);
            setDashboardStats(data.dashboard);
            setEngagementMetrics(data.engagement);
            setActivityTrends(data.trends);
        } catch (err) {
            console.error('Failed to load analytics:', err);
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, [token]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAnalytics();
    };

    // Chart data preparations
    const hourlyChartData = useMemo((): ChartData => {
        if (!activityTrends?.hourlyActivity) return { labels: [], data: [] };
        
        return {
            labels: activityTrends.hourlyActivity.map(h => h.label),
            data: activityTrends.hourlyActivity.map(h => h.count),
        };
    }, [activityTrends]);

    const growthChartData = useMemo((): ChartData => {
        if (!engagementMetrics?.userGrowthTrend) return { labels: [], data: [] };
        
        return {
            labels: engagementMetrics.userGrowthTrend.map(d => 
                new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            ),
            data: engagementMetrics.userGrowthTrend.map(d => d.totalUsers),
        };
    }, [engagementMetrics]);

    const featureUsageData = useMemo(() => {
        if (!activityTrends?.featureUsage) return [];
        
        return activityTrends.featureUsage.map(f => ({
            ...f,
            displayName: f.feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        }));
    }, [activityTrends]);

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        ))}
                    </div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200">
                    <h3 className="font-medium">Error loading analytics</h3>
                    <p className="text-sm mt-1">{error}</p>
                    <button
                        onClick={handleRefresh}
                        className="mt-3 btn-secondary text-sm"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const formatDuration = (minutes?: number) => {
        if (!minutes) return 'N/A';
        if (minutes < 60) return `${Math.round(minutes)}m`;
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    };

    const formatHour = (hour?: number) => {
        if (hour === undefined || hour === null) return 'N/A';
        return `${hour.toString().padStart(2, '0')}:00`;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        📊 App Statistics
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                        Usage analytics and insights for Periodix
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="btn-secondary flex items-center gap-2"
                    title="Refresh data"
                >
                    <svg
                        className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* Dashboard Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Users</p>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                {dashboardStats?.totalUsers || 0}
                            </p>
                        </div>
                        <div className="text-blue-500 text-2xl">👥</div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-600 dark:text-green-400 text-sm font-medium">Active Today</p>
                            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                                {dashboardStats?.activeUsersToday || 0}
                            </p>
                        </div>
                        <div className="text-green-500 text-2xl">✨</div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-900/20 dark:to-violet-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">Logins Today</p>
                            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                                {dashboardStats?.totalLoginsToday || 0}
                            </p>
                        </div>
                        <div className="text-purple-500 text-2xl">🔑</div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-amber-600 dark:text-amber-400 text-sm font-medium">Retention Rate</p>
                            <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                                {engagementMetrics?.retentionRate || 0}%
                            </p>
                        </div>
                        <div className="text-amber-500 text-2xl">📈</div>
                    </div>
                </div>
            </div>

            {/* Additional Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">📅 Timetable Views Today</h3>
                    <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">
                        {dashboardStats?.timetableViewsToday || 0}
                    </p>
                </div>

                <div className="card p-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">🔍 Searches Today</h3>
                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {dashboardStats?.searchQueriesToday || 0}
                    </p>
                </div>

                <div className="card p-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">⏱️ Avg Session</h3>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatDuration(dashboardStats?.avgSessionDuration)}
                    </p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Activity Chart */}
                <div className="card p-6">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        📊 Today's Activity by Hour
                    </h3>
                    <div className="h-64 flex items-end justify-between gap-1">
                        {hourlyChartData.data.map((value, index) => {
                            const maxValue = Math.max(...hourlyChartData.data, 1);
                            const height = (value / maxValue) * 100;
                            return (
                                <div key={index} className="flex flex-col items-center gap-1 flex-1">
                                    <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                        {value > 0 ? value : ''}
                                    </div>
                                    <div
                                        className="bg-gradient-to-t from-sky-500 to-sky-300 dark:from-sky-600 dark:to-sky-400 rounded-t min-h-[2px] w-full"
                                        style={{ height: `${Math.max(height, 2)}%` }}
                                        title={`${hourlyChartData.labels[index]}: ${value} activities`}
                                    ></div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 rotate-45 origin-center">
                                        {hourlyChartData.labels[index]?.split(':')[0]}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* User Growth Chart */}
                <div className="card p-6">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        📈 User Growth (Last 30 Days)
                    </h3>
                    <div className="h-64 flex items-end justify-between gap-1">
                        {growthChartData.data.map((value, index) => {
                            const maxValue = Math.max(...growthChartData.data, 1);
                            const height = (value / maxValue) * 100;
                            return (
                                <div key={index} className="flex flex-col items-center gap-1 flex-1">
                                    <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                        {value}
                                    </div>
                                    <div
                                        className="bg-gradient-to-t from-emerald-500 to-emerald-300 dark:from-emerald-600 dark:to-emerald-400 rounded-t min-h-[2px] w-full"
                                        style={{ height: `${Math.max(height, 2)}%` }}
                                        title={`${growthChartData.labels[index]}: ${value} total users`}
                                    ></div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 rotate-45 origin-center">
                                        {growthChartData.labels[index]?.split(' ')[1]}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Feature Usage and Most Active Users */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Feature Usage */}
                <div className="card p-6">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        🎯 Feature Usage (Last 7 Days)
                    </h3>
                    <div className="space-y-3">
                        {featureUsageData.slice(0, 8).map((feature, index) => (
                            <div key={feature.feature} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ 
                                        backgroundColor: `hsl(${(index * 47) % 360}, 70%, 50%)` 
                                    }}></div>
                                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                        {feature.displayName}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {feature.count}
                                    </span>
                                    <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                        {feature.percentage}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Most Active Users */}
                <div className="card p-6">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        🏆 Most Active Users (Last 7 Days)
                    </h3>
                    <div className="space-y-3">
                        {engagementMetrics?.mostActiveUsers.slice(0, 8).map((user) => (
                            <div key={user.userId} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                                        {(user.displayName || user.username).charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                            {user.displayName || user.username}
                                        </div>
                                        {user.displayName && (
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                @{user.username}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {user.activityCount}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        activities
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Peak Usage Info */}
            <div className="card p-6">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    📊 Usage Insights
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                        <div className="text-2xl mb-2">⏰</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Peak Hour Today</div>
                        <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {formatHour(dashboardStats?.peakHour)}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl mb-2">🆕</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">New Users Today</div>
                        <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {dashboardStats?.newUsersToday || 0}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl mb-2">🔄</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">7-Day Retention</div>
                        <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {engagementMetrics?.retentionRate || 0}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                <p>
                    Analytics data is updated in real-time. Last refreshed: {new Date().toLocaleTimeString()}
                </p>
            </div>
        </div>
    );
}