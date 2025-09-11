import type {
    DashboardStats,
    UserEngagementMetrics,
    AnalyticsDetailMetric,
} from '../../api';

export function UsageInsights({
    dashboard,
    engagement,
    onOpen,
    formatHour,
}: {
    dashboard: DashboardStats | null;
    engagement: UserEngagementMetrics | null;
    onOpen: (m: AnalyticsDetailMetric) => void;
    formatHour: (h?: number) => string;
}) {
    return (
        <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                📊 Usage Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                    className="text-center cursor-pointer"
                    onClick={() => onOpen('new_users_today')}
                    title="See new users created today"
                >
                    <div className="text-2xl mb-2">⏰</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        Peak Hour Today
                    </div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        {formatHour(dashboard?.peakHour)}
                    </div>
                </div>
                <div
                    className="text-center cursor-pointer"
                    onClick={() => onOpen('new_users_today')}
                    title="See new users created today"
                >
                    <div className="text-2xl mb-2">🆕</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        New Users Today
                    </div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        {dashboard?.newUsersToday || 0}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-2xl mb-2">🔄</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        7-Day Retention
                    </div>
                    <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        {engagement?.retentionRate || 0}%
                    </div>
                </div>
            </div>
        </div>
    );
}
