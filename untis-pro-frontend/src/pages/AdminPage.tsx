import { useCallback, useEffect, useState } from 'react';
import MoonIcon from '../components/MoonIcon';
import { api } from '../api';

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
    // Removed default lesson color functionality (no longer needed)

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const usersRes = await api<{
                users: Array<{
                    id: string;
                    username: string;
                    displayName: string | null;
                }>;
            }>('/api/admin/users', { token });
            setUsers(usersRes.users);
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
                                            {u.displayName || '—'}
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

                {/* Default Lesson Colors section removed */}
            </main>
        </div>
    );
}
