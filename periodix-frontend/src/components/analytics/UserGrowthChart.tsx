export function UserGrowthChart({
    labels,
    data,
}: {
    labels: string[];
    data: number[];
}) {
    if (!data.length) return null;
    const maxValue = Math.max(...data, 1);
    return (
        <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                📈 User Growth (Last 30 Days)
            </h3>
            <div className="h-64 flex items-end justify-between gap-1">
                {data.map((value, index) => {
                    const height = (value / maxValue) * 100;
                    return (
                        <div
                            key={index}
                            className="flex flex-col items-center gap-1 flex-1"
                        >
                            <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                {value}
                            </div>
                            <div
                                className="bg-gradient-to-t from-emerald-500 to-emerald-300 dark:from-emerald-600 dark:to-emerald-400 rounded-t min-h-[2px] w-full"
                                style={{ height: `${Math.max(height, 2)}%` }}
                                title={`${labels[index]}: ${value} total users`}
                            />
                            <div className="text-xs text-slate-500 dark:text-slate-400 rotate-45 origin-center">
                                {labels[index]?.split(' ')[1]}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
