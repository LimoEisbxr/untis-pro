import { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { 
    getSharingSettings, 
    updateSharingEnabled, 
    shareWithUser, 
    stopSharingWithUser, 
    updateGlobalSharing,
    searchUsersToShare,
    type SharingSettings
} from '../api';

export default function SettingsModal({
    token,
    isOpen,
    onClose,
}: {
    token: string;
    user: User;
    isOpen: boolean;
    onClose: () => void;
}) {
    const [settings, setSettings] = useState<SharingSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; displayName?: string }>>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimeoutRef = useRef<number | undefined>(undefined);

    // Load settings when modal opens
    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    // Search for users to share with
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const results = await searchUsersToShare(token, searchQuery);
                setSearchResults(results.users);
            } catch (e) {
                console.error('Search failed:', e);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, token]);

    const loadSettings = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getSharingSettings(token);
            setSettings(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load settings');
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
            setError(e instanceof Error ? e.message : 'Failed to update sharing');
        }
    };

    const handleShareWithUser = async (targetUser: { id: string; username: string; displayName?: string }) => {
        if (!settings) return;
        try {
            await shareWithUser(token, targetUser.id);
            setSettings({
                ...settings,
                sharingWith: [...settings.sharingWith, targetUser],
            });
            setSearchQuery('');
            setSearchResults([]);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to share with user');
        }
    };

    const handleStopSharing = async (userId: string) => {
        if (!settings) return;
        try {
            await stopSharingWithUser(token, userId);
            setSettings({
                ...settings,
                sharingWith: settings.sharingWith.filter(u => u.id !== userId),
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to stop sharing');
        }
    };

    const handleToggleGlobalSharing = async (enabled: boolean) => {
        if (!settings) return;
        try {
            await updateGlobalSharing(token, enabled);
            setSettings({ ...settings, globalSharingEnabled: enabled });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update global sharing');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-lg shadow-xl max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
                                <path d="M17 8h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M7 8H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M12 4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M10 2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold">Sharing Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                    {loading ? (
                        <div className="p-6 text-center text-slate-600 dark:text-slate-400">
                            Loading settings...
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    ) : settings ? (
                        <div className="p-6 space-y-6">
                            {/* Global sharing toggle (admin only) */}
                            {settings.isAdmin && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-red-800 dark:text-red-200">
                                                Global Sharing Control
                                            </h3>
                                            <p className="text-sm text-red-600 dark:text-red-300">
                                                Disable all timetable sharing for everyone
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.globalSharingEnabled}
                                                onChange={(e) => handleToggleGlobalSharing(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-red-600"></div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Personal sharing toggle */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">Enable Timetable Sharing</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        Allow others to see your timetable
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.sharingEnabled}
                                        onChange={(e) => handleToggleSharing(e.target.checked)}
                                        disabled={!settings.globalSharingEnabled}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                                </label>
                            </div>

                            {settings.globalSharingEnabled && (
                                <>
                                    {/* Search and add users */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Share with new people
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search users by name or username..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            {searchLoading && (
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                </div>
                                            )}
                                        </div>
                                        {searchResults.length > 0 && (
                                            <div className="mt-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 max-h-40 overflow-y-auto">
                                                {searchResults.map((result) => (
                                                    <button
                                                        key={result.id}
                                                        onClick={() => handleShareWithUser(result)}
                                                        disabled={settings.sharingWith.some(u => u.id === result.id)}
                                                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <div className="font-medium">
                                                            {result.displayName || result.username}
                                                        </div>
                                                        {result.displayName && (
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                {result.username}
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Current sharing list */}
                                    <div>
                                        <h3 className="font-medium mb-3">
                                            People you're sharing with ({settings.sharingWith.length})
                                        </h3>
                                        {settings.sharingWith.length === 0 ? (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-700 rounded-md">
                                                You're not sharing your timetable with anyone yet.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {settings.sharingWith.map((sharedUser) => (
                                                    <div
                                                        key={sharedUser.id}
                                                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-md"
                                                    >
                                                        <div>
                                                            <div className="font-medium">
                                                                {sharedUser.displayName || sharedUser.username}
                                                            </div>
                                                            {sharedUser.displayName && (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {sharedUser.username}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => handleStopSharing(sharedUser.id)}
                                                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded"
                                                            title="Stop sharing"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {!settings.globalSharingEnabled && (
                                <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-md">
                                    <p className="text-slate-600 dark:text-slate-400">
                                        Timetable sharing is currently disabled by an administrator.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}