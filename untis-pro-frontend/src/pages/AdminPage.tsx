import { useCallback, useEffect, useState } from 'react';
import MoonIcon from '../components/MoonIcon';
import { api, updateUserDisplayName, listWhitelist, addWhitelistRule, deleteWhitelistRule, grantUserManagerStatus, revokeUserManagerStatus, type WhitelistRule } from '../api';

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
        Array<{ id: string; username: string; displayName: string | null; isUserManager: boolean }>
    >([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Removed default lesson color functionality (no longer needed)
    const [editingUser, setEditingUser] = useState<string | null>(null);
    const [editDisplayName, setEditDisplayName] = useState('');

    // Whitelist UI state (username-only)
    const [whitelist, setWhitelist] = useState<WhitelistRule[]>([]);
    const [wlValue, setWlValue] = useState('');

    // User-manager status management state
    const [userManagerChanging, setUserManagerChanging] = useState<string | null>(null);
    const [showConfirmUserManager, setShowConfirmUserManager] = useState<{ userId: string; username: string; isGranting: boolean } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const usersRes = await api<{
                users: Array<{
                    id: string;
                    username: string;
                    displayName: string | null;
                    isUserManager: boolean;
                }>;
            }>('/api/admin/users', { token });
            setUsers(usersRes.users);
            const wl = await listWhitelist(token);
            setWhitelist(wl.rules);
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

    // Removed handlers related to default lesson colors.

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

    const handleAddRule = useCallback(async () => {
        const value = wlValue.trim();
        if (!value) return;
        setLoading(true);
        setError(null);
        try {
            await addWhitelistRule(token, value);
            setWlValue('');
            const wl = await listWhitelist(token);
            setWhitelist(wl.rules);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [token, wlValue]);

    const handleDeleteRule = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            await deleteWhitelistRule(token, id);
            setWhitelist(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [token]);

    // User-manager status management handlers
    const handleToggleUserManager = useCallback((user: { id: string; username: string; isUserManager: boolean }) => {
        setShowConfirmUserManager({
            userId: user.id,
            username: user.username,
            isGranting: !user.isUserManager
        });
    }, []);

    const handleConfirmUserManagerChange = useCallback(async () => {
        if (!showConfirmUserManager) return;
        
        setUserManagerChanging(showConfirmUserManager.userId);
        setError(null);
        try {
            const result = showConfirmUserManager.isGranting 
                ? await grantUserManagerStatus(token, showConfirmUserManager.userId)
                : await revokeUserManagerStatus(token, showConfirmUserManager.userId);
            
            // Update the users state with the new user-manager status
            setUsers(prev => prev.map(user => 
                user.id === showConfirmUserManager.userId 
                    ? { ...user, isUserManager: result.user.isUserManager }
                    : user
            ));
            setShowConfirmUserManager(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setUserManagerChanging(null);
        }
    }, [token, showConfirmUserManager, grantUserManagerStatus, revokeUserManagerStatus]);

    const handleCancelUserManagerChange = useCallback(() => {
        setShowConfirmUserManager(null);
    }, []);

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
                                    <th className="py-2 pr-4">User Manager</th>
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
                                            <div className="flex items-center gap-2">
                                                <span className={u.isUserManager ? "text-green-600 dark:text-green-400" : "text-slate-400"}>
                                                    {u.isUserManager ? "✓ Manager" : "—"}
                                                </span>
                                                <button
                                                    className={u.isUserManager ? "btn-secondary" : "btn-primary"}
                                                    onClick={() => handleToggleUserManager(u)}
                                                    disabled={loading || userManagerChanging === u.id}
                                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                                >
                                                    {userManagerChanging === u.id ? '...' : u.isUserManager ? 'Revoke' : 'Grant'}
                                                </button>
                                            </div>
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
                                            colSpan={4}
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

                {/* Whitelist management */}
                <section className="card p-4 mt-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Whitelist</h2>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                            className="input"
                            placeholder={'Enter username'}
                            value={wlValue}
                            onChange={(e) => setWlValue(e.target.value)}
                        />
                        <button className="btn-primary" onClick={handleAddRule}>
                            Add
                        </button>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-left text-slate-700 dark:text-slate-200">
                                <tr>
                                    <th className="py-2 pr-4">Username</th>
                                    <th className="py-2 pr-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {whitelist.map((r) => (
                                    <tr key={r.id} className="border-t border-slate-200/70 dark:border-slate-700/70">
                                        <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">{r.value}</td>
                                        <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">
                                            <button className="btn-secondary" onClick={() => handleDeleteRule(r.id)}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {whitelist.length === 0 && (
                                    <tr>
                                        <td colSpan={2} className="py-4 text-center text-slate-500">
                                            No usernames whitelisted
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Default Lesson Colors section removed */}
            </main>

            {/* User Manager Confirmation Modal */}
            {showConfirmUserManager && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md mx-4">
                        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
                            {showConfirmUserManager.isGranting ? 'Grant User Manager Status' : 'Revoke User Manager Status'}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            {showConfirmUserManager.isGranting ? (
                                <>
                                    Grant <strong>{showConfirmUserManager.username}</strong> user manager privileges? 
                                    They will be able to manage users, whitelist, and access requests.
                                </>
                            ) : (
                                <>
                                    Revoke user manager privileges from <strong>{showConfirmUserManager.username}</strong>? 
                                    They will lose access to user management features.
                                </>
                            )}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                className="btn-secondary"
                                onClick={handleCancelUserManagerChange}
                                disabled={userManagerChanging === showConfirmUserManager.userId}
                            >
                                Cancel
                            </button>
                            <button
                                className={showConfirmUserManager.isGranting ? "btn-primary" : "btn-secondary"}
                                onClick={handleConfirmUserManagerChange}
                                disabled={userManagerChanging === showConfirmUserManager.userId}
                            >
                                {userManagerChanging === showConfirmUserManager.userId ? 'Processing...' : (showConfirmUserManager.isGranting ? 'Grant' : 'Revoke')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
