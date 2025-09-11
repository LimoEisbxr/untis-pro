import { useEffect, useState } from 'react';
import {
    trackActivity,
    getUserInsight,
    type UserInsightSummary,
} from '../../api';

interface Props {
    userId: string | null;
    onClose: () => void;
    token: string;
}

export function UserInsightModal({ userId, onClose, token }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [insight, setInsight] = useState<UserInsightSummary | null>(null);

    const load = () => {
        if (!userId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        setInsight(null);
        (async () => {
            try {
                await trackActivity(token, 'view_user_insight', {
                    targetUserId: userId,
                });
                const res = await getUserInsight(token, userId);
                console.debug('[UserInsightModal] fetched insight', res);
                if (!res || !res.insight)
                    throw new Error('No insight data returned');
                if (!cancelled) setInsight(res.insight);
            } catch (e) {
                if (!cancelled) {
                    console.error('[UserInsightModal] load failed', e);
                    const msg =
                        e instanceof Error
                            ? e.message
                            : 'Failed to load insight';
                    // Friendlier translation for common permission errors
                    if (/401|403/.test(msg)) {
                        setError(
                            'Not authorized to view user insights. (Admin or user-manager required)'
                        );
                    } else {
                        setError(msg);
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    };
    useEffect(() => {
        const cleanup = load();
        return cleanup;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    if (!userId) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-start justify-center p-4 md:p-6 pt-16 md:pt-20"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-insight-title"
        >
            <div
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative z-10 w-full max-w-3xl mx-auto mt-0">
                <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl shadow-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col max-h-[86vh] w-full overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between flex-shrink-0 w-full">
                        <h3
                            id="user-insight-title"
                            className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"
                        >
                            <span className="text-base leading-none">
                                👤 User Insights
                            </span>
                            {insight && (
                                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                    {insight.username}
                                </span>
                            )}
                        </h3>
                        <button
                            className="btn-secondary h-8 px-3 text-xs"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                    <div className="px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto text-sm scroll-area-native space-y-8 w-full flex-1 text-left min-w-0 text-slate-800 dark:text-slate-200">
                        <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                                ID:
                                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded select-all">
                                    {userId}
                                </span>
                            </span>
                            {loading && (
                                <span className="animate-pulse">Loading…</span>
                            )}
                            {error && (
                                <span className="text-red-500 dark:text-red-400 normal-case">
                                    {error}
                                </span>
                            )}
                            {!loading && !error && insight && (
                                <span className="text-green-600 dark:text-green-400">
                                    Loaded
                                </span>
                            )}
                        </div>
                        {loading ? (
                            <div className="text-slate-600 dark:text-slate-300">
                                Loading…
                            </div>
                        ) : error ? (
                            <div className="text-red-600 dark:text-red-300 space-y-4">
                                <p className="font-medium">{error}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Check if your account has the required role
                                    or if the backend user activity table has
                                    entries for this user.
                                </p>
                                <button
                                    onClick={() => load()}
                                    className="btn-secondary text-xs"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8 w-full min-w-0">
                                {insight && (
                                    <>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs w-full min-w-0">
                                            <div>
                                                <p className="text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                                    Username
                                                </p>
                                                <div className="font-medium text-slate-800 dark:text-slate-200 break-all">
                                                    {insight.displayName ||
                                                        insight.username}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                                    User ID
                                                </p>
                                                <div className="font-mono text-slate-700 dark:text-slate-300 break-all text-[11px] max-w-[200px] overflow-x-auto whitespace-nowrap">
                                                    {insight.userId}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                                    Total Activities
                                                </p>
                                                <div className="text-slate-800 dark:text-slate-200 font-medium">
                                                    {insight.totalActivities}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                                    Today Activities
                                                </p>
                                                <div className="text-slate-800 dark:text-slate-200 font-medium">
                                                    {insight.todayActivityCount}
                                                </div>
                                            </div>
                                            {insight.avgSessionMinutesToday !==
                                                undefined && (
                                                <div>
                                                    <p className="text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                                        Avg Session (Today)
                                                    </p>
                                                    <div className="text-slate-800 dark:text-slate-200 font-medium">
                                                        {
                                                            insight.avgSessionMinutesToday
                                                        }
                                                        m
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
                                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 tracking-wide uppercase">
                                                Feature Usage (30d)
                                            </h4>
                                            {insight.featureUsage.length ===
                                            0 ? (
                                                <p className="text-slate-500 dark:text-slate-400 text-xs">
                                                    No activity.
                                                </p>
                                            ) : (
                                                <div className="overflow-x-auto max-w-full w-full">
                                                    <table className="w-full text-xs table-fixed break-words border-collapse">
                                                        <thead>
                                                            <tr className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wide">
                                                                <th className="text-left font-medium pb-1 w-5/12">
                                                                    Feature
                                                                </th>
                                                                <th className="text-right font-medium pb-1 w-3/12">
                                                                    Count
                                                                </th>
                                                                <th className="text-right font-medium pb-1 w-2/12">
                                                                    %
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {insight.featureUsage
                                                                .slice(0, 15)
                                                                .map(
                                                                    (
                                                                        f: UserInsightSummary['featureUsage'][number]
                                                                    ) => (
                                                                        <tr
                                                                            key={
                                                                                f.feature
                                                                            }
                                                                            className="border-t border-slate-100 dark:border-slate-800"
                                                                        >
                                                                            <td
                                                                                className="py-1 pr-2 break-words align-top"
                                                                                title={
                                                                                    f.feature
                                                                                }
                                                                            >
                                                                                {
                                                                                    f.feature
                                                                                }
                                                                            </td>
                                                                            <td className="py-1 text-right tabular-nums">
                                                                                {
                                                                                    f.count
                                                                                }
                                                                            </td>
                                                                            <td className="py-1 text-right tabular-nums">
                                                                                {
                                                                                    f.percentage
                                                                                }
                                                                                %
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
                                            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 tracking-wide uppercase">
                                                Recent Activity
                                            </h4>
                                            {insight.recentActivities.length ===
                                            0 ? (
                                                <p className="text-slate-500 dark:text-slate-400 text-xs">
                                                    No recent actions.
                                                </p>
                                            ) : (
                                                <div className="overflow-x-auto max-w-full w-full">
                                                    <table className="w-full text-xs font-mono table-fixed break-words border-collapse">
                                                        <thead>
                                                            <tr className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wide">
                                                                <th className="text-left font-medium pb-1 w-7/12">
                                                                    Action
                                                                </th>
                                                                <th className="text-right font-medium pb-1 w-3/12">
                                                                    Time
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {insight.recentActivities.map(
                                                                (
                                                                    a: UserInsightSummary['recentActivities'][number],
                                                                    idx: number
                                                                ) => (
                                                                    <tr
                                                                        key={
                                                                            idx
                                                                        }
                                                                        className="border-t border-slate-100 dark:border-slate-800"
                                                                    >
                                                                        <td
                                                                            className="py-1 pr-3 break-words align-top"
                                                                            title={
                                                                                a.action
                                                                            }
                                                                        >
                                                                            {
                                                                                a.action
                                                                            }
                                                                        </td>
                                                                        <td className="py-1 text-right text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                                                                            {new Date(
                                                                                a.createdAt
                                                                            ).toLocaleTimeString(
                                                                                [],
                                                                                {
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit',
                                                                                }
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                {!insight && !error && !loading && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        No activity data for this user.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
