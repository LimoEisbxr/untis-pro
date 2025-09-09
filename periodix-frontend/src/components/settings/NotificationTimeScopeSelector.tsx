// no explicit React import needed with modern JSX runtime

type Scope = 'day' | 'week';

interface Props {
    name: string;
    value?: Scope;
    onChange: (value: Scope) => void;
    disabled?: boolean;
    className?: string;
}

export default function NotificationTimeScopeSelector({
    name,
    value,
    onChange,
    disabled = false,
    className,
}: Props) {
    return (
        <div
            className={
                className ??
                'mt-2 flex items-center gap-4 text-xs text-slate-700 dark:text-slate-300'
            }
        >
            <label
                className={`inline-flex items-center gap-2 ${
                    disabled ? 'opacity-60' : ''
                }`}
            >
                <input
                    type="radio"
                    name={name}
                    value="day"
                    checked={value === 'day'}
                    onChange={() => onChange('day')}
                    disabled={disabled}
                    className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                />
                <span>Today</span>
            </label>
            <label
                className={`inline-flex items-center gap-2 ${
                    disabled ? 'opacity-60' : ''
                }`}
            >
                <input
                    type="radio"
                    name={name}
                    value="week"
                    checked={value === 'week'}
                    onChange={() => onChange('week')}
                    disabled={disabled}
                    className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                />
                <span>This week</span>
            </label>
        </div>
    );
}
