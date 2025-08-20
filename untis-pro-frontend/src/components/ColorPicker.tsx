import { useState } from 'react';
import { generateGradient, gradientToTailwindClasses, isValidHexColor } from '../utils/colors';

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
    className?: string;
}

export default function ColorPicker({ 
    currentColor, 
    onColorChange, 
    onRemoveColor,
    className = '' 
}: ColorPickerProps) {
    const [customColor, setCustomColor] = useState(currentColor || '#3b82f6');
    const [showCustomInput, setShowCustomInput] = useState(false);

    const handlePresetClick = (color: string) => {
        onColorChange(color);
    };

    const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value;
        setCustomColor(color);
        if (isValidHexColor(color)) {
            onColorChange(color);
        }
    };

    const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        <div className={`space-y-4 ${className}`}>
            <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Choose Color
                </h4>
                
                {/* Color Preview */}
                {currentColor && (
                    <div className="mb-3">
                        <div 
                            className="w-full h-12 rounded-lg border border-slate-300 dark:border-slate-600"
                            style={{ 
                                background: gradientToTailwindClasses(generateGradient(currentColor))
                            }}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
                            Preview: {currentColor}
                        </p>
                    </div>
                )}

                {/* Preset Colors */}
                <div className="grid grid-cols-6 gap-2 mb-4">
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
                        />
                    ))}
                </div>

                {/* Custom Color Controls */}
                <div className="space-y-3">
                    {!showCustomInput ? (
                        <button
                            onClick={() => setShowCustomInput(true)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
                                >
                                    Apply
                                </button>
                                <button
                                    onClick={() => setShowCustomInput(false)}
                                    className="flex-1 px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Remove Color Button */}
                {onRemoveColor && currentColor && (
                    <button
                        onClick={onRemoveColor}
                        className="w-full mt-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        Reset to Default
                    </button>
                )}
            </div>
        </div>
    );
}