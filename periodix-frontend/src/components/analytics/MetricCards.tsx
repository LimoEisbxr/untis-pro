import type {
    DashboardStats,
    UserEngagementMetrics,
    AnalyticsDetailMetric,
} from '../../api';

export function MetricCards({
    dashboard,
    engagement,
    onOpen,
}: {
    dashboard: DashboardStats | null;
    engagement: UserEngagementMetrics | null;
    onOpen: (m: AnalyticsDetailMetric) => void;
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                            Total Users
                        </p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                            {dashboard?.totalUsers || 0}
                        </p>
                    </div>
                    <div className="text-blue-500 text-2xl">👥</div>
                </div>
            </div>
            <div
                className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 cursor-pointer"
                onClick={() => onOpen('active_today')}
                title="View active users today"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-green-600 dark:text-green-400 text-sm font-medium">
                            Active Today
                        </p>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                            {dashboard?.activeUsersToday || 0}
                        </p>
                    </div>
                    <div className="text-green-500 text-2xl">✨</div>
                </div>
            </div>
            <div
                className="bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-900/20 dark:to-violet-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 cursor-pointer"
                onClick={() => onOpen('logins_today')}
                title="See who logged in today"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">
                            Logins Today
                        </p>
                        <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                            {dashboard?.totalLoginsToday || 0}
                        </p>
                    </div>
                    <div className="text-purple-500 text-2xl">🔑</div>
                </div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                            Retention Rate
                        </p>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                            {engagement?.retentionRate || 0}%
                        </p>
                    </div>
                    <div className="text-amber-500 text-2xl">📈</div>
                </div>
            </div>
        </div>
    );
}
