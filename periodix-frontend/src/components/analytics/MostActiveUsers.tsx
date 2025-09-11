import type { UserEngagementMetrics } from '../../api';

export function MostActiveUsers({
    engagement,
    onUserClick,
}: {
    engagement: UserEngagementMetrics | null;
    onUserClick?: (userId: string) => void;
}) {
    return (
        <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                🏆 Most Active Users (Last 7 Days)
            </h3>
            <div className="space-y-3">
                {engagement?.mostActiveUsers.slice(0, 8).map((user) => (
                    <div
                        key={user.userId}
                        className="flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-2 py-1 cursor-pointer"
                        onClick={() => onUserClick?.(user.userId)}
                        title="View user analytics"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                                {(user.displayName || user.username)
                                    .charAt(0)
                                    .toUpperCase()}
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
    );
}
