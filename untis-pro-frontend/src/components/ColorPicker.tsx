import { useState, useRef, useCallback, useEffect } from 'react';
import {
    generateGradient,
    gradientToTailwindClasses,
    getDefaultGradient,
    isValidHexColor,
} from '../utils/colors';

const PRESET_COLORS = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#10b981', // emerald-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#6366f1', // indigo-500
    '#8b5cf6', // violet-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
    '#f43f5e', // rose-500
];

interface ColorPickerProps {
    currentColor?: string;
    onColorChange: (color: string) => void;
    onRemoveColor?: () => void;
    fallbackColor?: string;
    canRemoveFallback?: boolean;
    className?: string;
    gradientOffset?: number; // 0..1
    onGradientOffsetChange?: (offset: number) => void;
    isAdmin?: boolean;
}

export default function ColorPicker({
    currentColor,
    onColorChange,
    onRemoveColor,
    fallbackColor,
    canRemoveFallback = false,
    className = '',
    gradientOffset = 0.5,
    onGradientOffsetChange,
    isAdmin = false,
}: ColorPickerProps) {
    const [customColor, setCustomColor] = useState(currentColor || '#3b82f6');
    const [showCustomInput, setShowCustomInput] = useState(false);
    // Default collapsed
    const [isExpanded, setIsExpanded] = useState(false);

    // Debouncing logic to prevent rate limit hits
    const debounceTimer = useRef<number | null>(null);
    const DEBOUNCE_MS = 300;

    // Debounced version of onColorChange
    const debouncedOnColorChange = useCallback(
        (color: string) => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
            debounceTimer.current = window.setTimeout(() => {
                onColorChange(color);
                debounceTimer.current = null;
            }, DEBOUNCE_MS);
        },
        [onColorChange]
    );

    // Immediate call for onBlur/deselect events
    const immediateOnColorChange = useCallback(
        (color: string) => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                debounceTimer.current = null;
            }
            onColorChange(color);
        },
        [onColorChange]
    );

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    const handlePresetClick = (color: string) => {
        immediateOnColorChange(color);
    };

    const handleCustomColorChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const color = e.target.value;
        setCustomColor(color);
        if (isValidHexColor(color)) {
            debouncedOnColorChange(color);
        }
    };

    const handleCustomColorBlur = () => {
        if (isValidHexColor(customColor)) {
            immediateOnColorChange(customColor);
        }
    };

    const handleCustomInputChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const color = e.target.value;
        setCustomColor(color);
        if (isValidHexColor(color)) {
            debouncedOnColorChange(color);
        }
    };

    const handleCustomInputBlur = () => {
        if (isValidHexColor(customColor)) {
            immediateOnColorChange(customColor);
        }
    };

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Header with collapse toggle, mini preview, and trash icon */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={isExpanded ? 'Collapse' : 'Expand'}
                    aria-expanded={isExpanded}
                    type="button"
                >
                    <svg
                        className={`w-4 h-4 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Color Options
                    </span>
                </button>
                <div className="flex items-center gap-2">
                    {/* Mini preview swatch */}
                    {(() => {
                        const previewColor =
                            currentColor ?? fallbackColor ?? null;
                        const bg = previewColor
                            ? gradientToTailwindClasses(
                                  generateGradient(previewColor, gradientOffset)
                              )
                            : gradientToTailwindClasses(getDefaultGradient());
                        const title = currentColor
                            ? `Custom: ${currentColor}`
                            : fallbackColor
                            ? `Admin default: ${fallbackColor}`
                            : 'Default gradient';
                        const aria = currentColor
                            ? `Custom color ${currentColor}`
                            : fallbackColor
                            ? `Admin default color ${fallbackColor}`
                            : 'Default color';
                        return (
                            <div
                                className="w-8 h-5 rounded border border-slate-300 dark:border-slate-600"
                                title={title}
                                style={{ background: bg }}
                                aria-label={aria}
                            />
                        );
                    })()}
                    {/* Trash/reset icon */}
                    {onRemoveColor &&
                        currentColor &&
                        (canRemoveFallback ||
                            !fallbackColor ||
                            currentColor !== fallbackColor) && (
                            <button
                                onClick={() => {
                                    // Important: do NOT trigger offset persistence here.
                                    // Doing so can resend the color + offset and recreate a just-deleted admin default.
                                    onRemoveColor();
                                }}
                                className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:text-slate-400 transition-colors"
                                title="Remove custom color"
                                aria-label="Remove custom color"
                                type="button"
                            >
                                <svg
                                    className="w-4 h-4"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                >
                                    <path
                                        d="M3 6h18"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M8 6v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                                        strokeWidth="2"
                                    />
                                    <path
                                        d="M10 11v6M14 11v6"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </button>
                        )}
                </div>
            </div>

            {/* Expandable content */}
            {isExpanded && (
                <div className="space-y-4">
                    {/* Large preview */}
                    <div className="mb-1">
                        {(() => {
                            const previewColor =
                                currentColor ?? fallbackColor ?? null;
                            const bg = previewColor
                                ? gradientToTailwindClasses(
                                      generateGradient(
                                          previewColor,
                                          gradientOffset
                                      )
                                  )
                                : gradientToTailwindClasses(
                                      getDefaultGradient()
                                  );
                            const label = currentColor
                                ? `Preview: ${currentColor}`
                                : fallbackColor
                                ? `Preview (admin): ${fallbackColor}`
                                : 'Preview: default gradient';
                            return (
                                <>
                                    <div
                                        className="w-full h-12 rounded-lg border border-slate-300 dark:border-slate-600"
                                        style={{ background: bg }}
                                    />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
                                        {label}
                                    </p>
                                </>
                            );
                        })()}
                    </div>

                    {/* Preset Colors (responsive grid using full width) */}
                    <div
                        className="grid gap-2"
                        style={{
                            gridTemplateColumns:
                                'repeat(auto-fit,minmax(40px,1fr))',
                        }}
                    >
                        {PRESET_COLORS.map((color) => (
                            <div key={color} className="flex">
                                <button
                                    className={`flex-1 aspect-square rounded-md border-2 transition-all hover:shadow-md hover:-translate-y-px active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${
                                        currentColor === color
                                            ? 'border-slate-900 dark:border-slate-100 shadow-md'
                                            : 'border-slate-300 dark:border-slate-600'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => handlePresetClick(color)}
                                    title={color}
                                    type="button"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Gradient Offset Slider: only when user has a custom color override (not when using fallback/admin/default) */}
                    {(isAdmin ||
                        (currentColor &&
                            (!fallbackColor ||
                                currentColor !== fallbackColor))) && (
                        <div className="space-y-2 pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
                            <label className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                                <span>Gradient Offset</span>
                                <span className="tabular-nums text-[11px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 shadow-inner">
                                    {gradientOffset.toFixed(2)}
                                </span>
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={gradientOffset}
                                aria-label="Gradient offset (0 flat – 1 max variation)"
                                onChange={(e) =>
                                    onGradientOffsetChange?.(
                                        parseFloat(e.target.value)
                                    )
                                }
                                className="gradient-slider focus-visible:outline-none"
                                style={
                                    {
                                        ['--progress']: `${(
                                            gradientOffset * 100
                                        ).toFixed(2)}%`,
                                    } as React.CSSProperties
                                }
                            />
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                0 = flat, 1 = max variation.
                            </p>
                        </div>
                    )}

                    {/* Custom Color Controls */}
                    <div className="space-y-3">
                        {!showCustomInput ? (
                            <button
                                onClick={() => setShowCustomInput(true)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white/70 dark:bg-slate-700/40 text-slate-700 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 transition-colors"
                                type="button"
                            >
                                Custom Color...
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={customColor}
                                        onChange={handleCustomColorChange}
                                        onBlur={handleCustomColorBlur}
                                        className="w-12 h-8 rounded border border-slate-300 dark:border-slate-600"
                                    />
                                    <input
                                        type="text"
                                        value={customColor}
                                        onChange={handleCustomInputChange}
                                        onBlur={handleCustomInputBlur}
                                        placeholder="#3b82f6"
                                        className="flex-1 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() =>
                                            setShowCustomInput(false)
                                        }
                                        className="flex-1 px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                                        type="button"
                                    >
                                        Close
                                    </button>
                                </div>
                                {!isValidHexColor(customColor) && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                        Enter a valid 6-digit hex color.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
