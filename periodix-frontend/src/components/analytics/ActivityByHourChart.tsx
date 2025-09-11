export function ActivityByHourChart({
    labels,
    data,
    max,
}: {
    labels: string[];
    data: number[];
    max: number;
}) {
    return (
        <div className="card p-6">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                📊 Today's Activity by Hour
            </h3>
            <div className="overflow-x-auto">
                <div className="h-64 flex items-end gap-1 sm:gap-1.5 px-1 min-w-[720px] sm:min-w-0 sm:justify-between">
                    {data.map((value, index) => {
                        const height = (value / max) * 100;
                        const showLabel = index % 3 === 0;
                        return (
                            <div
                                key={index}
                                className="flex flex-col items-center gap-1 w-6 sm:flex-1"
                            >
                                <div className="hidden sm:block text-xs text-slate-600 dark:text-slate-400 font-mono">
                                    {value > 0 ? value : ''}
                                </div>
                                <div
                                    className="bg-gradient-to-t from-sky-500 to-sky-300 dark:from-sky-600 dark:to-sky-400 rounded-t min-h-[2px] w-full"
                                    style={{
                                        height: `${Math.max(height, 2)}%`,
                                    }}
                                    title={`${labels[index]}: ${value} activities`}
                                />
                                <div
                                    className={`text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 rotate-45 origin-center ${
                                        showLabel ? '' : 'invisible sm:visible'
                                    }`}
                                >
                                    {labels[index]?.split(':')[0]}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
