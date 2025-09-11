export function FeatureUsageList({
    features,
}: {
    features: Array<{
        feature: string;
        count: number;
        percentage: number;
        displayName: string;
    }>;
}) {
    return (
        <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                🎯 Feature Usage (Last 7 Days)
            </h3>
            <div className="space-y-3">
                {features.slice(0, 8).map((feature, index) => (
                    <div
                        key={feature.feature}
                        className="flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                    backgroundColor: `hsl(${
                                        (index * 47) % 360
                                    },70%,50%)`,
                                }}
                            />
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
    );
}
