import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '../types';
import {
    getSharingSettings,
    updateSharingEnabled,
    shareWithUser,
    stopSharingWithUser,
    updateGlobalSharing,
    searchUsersToShare,
    api,
    type SharingSettings,
    updateUserDisplayName,
    updateMyDisplayName,
} from '../api';

export default function SettingsModal({
    token,
    user,
    isOpen,
    onClose,
    onUserUpdate,
}: {
    token: string;
    user: User;
    isOpen: boolean;
    onClose: () => void;
    onUserUpdate?: (u: User) => void;
}) {
    // Close/open animation state with enter transition
    const [showModal, setShowModal] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const ANIM_MS = 200;
    useEffect(() => {
        let t: number | undefined;
        let raf1: number | undefined;
        let raf2: number | undefined;
        if (isOpen) {
            if (!showModal) setShowModal(true);
            // Start hidden, then two RAFs to ensure layout is applied before transition
            setIsVisible(false);
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setIsVisible(true));
            });
        } else if (showModal) {
            // Trigger exit transition then unmount after duration
            setIsVisible(false);
            t = window.setTimeout(() => {
                setShowModal(false);
            }, ANIM_MS);
        }
        return () => {
            if (t) window.clearTimeout(t);
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
    }, [isOpen, showModal]);

    const [settings, setSettings] = useState<SharingSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<
        Array<{ id: string; username: string; displayName?: string }>
    >([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimeoutRef = useRef<number | undefined>(undefined);

    // User management state for admin users
    const [users, setUsers] = useState<
        Array<{ id: string; username: string; displayName: string | null }>
    >([]);
    const [userManagementLoading, setUserManagementLoading] = useState(false);
    const [userManagementError, setUserManagementError] = useState<
        string | null
    >(null);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editDisplayName, setEditDisplayName] = useState('');

    // Self display name editing (regular users and admins editing their own name)
    const [myDisplayName, setMyDisplayName] = useState<string>(
        user.displayName ?? ''
    );
    const [savingMyName, setSavingMyName] = useState(false);
    const [myNameError, setMyNameError] = useState<string | null>(null);
    const [myNameSaved, setMyNameSaved] = useState(false);

    const loadUsers = useCallback(async () => {
        setUserManagementLoading(true);
        setUserManagementError(null);
        try {
            const response = await api<{
                users: Array<{
                    id: string;
                    username: string;
                    displayName: string | null;
                }>;
            }>('/api/admin/users', { token });
            setUsers(response.users);
        } catch (e) {
            setUserManagementError(
                e instanceof Error ? e.message : 'Failed to load users'
            );
        } finally {
            setUserManagementLoading(false);
        }
    }, [token]);

    const deleteUser = async (userId: string) => {
        if (!confirm('Delete this user?')) return;
        setUserManagementLoading(true);
        setUserManagementError(null);
        try {
            await api<{ ok: boolean }>(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                token,
            });
            await loadUsers();
        } catch (e) {
            setUserManagementError(
                e instanceof Error ? e.message : 'Failed to delete user'
            );
        } finally {
            setUserManagementLoading(false);
        }
    };

    const startEditUser = (uId: string, currentName: string | null) => {
        setEditingUserId(uId);
        setEditDisplayName(currentName ?? '');
    };
    const cancelEditUser = () => {
        setEditingUserId(null);
        setEditDisplayName('');
    };
    const saveEditUser = async (uId: string) => {
        setUserManagementLoading(true);
        setUserManagementError(null);
        try {
            const trimmed = editDisplayName.trim();
            const displayNameToSave = trimmed === '' ? null : trimmed;
            const result = await updateUserDisplayName(
                token,
                uId,
                displayNameToSave
            );
            setUsers((prev) =>
                prev.map((u) =>
                    u.id === uId
                        ? { ...u, displayName: result.user.displayName }
                        : u
                )
            );
            cancelEditUser();
        } catch (e) {
            setUserManagementError(
                e instanceof Error ? e.message : 'Failed to update user'
            );
        } finally {
            setUserManagementLoading(false);
        }
    };

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

    const loadSettings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getSharingSettings(token);
            setSettings(data);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to load settings'
            );
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Load settings when modal opens (with stable callbacks)
    useEffect(() => {
        if (isOpen) {
            loadSettings();
            if (user.isAdmin) loadUsers();
            setMyDisplayName(user.displayName ?? '');
            setMyNameSaved(false);
            setMyNameError(null);
        }
    }, [isOpen, user.isAdmin, user.displayName, loadSettings, loadUsers]);

    const handleToggleSharing = async (enabled: boolean) => {
        if (!settings) return;
        try {
            await updateSharingEnabled(token, enabled);
            setSettings({ ...settings, sharingEnabled: enabled });
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to update sharing'
            );
        }
    };

    const handleShareWithUser = async (targetUser: {
        id: string;
        username: string;
        displayName?: string;
    }) => {
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
            setError(
                e instanceof Error ? e.message : 'Failed to share with user'
            );
        }
    };

    const handleStopSharing = async (userId: string) => {
        if (!settings) return;
        try {
            await stopSharingWithUser(token, userId);
            setSettings({
                ...settings,
                sharingWith: settings.sharingWith.filter(
                    (u) => u.id !== userId
                ),
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
            setError(
                e instanceof Error
                    ? e.message
                    : 'Failed to update global sharing'
            );
        }
    };

    const saveMyDisplayName = async () => {
        setMyNameError(null);
        setMyNameSaved(false);
        setSavingMyName(true);
        try {
            const trimmed = myDisplayName.trim();
            const nameToSave = trimmed === '' ? null : trimmed;
            const result = await updateMyDisplayName(token, nameToSave);
            if (onUserUpdate)
                onUserUpdate({ ...user, displayName: result.user.displayName });
            setMyDisplayName(result.user.displayName ?? '');
            setMyNameSaved(true);
        } catch (e) {
            setMyNameError(
                e instanceof Error ? e.message : 'Failed to update display name'
            );
        } finally {
            setSavingMyName(false);
        }
    };

    if (!showModal) return null;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-lg backdrop-saturate-150 backdrop-contrast-125 transition-opacity duration-200 will-change-opacity ${
                isVisible
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 pointer-events-none'
            }`}
        >
            <div
                className={`w-full ${
                    user.isAdmin ? 'max-w-3xl' : 'max-w-lg'
                } bg-white/75 dark:bg-slate-800/80 backdrop-blur-md ring-1 ring-black/10 dark:ring-white/10 rounded-lg shadow-xl max-h-[90vh] overflow-hidden transform transition-all duration-200 will-change-transform will-change-opacity ${
                    isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2'
                }`}
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-inner ring-1 ring-white/20 dark:ring-black/20">
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                className="text-white"
                            >
                                <path
                                    d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="3"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold leading-none text-slate-900 dark:text-slate-100">
                            Settings
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <path
                                d="M18 6L6 18M6 6l12 12"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                    {user.isAdmin ? (
                        // Admin User Management Section
                        <>
                            {userManagementLoading ? (
                                <div className="p-6 text-center text-slate-600 dark:text-slate-400">
                                    Loading users...
                                </div>
                            ) : userManagementError ? (
                                <div className="p-6 text-center text-red-600 dark:text-red-400">
                                    {userManagementError}
                                </div>
                            ) : (
                                <div className="p-6">
                                    {/* Global sharing control */}
                                    {settings && (
                                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-medium text-red-800 dark:text-red-200">
                                                        Global Sharing Control
                                                    </h4>
                                                    <p className="text-sm text-red-600 dark:text-red-300">
                                                        Disable all timetable
                                                        sharing for everyone
                                                    </p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            settings.globalSharingEnabled
                                                        }
                                                        onChange={(e) =>
                                                            handleToggleGlobalSharing(
                                                                e.target.checked
                                                            )
                                                        }
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-red-600"></div>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                            Users
                                        </h3>
                                        <button
                                            className="btn-primary text-sm"
                                            onClick={loadUsers}
                                            disabled={userManagementLoading}
                                        >
                                            Refresh
                                        </button>
                                    </div>

                                    {/* Users table */}
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800">
                                                <tr>
                                                    <th className="py-3 px-4 text-left text-slate-600 dark:text-slate-300 font-medium">
                                                        Username
                                                    </th>
                                                    <th className="py-3 px-4 text-left text-slate-600 dark:text-slate-300 font-medium">
                                                        Display name
                                                    </th>
                                                    <th className="py-3 px-4 text-left text-slate-600 dark:text-slate-300 font-medium">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {users.map((u, index) => (
                                                    <tr
                                                        key={u.id}
                                                        className={`${
                                                            index !==
                                                            users.length - 1
                                                                ? 'border-b border-slate-200 dark:border-slate-700'
                                                                : ''
                                                        }`}
                                                    >
                                                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                                                            {u.username}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                            {editingUserId ===
                                                            u.id ? (
                                                                <div className="flex items-center gap-2 w-full">
                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            editDisplayName
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setEditDisplayName(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        placeholder="Display name"
                                                                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                                                                    />
                                                                    <button
                                                                        className="btn-primary text-xs px-2 py-1"
                                                                        onClick={() =>
                                                                            saveEditUser(
                                                                                u.id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            userManagementLoading
                                                                        }
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        className="btn-secondary text-xs px-2 py-1"
                                                                        onClick={
                                                                            cancelEditUser
                                                                        }
                                                                        disabled={
                                                                            userManagementLoading
                                                                        }
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span>
                                                                    {u.displayName ||
                                                                        '—'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {editingUserId ===
                                                            u.id ? null : (
                                                                <>
                                                                    <button
                                                                        className="btn-secondary text-sm mr-2"
                                                                        onClick={() =>
                                                                            startEditUser(
                                                                                u.id,
                                                                                u.displayName
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            userManagementLoading
                                                                        }
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm px-3 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                        onClick={() =>
                                                                            deleteUser(
                                                                                u.id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            userManagementLoading
                                                                        }
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {users.length === 0 && (
                                                    <tr>
                                                        <td
                                                            colSpan={3}
                                                            className="py-8 text-center text-slate-500 dark:text-slate-400"
                                                        >
                                                            No users found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        // Regular User Sharing Settings Section
                        <>
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
                                    {/* Personal display name */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">
                                            Display name
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={myDisplayName}
                                                onChange={(e) => {
                                                    setMyDisplayName(
                                                        e.target.value
                                                    );
                                                    setMyNameSaved(false);
                                                }}
                                                placeholder="Optional friendly name"
                                                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <button
                                                className="btn-primary"
                                                onClick={saveMyDisplayName}
                                                disabled={savingMyName}
                                            >
                                                Save
                                            </button>
                                        </div>
                                        {myNameError && (
                                            <div className="mt-1 text-sm text-red-600 dark:text-red-400">
                                                {myNameError}
                                            </div>
                                        )}
                                        {myNameSaved && !myNameError && (
                                            <div className="mt-1 text-sm text-green-600 dark:text-green-400">
                                                Saved
                                            </div>
                                        )}
                                    </div>

                                    {/* Personal sharing toggle */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-slate-900 dark:text-slate-100">
                                                Enable Timetable Sharing
                                            </h3>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Allow others to see your
                                                timetable
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    settings.sharingEnabled
                                                }
                                                onChange={(e) =>
                                                    handleToggleSharing(
                                                        e.target.checked
                                                    )
                                                }
                                                disabled={
                                                    !settings.globalSharingEnabled
                                                }
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                                        </label>
                                    </div>

                                    {settings.globalSharingEnabled ? (
                                        <>
                                            {/* Search and add users */}
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-slate-900 dark:text-slate-100">
                                                    Share with new people
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Search users by name or username..."
                                                        value={searchQuery}
                                                        onChange={(e) =>
                                                            setSearchQuery(
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    {searchLoading && (
                                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                                            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                        </div>
                                                    )}
                                                </div>
                                                {searchResults.length > 0 && (
                                                    <div className="mt-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 max-h-40 overflow-y-auto">
                                                        {searchResults.map(
                                                            (result) => (
                                                                <button
                                                                    key={
                                                                        result.id
                                                                    }
                                                                    onClick={() =>
                                                                        handleShareWithUser(
                                                                            result
                                                                        )
                                                                    }
                                                                    disabled={settings.sharingWith.some(
                                                                        (u) =>
                                                                            u.id ===
                                                                            result.id
                                                                    )}
                                                                    className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-slate-100"
                                                                >
                                                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                                                        {result.displayName ||
                                                                            result.username}
                                                                    </div>
                                                                    {result.displayName && (
                                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                            {
                                                                                result.username
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Current sharing list */}
                                            <div>
                                                <h3 className="font-medium mb-3 text-slate-900 dark:text-slate-100">
                                                    People you're sharing with (
                                                    {
                                                        settings.sharingWith
                                                            .length
                                                    }
                                                    )
                                                </h3>
                                                {settings.sharingWith.length ===
                                                0 ? (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-700 rounded-md">
                                                        You're not sharing your
                                                        timetable with anyone
                                                        yet.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {settings.sharingWith.map(
                                                            (sharedUser) => (
                                                                <div
                                                                    key={
                                                                        sharedUser.id
                                                                    }
                                                                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-md"
                                                                >
                                                                    <div>
                                                                        <div className="font-medium text-slate-900 dark:text-slate-100">
                                                                            {sharedUser.displayName ||
                                                                                sharedUser.username}
                                                                        </div>
                                                                        {sharedUser.displayName && (
                                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                                {
                                                                                    sharedUser.username
                                                                                }
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={() =>
                                                                            handleStopSharing(
                                                                                sharedUser.id
                                                                            )
                                                                        }
                                                                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded"
                                                                        title="Stop sharing"
                                                                    >
                                                                        <svg
                                                                            width="16"
                                                                            height="16"
                                                                            viewBox="0 0 24 24"
                                                                            fill="none"
                                                                        >
                                                                            <path
                                                                                d="M18 6L6 18M6 6l12 12"
                                                                                stroke="currentColor"
                                                                                strokeWidth="2"
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                            />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-md">
                                            <p className="text-slate-600 dark:text-slate-400">
                                                Timetable sharing is currently
                                                disabled by an administrator.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
