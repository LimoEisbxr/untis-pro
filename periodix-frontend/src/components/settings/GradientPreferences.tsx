import { useState, useEffect } from 'react';
import { getHideAdminDefaultsPreference, setHideAdminDefaultsPreference } from '../../utils/gradientPreferences';

interface GradientPreferencesProps {
    isVisible: boolean;
}

export default function GradientPreferences({
    isVisible,
}: GradientPreferencesProps) {
    const [hideAdminDefaults, setHideAdminDefaults] = useState(false);
    const [loading, setLoading] = useState(false);

    // Load preference from localStorage on mount
    useEffect(() => {
        if (isVisible) {
            setHideAdminDefaults(getHideAdminDefaultsPreference());
        }
    }, [isVisible]);

    // Save preference to localStorage
    const handleToggleChange = async (enabled: boolean) => {
        setLoading(true);
        try {
            setHideAdminDefaultsPreference(enabled);
            setHideAdminDefaults(enabled);
        } catch (error) {
            console.error('Failed to save gradient preference:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Gradient Preferences
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Control how lesson colors are displayed in your timetable.
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                            Hide Admin Default Colors
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            When enabled, lessons without your custom colors will use the default gradient instead of admin-set colors.
                        </p>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            <div className="space-y-1">
                                <div>• <strong>Off (default):</strong> Shows your custom colors → admin defaults → default gradient</div>
                                <div>• <strong>On:</strong> Shows your custom colors → default gradient (skips admin defaults)</div>
                            </div>
                        </div>
                    </div>
                    <div className="ml-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={hideAdminDefaults}
                                onChange={(e) => handleToggleChange(e.target.checked)}
                                disabled={loading}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                        </label>
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                        <div className="animate-spin rounded-full h-4 w-4 border border-current border-t-transparent"></div>
                        <span>Saving preference...</span>
                    </div>
                )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <svg
                        className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-medium mb-1">About this setting</p>
                        <p>
                            This preference only affects lessons where you haven't set a custom color. Your personal color choices always take priority.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}