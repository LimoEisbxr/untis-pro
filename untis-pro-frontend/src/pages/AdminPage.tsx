import { useCallback, useEffect, useState } from 'react';
import MoonIcon from '../components/MoonIcon';
import { api, getDefaultLessonColors, setDefaultLessonColor, updateUserDisplayName } from '../api';
import ColorPicker from '../components/ColorPicker';
import type { LessonColors } from '../types';

export default function AdminPage({
    token,
    onBack,
    onLogout,
    dark,
    setDark,
}: {
    token: string;
    onBack: () => void;
    onLogout: () => void;
    dark: boolean;
    setDark: (v: boolean) => void;
}) {
    const [users, setUsers] = useState<
        Array<{ id: string; username: string; displayName: string | null }>
    >([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [defaultColors, setDefaultColors] = useState<LessonColors>({});
    const [newLessonName, setNewLessonName] = useState('');
    const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [editDisplayName, setEditDisplayName] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [usersRes, defaultColorsRes] = await Promise.all([
                api<{
                    users: Array<{
                        id: string;
                        username: string;
                        displayName: string | null;
                    }>;
                }>('/api/admin/users', { token }),
                getDefaultLessonColors(token),
            ]);
            setUsers(usersRes.users);
            setDefaultColors(defaultColorsRes);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [token]);

    async function del(id: string) {
        if (!confirm('Delete this user?')) return;
        setLoading(true);
        setError(null);
        try {
            await api<{ ok: boolean }>(`/api/admin/users/${id}`, {
                method: 'DELETE',
                token,
            });
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    const handleSetDefaultColor = useCallback(async (lessonName: string, color: string) => {
        try {
            await setDefaultLessonColor(token, lessonName, color);
            setDefaultColors(prev => ({ ...prev, [lessonName]: color }));
            setShowColorPicker(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [token]);

    const handleAddNewDefault = useCallback(async () => {
        const lessonName = newLessonName.trim();
        if (!lessonName) return;
        
        try {
            const defaultColor = '#3b82f6'; // blue-500
            await setDefaultLessonColor(token, lessonName, defaultColor);
            setDefaultColors(prev => ({ ...prev, [lessonName]: defaultColor }));
            setNewLessonName('');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [token, newLessonName]);

    const handleEditUser = useCallback((userId: string, currentDisplayName: string | null) => {
        setEditingUser(userId);
        setEditDisplayName(currentDisplayName || '');
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingUser(null);
        setEditDisplayName('');
    }, []);

    const handleSaveDisplayName = useCallback(async (userId: string) => {
        setLoading(true);
        setError(null);
        try {
            const trimmedName = editDisplayName.trim();
            const displayNameToSave = trimmedName === '' ? null : trimmedName;
            const result = await updateUserDisplayName(token, userId, displayNameToSave);
            
            // Update the users state with the new display name
            setUsers(prev => prev.map(user => 
                user.id === userId 
                    ? { ...user, displayName: result.user.displayName }
                    : user
            ));
            setEditingUser(null);
            setEditDisplayName('');
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [token, editDisplayName]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className={'min-h-screen'}>
            <header className="header-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
                    <div className="logo-text text-xl sm:text-2xl">Admin</div>
                    <div className="flex items-center gap-3">
                        <button className="btn-secondary" onClick={onBack}>
                            Back
                        </button>
                        <button
                            className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
                            title="Toggle dark mode"
                            onClick={() => setDark(!dark)}
                            aria-label="Toggle dark mode"
                        >
                            {dark ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="h-5 w-5 text-white"
                                >
                                    <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
                                    <path
                                        fillRule="evenodd"
                                        d="M12 2.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75Zm0 16.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V19.5a.75.75 0 0 1 .75-.75Zm9-6a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5H20.25a.75.75 0 0 1 .75.75Zm-16.5 0a.75.75 0 0 1-.75.75H2.25a.75.75 0 0 1 0-1.5H3.75a.75.75 0 0 1 .75.75ZM18.53 5.47a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.061-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM7.59 16.41a.75.75 0 0 1 0 1.061L6.53 18.53a.75.75 0 1 1-1.06-1.061l1.06-1.06a.75.75 0 0 1 1.06 0ZM18.53 18.53a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 0 1 1.06-1.061l1.06 1.06c.293.293.293.768 0 1.061ZM7.59 7.59A.75.75 0 0 1 6.53 6.53L5.47 5.47a.75.75 0 1 1 1.06-1.06l1.06 1.06c.293.293.293.768 0 1.061Z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            ) : (
                                <MoonIcon />
                            )}
                        </button>
                        <button className="btn-secondary" onClick={onLogout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-6xl p-4">
                <section className="card p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Users</h2>
                        <button
                            className="btn-primary"
                            onClick={load}
                            disabled={loading}
                        >
                            Refresh
                        </button>
                    </div>
                    {error && (
                        <div className="mt-2 text-sm text-red-600">{error}</div>
                    )}
                    <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-slate-600 dark:text-slate-300">
                                <tr>
                                    <th className="py-2 pr-4">Username</th>
                                    <th className="py-2 pr-4">Display name</th>
                                    <th className="py-2 pr-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr
                                        key={u.id}
                                        className="border-t border-slate-200/70 dark:border-slate-700/70"
                                    >
                                        <td className="py-2 pr-4">
                                            {u.username}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {editingUser === u.id ? (
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={editDisplayName}
                                                        onChange={(e) => setEditDisplayName(e.target.value)}
                                                        placeholder="Display name"
                                                        className="input text-sm"
                                                        style={{ minWidth: '120px' }}
                                                    />
                                                    <button
                                                        className="btn-primary text-xs px-2 py-1"
                                                        onClick={() => handleSaveDisplayName(u.id)}
                                                        disabled={loading}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        className="btn-secondary text-xs px-2 py-1"
                                                        onClick={handleCancelEdit}
                                                        disabled={loading}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span>{u.displayName || '—'}</span>
                                                    <button
                                                        className="btn-secondary text-xs px-2 py-1"
                                                        onClick={() => handleEditUser(u.id, u.displayName)}
                                                        disabled={loading}
                                                    >
                                                        Edit
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2 pr-4">
                                            <button
                                                className="btn-secondary"
                                                onClick={() => del(u.id)}
                                                disabled={loading}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && !loading && (
                                    <tr>
                                        <td
                                            colSpan={3}
                                            className="py-4 text-center text-slate-500"
                                        >
                                            No users
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Default Lesson Colors Section */}
                <section className="card p-4 mt-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Default Lesson Colors</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Set default colors for lesson types
                        </p>
                    </div>
                    
                    {/* Add New Default Color */}
                    <div className="mt-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <h3 className="text-md font-medium mb-3">Add New Default</h3>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={newLessonName}
                                onChange={(e) => setNewLessonName(e.target.value)}
                                placeholder="Lesson name (e.g., Math, English)"
                                className="input flex-1"
                            />
                            <button
                                onClick={handleAddNewDefault}
                                disabled={!newLessonName.trim() || loading}
                                className="btn-primary"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Existing Default Colors */}
                    <div className="mt-4">
                        {Object.keys(defaultColors).length === 0 ? (
                            <p className="text-center text-slate-500 py-8">
                                No default colors set. Add some above.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(defaultColors).map(([lessonName, color]) => (
                                    <div 
                                        key={lessonName}
                                        className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-medium">{lessonName}</h4>
                                            <button
                                                onClick={() => setShowColorPicker(
                                                    showColorPicker === lessonName ? null : lessonName
                                                )}
                                                className="btn-secondary text-xs"
                                            >
                                                {showColorPicker === lessonName ? 'Cancel' : 'Edit'}
                                            </button>
                                        </div>
                                        
                                        <div 
                                            className="w-full h-12 rounded-md border border-slate-300 dark:border-slate-600 mb-3"
                                            style={{ 
                                                background: `linear-gradient(to right, ${color}, ${color})`
                                            }}
                                        />
                                        
                                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                            {color}
                                        </p>
                                        
                                        {showColorPicker === lessonName && (
                                            <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                                                <ColorPicker
                                                    currentColor={color}
                                                    onColorChange={(newColor) => handleSetDefaultColor(lessonName, newColor)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
