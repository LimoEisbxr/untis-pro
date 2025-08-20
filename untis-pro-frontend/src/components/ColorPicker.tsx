import { useState } from 'react';
import {
    generateGradient,
    gradientToTailwindClasses,
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
    fallbackColor?: string; // used for preview when no currentColor (e.g., admin default)
    canRemoveFallback?: boolean; // allow showing trash when only fallbackColor exists (e.g., admin)
    className?: string;
}

export default function ColorPicker({
    currentColor,
    onColorChange,
    onRemoveColor,
    fallbackColor,
    canRemoveFallback = false,
    className = '',
}: ColorPickerProps) {
    const [customColor, setCustomColor] = useState(currentColor || '#3b82f6');
    const [showCustomInput, setShowCustomInput] = useState(false);
    // Default collapsed
    const [isExpanded, setIsExpanded] = useState(false);

    const handlePresetClick = (color: string) => {
        onColorChange(color);
    };

    const handleCustomColorChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const color = e.target.value;
        setCustomColor(color);
        if (isValidHexColor(color)) {
            onColorChange(color);
        }
    };

    const handleCustomInputChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const color = e.target.value;
        setCustomColor(color);
    };

    const handleCustomSubmit = () => {
        if (isValidHexColor(customColor)) {
            onColorChange(customColor);
            setShowCustomInput(false);
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
                        Choose Color
                    </span>
                </button>
                <div className="flex items-center gap-2">
                    {/* Mini preview swatch */}
                    {(() => {
                        const previewColor =
                            currentColor ?? fallbackColor ?? null;
                        const bg = previewColor
                            ? gradientToTailwindClasses(
                                  generateGradient(previewColor)
                              )
                            : 'linear-gradient(to right, #6366f1, #0ea5e9, #10b981)';
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
                                onClick={onRemoveColor}
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
                                      generateGradient(previewColor)
                                  )
                                : 'linear-gradient(to right, #6366f1, #0ea5e9, #10b981)';
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

                    {/* Preset Colors */}
                    <div className="grid grid-cols-6 gap-2">
                        {PRESET_COLORS.map((color) => (
                            <button
                                key={color}
                                className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 hover:shadow-md ${
                                    currentColor === color
                                        ? 'border-slate-900 dark:border-slate-100 shadow-md'
                                        : 'border-slate-300 dark:border-slate-600'
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => handlePresetClick(color)}
                                title={color}
                                type="button"
                            />
                        ))}
                    </div>

                    {/* Custom Color Controls */}
                    <div className="space-y-3">
                        {!showCustomInput ? (
                            <button
                                onClick={() => setShowCustomInput(true)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
                                        className="w-12 h-8 rounded border border-slate-300 dark:border-slate-600"
                                    />
                                    <input
                                        type="text"
                                        value={customColor}
                                        onChange={handleCustomInputChange}
                                        placeholder="#3b82f6"
                                        className="flex-1 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCustomSubmit}
                                        disabled={!isValidHexColor(customColor)}
                                        className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        type="button"
                                    >
                                        Apply
                                    </button>
                                    <button
                                        onClick={() =>
                                            setShowCustomInput(false)
                                        }
                                        className="flex-1 px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                                        type="button"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
