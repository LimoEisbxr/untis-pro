import { useState, useEffect, useRef, useCallback } from 'react';
import {
    getSharingSettings,
    updateSharingEnabled,
    shareWithUser,
    stopSharingWithUser,
    searchUsersToShare,
    type SharingSettings as SharingSettingsType,
} from '../../api';

interface SharingSettingsProps {
    token: string;
    isVisible: boolean;
}

export default function SharingSettings({ token, isVisible }: SharingSettingsProps) {
    const [settings, setSettings] = useState<SharingSettingsType | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; displayName?: string }>>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimeoutRef = useRef<number | undefined>(undefined);

    // Load sharing settings when component becomes visible
    useEffect(() => {
        if (!isVisible) return;
        loadSettings();
    }, [isVisible, token]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadSettings = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getSharingSettings(token);
            setSettings(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load sharing settings');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSharing = async (enabled: boolean) => {
        if (!settings) return;
        try {
            await updateSharingEnabled(token, enabled);
            setSettings({ ...settings, sharingEnabled: enabled });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update sharing setting');
        }
    };

    const handleShareWithUser = async (userId: string) => {
        try {
            await shareWithUser(token, userId);
            await loadSettings(); // Reload to get updated sharing list
            setSearchQuery('');
            setSearchResults([]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to share with user');
        }
    };

    const handleStopSharing = async (userId: string) => {
        try {
            await stopSharingWithUser(token, userId);
            await loadSettings(); // Reload to get updated sharing list
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to stop sharing');
        }
    };

    // Search for users to share with
    const handleSearch = useCallback(
        async (query: string) => {
            if (!query.trim()) {
                setSearchResults([]);
                return;
            }

            setSearchLoading(true);
            try {
                const results = await searchUsersToShare(token, query);
                setSearchResults(results.users);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to search users');
            } finally {
                setSearchLoading(false);
            }
        },
        [token]
    );

    // Debounced search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = window.setTimeout(() => {
            handleSearch(searchQuery);
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, handleSearch]);

    if (loading) {
        return (
            <div className="p-6 text-center text-slate-600 dark:text-slate-400">
                Loading settings...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center text-red-600 dark:text-red-400">
                {error}
            </div>
        );
    }

    if (!settings) {
        return null;
    }

    // Remove conditional rendering since we handle visibility in parent

    return (
        <div className="space-y-6">
            {/* Sharing Settings */}
            <div>
                {settings.globalSharingEnabled ? (
                    <>
                        {/* Search and add users */}
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">
                                Share with users
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search for users..."
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                                />
                                {searchLoading && (
                                    <div className="absolute right-3 top-3">
                                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>

                            {/* Search results */}
                            {searchResults.length > 0 && (
                                <div className="mt-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {searchResults.map((result) => (
                                        <div
                                            key={result.id}
                                            className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-600"
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {result.displayName || result.username}
                                                </div>
                                                {result.displayName && (
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        @{result.username}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleShareWithUser(result.id)}
                                                className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded"
                                            >
                                                Share
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Currently sharing with */}
                        <div className="mt-6">
                            <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">
                                Sharing with
                            </label>
                            {settings.sharingWith.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Not sharing with anyone yet
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {settings.sharingWith.map((sharedUser) => (
                                        <div
                                            key={sharedUser.id}
                                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-md"
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {sharedUser.displayName || sharedUser.username}
                                                </div>
                                                {sharedUser.displayName && (
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        @{sharedUser.username}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleStopSharing(sharedUser.id)}
                                                className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Disable Timetable Sharing - Moved to bottom */}
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-slate-900 dark:text-slate-100">
                                        Disable Timetable Sharing
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        Stop sharing your timetable with people you've already shared with
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!settings.sharingEnabled}
                                        onChange={(e) => handleToggleSharing(!e.target.checked)}
                                        disabled={!settings.globalSharingEnabled}
                                        className="sr-only peer"
                                    />
                                    <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-red-600 peer-disabled:opacity-50"></div>
                                </label>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-300">
                            Sharing has been disabled by an administrator.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}