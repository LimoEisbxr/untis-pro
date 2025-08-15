import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './index.css';

type User = {
    id: string;
    username: string;
    displayName?: string | null;
    isAdmin?: boolean;
    // school was removed server-side; keeping optional for backward compat
    school?: string;
};

type ViteImportMeta = { env?: { VITE_API_BASE?: string } };
const API_BASE: string | undefined = (import.meta as unknown as ViteImportMeta)
    .env?.VITE_API_BASE;

async function api<T>(
    path: string,
    opts: RequestInit & { token?: string } = {}
): Promise<T> {
    const url = API_BASE
        ? `${String(API_BASE).replace(/\/$/, '')}${path}`
        : path;
    const res = await fetch(url, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
            ...(opts.headers || {}),
        },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

function Login({ onAuth }: { onAuth: (token: string, user: User) => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(kind: 'login' | 'register') {
        setLoading(true);
        setError(null);
        try {
            const body = {
                username,
                password,
                ...(kind === 'register' && displayName ? { displayName } : {}),
            };
            const res = await api<{ token: string; user: User }>(
                `/api/auth/${kind}`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                }
            );
            onAuth(res.token, res.user);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || 'Failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100 text-slate-900 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100">
            <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/80 backdrop-blur p-6 shadow-xl dark:bg-slate-900/80 dark:border-slate-700/50">
                <div className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent text-2xl font-semibold">
                    Untis Pro
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                    Sign in or create an account
                </p>
                <div className="mt-6 space-y-3">
                    <input
                        className="input"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                        className="input"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <input
                        className="input"
                        placeholder="Display name (register only)"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                    />
                    {error && (
                        <div className="text-red-600 text-sm">{error}</div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button
                            disabled={loading}
                            className="btn-primary"
                            onClick={() => submit('login')}
                        >
                            Login
                        </button>
                        <button
                            disabled={loading}
                            className="btn-secondary"
                            onClick={() => submit('register')}
                        >
                            Register
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

type TimetableResponse = {
    userId: string;
    rangeStart: string | null;
    rangeEnd: string | null;
    payload: unknown;
};

function MoonIcon({
    className = 'h-5 w-5 text-slate-900 dark:text-white',
}: {
    className?: string;
}) {
    // Elegant outline crescent (Feather-style)
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
            focusable="false"
        >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    );
}

function addDays(d: Date, days: number) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd;
}
// Monday as start of week
function startOfWeek(d: Date) {
    const nd = new Date(d);
    const dow = nd.getDay();
    const diff = (dow === 0 ? -6 : 1) - dow;
    return addDays(nd, diff);
}
function pad(n: number) {
    return n < 10 ? `0${n}` : String(n);
}
// Format local date for <input type="date"> (avoid UTC shift)
function fmtLocal(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Dashboard({
    token,
    user,
    onLogout,
    dark,
    setDark,
}: {
    token: string;
    user: User;
    onLogout: () => void;
    dark: boolean;
    setDark: (v: boolean) => void;
}) {
    const [start, setStart] = useState<string>(() =>
        fmtLocal(startOfWeek(new Date()))
    );
    const [end, setEnd] = useState<string>(() =>
        fmtLocal(addDays(startOfWeek(new Date()), 6))
    );
    const [mine, setMine] = useState<TimetableResponse | null>(null);
    // Searchable user dropdown state
    const [queryText, setQueryText] = useState('');
    const [results, setResults] = useState<
        Array<{ id: string; username: string; displayName: string | null }>
    >([]);
    const [selectedUser, setSelectedUser] = useState<{
        id: string;
        username: string;
        displayName: string | null;
    } | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const [loading, setLoading] = useState(false);
    const query = useMemo(() => {
        const p = new URLSearchParams();
        if (start) p.set('start', start);
        if (end) p.set('end', end);
        const q = p.toString();
        return q ? `?${q}` : '';
    }, [start, end]);

    const loadMine = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api<TimetableResponse>(
                `/api/timetable/me${query}`,
                { token }
            );
            setMine(res);
        } finally {
            setLoading(false);
        }
    }, [query, token]);

    const loadUser = useCallback(
        async (userId: string) => {
            setLoading(true);
            try {
                const res = await api<TimetableResponse>(
                    `/api/timetable/user/${userId}${query}`,
                    { token }
                );
                setMine(res);
            } finally {
                setLoading(false);
            }
        },
        [query, token]
    );

    useEffect(() => {
        loadMine();
    }, [loadMine]);

    // Search users with debounce
    useEffect(() => {
        const q = queryText.trim();
        if (!q) {
            setResults([]);
            return;
        }
        const h = setTimeout(async () => {
            abortRef.current?.abort();
            const ac = new AbortController();
            abortRef.current = ac;
            try {
                const url = API_BASE
                    ? `${String(API_BASE).replace(
                          /\/$/,
                          ''
                      )}/api/users/search?q=${encodeURIComponent(q)}`
                    : `/api/users/search?q=${encodeURIComponent(q)}`;
                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                });
                if (!res.ok) throw new Error('Search failed');
                const data = await res.json();
                setResults(Array.isArray(data.users) ? data.users : []);
            } catch (e: unknown) {
                if (
                    e &&
                    typeof e === 'object' &&
                    (e as { name?: string }).name === 'AbortError'
                )
                    return;
                setResults([]);
            }
        }, 250);
        return () => clearTimeout(h);
    }, [queryText, token]);

    return (
        <div className={'min-h-screen'}>
            <header className="header-blur">
                <div className="mx-auto flex max-w-screen-2xl items-center justify-between p-4">
                    <div className="bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 bg-clip-text text-transparent font-semibold">
                        Untis Pro
                    </div>
                    <div className="flex items-center gap-3">
                        {user.isAdmin && (
                            <a
                                href="#admin"
                                className="text-sm link-admin"
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.dispatchEvent(
                                        new CustomEvent('nav', {
                                            detail: { view: 'admin' },
                                        })
                                    );
                                }}
                            >
                                Admin
                            </a>
                        )}
                        <button
                            className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
                            title="Toggle dark mode"
                            onClick={() => setDark(!dark)}
                            aria-label="Toggle dark mode"
                        >
                            {dark ? (
                                // Sun icon (white)
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
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            {user.displayName || user.username}
                        </div>
                        <button className="btn-secondary" onClick={onLogout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-screen-2xl p-4">
                <section className="card p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex items-center gap-2">
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    const ns = fmtLocal(
                                        addDays(new Date(start), -7)
                                    );
                                    const ne = fmtLocal(
                                        addDays(new Date(end), -7)
                                    );
                                    setStart(ns);
                                    setEnd(ne);
                                }}
                            >
                                ← Prev week
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    const s = startOfWeek(new Date());
                                    setStart(fmtLocal(s));
                                    setEnd(fmtLocal(addDays(s, 6)));
                                }}
                            >
                                This week
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    const ns = fmtLocal(
                                        addDays(new Date(start), 7)
                                    );
                                    const ne = fmtLocal(
                                        addDays(new Date(end), 7)
                                    );
                                    setStart(ns);
                                    setEnd(ne);
                                }}
                            >
                                Next week →
                            </button>
                        </div>
                        {/* Searchable dropdown + Home */}
                        <div className="flex items-end gap-2">
                            <div>
                                <label className="label">Find student</label>
                                <div className="relative">
                                    <input
                                        className="input pr-9"
                                        placeholder="Search name or username"
                                        value={queryText}
                                        onChange={(e) =>
                                            setQueryText(e.target.value)
                                        }
                                    />
                                    {/* dropdown */}
                                    {results.length > 0 && (
                                        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                                            <ul className="max-h-60 overflow-auto py-1 text-sm">
                                                {results.map((r) => (
                                                    <li key={r.id}>
                                                        <button
                                                            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                                                            onClick={() => {
                                                                setSelectedUser(
                                                                    r
                                                                );
                                                                setQueryText(
                                                                    r.displayName ||
                                                                        r.username
                                                                );
                                                                setResults([]);
                                                                if (
                                                                    r.id !==
                                                                    user.id
                                                                )
                                                                    loadUser(
                                                                        r.id
                                                                    );
                                                                else loadMine();
                                                            }}
                                                        >
                                                            <div className="font-medium">
                                                                {r.displayName ||
                                                                    r.username}
                                                            </div>
                                                            {r.displayName && (
                                                                <div className="text-xs text-slate-500">
                                                                    {r.username}
                                                                </div>
                                                            )}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="pb-0.5">
                                <label className="label invisible">Home</label>
                                <button
                                    className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    title="My timetable"
                                    onClick={() => {
                                        setSelectedUser(null);
                                        setQueryText('');
                                        loadMine();
                                    }}
                                    aria-label="Load my timetable"
                                >
                                    {/* Home icon */}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        className="h-5 w-5 text-slate-900 dark:text-white"
                                    >
                                        <path d="M3 10.5 12 3l9 7.5" />
                                        <path d="M5 10v10h14V10" />
                                        <path d="M9 21v-6h6v6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="label">Start</label>
                            <input
                                type="date"
                                className="input"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">End</label>
                            <input
                                type="date"
                                className="input"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </div>
                        <button
                            className="btn-primary"
                            onClick={() =>
                                selectedUser && selectedUser.id !== user.id
                                    ? loadUser(selectedUser.id)
                                    : loadMine()
                            }
                            disabled={loading}
                        >
                            Reload
                        </button>
                        <div className="ml-auto text-sm text-slate-600 dark:text-slate-300">
                            Week: {start} → {end}
                        </div>
                    </div>
                    <div className="mt-4">
                        <Timetable data={mine} weekStart={new Date(start)} />
                    </div>
                </section>
            </main>
        </div>
    );
}

export default function App() {
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem('token')
    );
    const [user, setUser] = useState<User | null>(() => {
        const u = localStorage.getItem('user');
        return u ? (JSON.parse(u) as User) : null;
    });
    const [dark, setDark] = useState<boolean>(
        () => localStorage.getItem('theme') === 'dark'
    );

    useEffect(() => {
        const root = document.documentElement;
        if (dark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [dark]);

    function onAuth(tok: string, u: User) {
        localStorage.setItem('token', tok);
        localStorage.setItem('user', JSON.stringify(u));
        setToken(tok);
        setUser(u);
    }
    function onLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }

    const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');

    useEffect(() => {
        function onNav(e: Event) {
            const detail = (e as CustomEvent).detail as { view?: string };
            if (detail?.view === 'admin') setView('admin');
        }
        window.addEventListener('nav', onNav as EventListener);
        return () => window.removeEventListener('nav', onNav as EventListener);
    }, []);

    if (!token || !user) return <Login onAuth={onAuth} />;

    if (view === 'admin' && user.isAdmin) {
        return (
            <AdminPage
                token={token}
                onBack={() => setView('dashboard')}
                onLogout={onLogout}
                dark={dark}
                setDark={setDark}
            />
        );
    }

    return (
        <Dashboard
            token={token}
            user={user}
            onLogout={onLogout}
            dark={dark}
            setDark={setDark}
        />
    );
}

function AdminPage({
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

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api<{
                users: Array<{
                    id: string;
                    username: string;
                    displayName: string | null;
                }>;
            }>('/api/admin/users', { token });
            setUsers(res.users);
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

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className={'min-h-screen'}>
            <header className="header-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
                    <div className="bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 bg-clip-text text-transparent font-semibold">
                        Admin
                    </div>
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
            </main>
        </div>
    );
}

type Lesson = {
    id: number;
    date: number; // yyyymmdd
    startTime: number; // Untis HHmm integer, e.g., 740 => 07:40
    endTime: number; // Untis HHmm integer, e.g., 825 => 08:25
    su?: Array<{ id: number; name: string; longname?: string }>;
    te?: Array<{ id: number; name: string; longname?: string }>;
    ro?: Array<{ id: number; name: string; longname?: string }>;
    code?: string; // e.g. 'cancelled'
    activityType?: string;
};

function Timetable({
    data,
    weekStart,
}: {
    data: TimetableResponse | null;
    weekStart: Date;
}) {
    const START_MIN = 7 * 60 + 40; // 07:40
    const END_MIN = 17 * 60 + 15; // 17:15
    const totalMinutes = END_MIN - START_MIN;
    // Responsive scale: aim for ~80% of viewport height, min 540px
    const [SCALE, setSCALE] = useState<number>(1);
    const BOTTOM_PAD_PX = 12; // extra space below last entry
    const containerHeight = totalMinutes * SCALE + BOTTOM_PAD_PX;

    useEffect(() => {
        function computeScale() {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
            const desired = Math.max(540, Math.floor(vh * 0.8));
            setSCALE(desired / totalMinutes);
        }
        computeScale();
        window.addEventListener('resize', computeScale);
        return () => window.removeEventListener('resize', computeScale);
    }, [totalMinutes]);

    // Build Monday..Friday dates from provided weekStart
    const monday = startOfWeek(weekStart);
    const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));

    const lessonsByDay = useMemo(() => {
        const byDay: Record<string, Lesson[]> = {};
        for (const d of days) byDay[fmtLocal(d)] = [];
        const lessons = Array.isArray(data?.payload)
            ? (data?.payload as Lesson[])
            : [];
        for (const l of lessons) {
            const dStr = yyyymmddToISO(l.date);
            if (byDay[dStr]) byDay[dStr].push(l);
        }
        // sort by startTime per day
        for (const k of Object.keys(byDay))
            byDay[k].sort(
                (a, b) =>
                    untisToMinutes(a.startTime) - untisToMinutes(b.startTime)
            );
        return byDay;
    }, [data?.payload, days]);

    const hasLessons = useMemo(
        () => Object.values(lessonsByDay).some((arr) => arr.length > 0),
        [lessonsByDay]
    );

    if (!data)
        return (
            <div className="text-sm text-slate-600 dark:text-slate-300">
                Loading…
            </div>
        );
    if (!hasLessons)
        return (
            <div className="rounded-lg border border-dashed p-4 text-center text-slate-600 dark:text-slate-300">
                No timetable for this week.
            </div>
        );

    return (
        <div className="w-full overflow-x-auto">
            <div
                className="min-w-[800px] grid gap-x-3"
                style={{ gridTemplateColumns: '80px repeat(5, 1fr)' }}
            >
                {/* Header */}
                <div />
                {days.map((d) => (
                    <div
                        key={fmtLocal(d)}
                        className="px-1.5 first:pl-3 last:pr-3 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200"
                    >
                        {d.toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: '2-digit',
                            day: '2-digit',
                        })}
                    </div>
                ))}

                {/* Time column */}
                <div className="relative" style={{ height: containerHeight }}>
                    {hourMarks(START_MIN, END_MIN).map((m) => (
                        <div
                            key={m.min}
                            className="absolute right-2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400"
                            style={{ top: (m.min - START_MIN) * SCALE }}
                        >
                            {m.label}
                        </div>
                    ))}
                </div>

                {/* Day columns */}
                {days.map((d) => {
                    const key = fmtLocal(d);
                    const items = lessonsByDay[key] || [];
                    // Build overlap-aware layout for this day's items
                    type Block = {
                        l: Lesson;
                        startMin: number;
                        endMin: number;
                        colIndex: number;
                        colCount: number;
                    };
                    const blocks: Block[] = (() => {
                        // prepare events with converted minutes and clamped range
                        const evs = items
                            .map((l) => {
                                const s = clamp(
                                    untisToMinutes(l.startTime),
                                    START_MIN,
                                    END_MIN
                                );
                                const e = Math.max(
                                    s,
                                    clamp(
                                        untisToMinutes(l.endTime),
                                        START_MIN,
                                        END_MIN
                                    )
                                );
                                return { l, startMin: s, endMin: e };
                            })
                            .sort(
                                (a, b) =>
                                    a.startMin - b.startMin ||
                                    a.endMin - b.endMin
                            );

                        // group into clusters of overlapping events
                        const clusters: Array<typeof evs> = [];
                        let current: typeof evs = [];
                        let curMaxEnd = -1;
                        for (const ev of evs) {
                            if (
                                current.length === 0 ||
                                ev.startMin < curMaxEnd
                            ) {
                                current.push(ev);
                                curMaxEnd = Math.max(curMaxEnd, ev.endMin);
                            } else {
                                clusters.push(current);
                                current = [ev];
                                curMaxEnd = ev.endMin;
                            }
                        }
                        if (current.length) clusters.push(current);

                        const out: Block[] = [];
                        for (const cl of clusters) {
                            // greedy column assignment within cluster
                            const columns: Array<typeof cl> = [];
                            const placement = new Map<
                                (typeof cl)[number],
                                number
                            >();
                            for (const ev of cl) {
                                let placed = false;
                                for (let i = 0; i < columns.length; i++) {
                                    const col = columns[i];
                                    const last = col[col.length - 1];
                                    if (ev.startMin >= last.endMin) {
                                        col.push(ev);
                                        placement.set(ev, i);
                                        placed = true;
                                        break;
                                    }
                                }
                                if (!placed) {
                                    columns.push([ev]);
                                    placement.set(ev, columns.length - 1);
                                }
                            }
                            const colCount = Math.max(1, columns.length);
                            for (const ev of cl) {
                                out.push({
                                    l: ev.l,
                                    startMin: ev.startMin,
                                    endMin: ev.endMin,
                                    colIndex: placement.get(ev)!,
                                    colCount,
                                });
                            }
                        }
                        return out;
                    })();

                    return (
                        <div
                            key={key}
                            className="relative px-1.5 first:pl-3 last:pr-3"
                            style={{ height: containerHeight }}
                        >
                            {/* 30-min guide lines */}
                            <div
                                className="absolute inset-0 opacity-60 dark:opacity-40 pointer-events-none"
                                style={{
                                    backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${
                                        30 * SCALE - 1
                                    }px, rgba(100,116,139,0.12) ${
                                        30 * SCALE - 1
                                    }px, rgba(100,116,139,0.12) ${
                                        30 * SCALE
                                    }px)`,
                                }}
                            />
                            {/* Lesson blocks */}
                            {blocks.map((b) => {
                                const { l } = b;
                                const top = (b.startMin - START_MIN) * SCALE;
                                const height = Math.max(
                                    14,
                                    (b.endMin - b.startMin) * SCALE
                                );
                                const cancelled = l.code === 'cancelled';
                                const subject =
                                    l.su?.[0]?.name ?? l.activityType ?? '—';
                                const room = l.ro
                                    ?.map((r) => r.name)
                                    .join(', ');
                                const teacher = l.te
                                    ?.map((t) => t.name)
                                    .join(', ');
                                // percentage-based gutter between columns
                                const GAP_PCT = 1.5;
                                const widthPct =
                                    (100 - GAP_PCT * (b.colCount - 1)) /
                                    b.colCount;
                                const leftPct =
                                    b.colIndex * (widthPct + GAP_PCT);
                                // enforce a small vertical gap between near-adjacent entries by padding top and shrinking height
                                const PAD_TOP = 4;
                                const PAD_BOTTOM = 4;
                                const adjTop = top + PAD_TOP;
                                const adjHeight = Math.max(
                                    12,
                                    height - (PAD_TOP + PAD_BOTTOM)
                                );
                                return (
                                    <div
                                        key={l.id}
                                        className={`absolute rounded-md p-2 text-xs ring-1 ring-slate-900/15 dark:ring-white/20 overflow-hidden ${
                                            cancelled
                                                ? 'bg-rose-500/90 text-white'
                                                : 'bg-gradient-to-r from-indigo-500 to-emerald-600 text-white'
                                        }`}
                                        style={{
                                            top: adjTop,
                                            height: adjHeight,
                                            left: `${leftPct}%`,
                                            width: `${widthPct}%`,
                                        }}
                                        title={`${fmtHM(b.startMin)}–${fmtHM(
                                            b.endMin
                                        )} | ${subject} ${
                                            room ? `| ${room}` : ''
                                        } ${teacher ? `| ${teacher}` : ''}`}
                                    >
                                        <div className="flex h-full min-w-0 flex-col">
                                            <div className="flex items-start justify-between gap-2 min-w-0">
                                                <div className="min-w-0">
                                                    <div className="font-semibold truncate">
                                                        {subject}
                                                    </div>
                                                    <div className="opacity-90 truncate">
                                                        {fmtHM(b.startMin)}–
                                                        {fmtHM(b.endMin)}
                                                    </div>
                                                    {teacher && (
                                                        <div className="opacity-90 truncate">
                                                            {teacher}
                                                        </div>
                                                    )}
                                                </div>
                                                {room && (
                                                    <div className="min-w-0 max-w-[45%] text-right">
                                                        <div className="truncate">
                                                            {room}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {cancelled && (
                                                <div className="absolute bottom-1 right-2 text-right text-[10px] font-semibold uppercase tracking-wide">
                                                    Cancelled
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function hourMarks(startMin: number, endMin: number) {
    const marks: Array<{ min: number; label: string }> = [];
    // start from the next full hour after startMin (e.g., 08:00)
    let m = Math.ceil(startMin / 60) * 60;
    for (; m <= endMin; m += 60) marks.push({ min: m, label: fmtHM(m) });
    return marks;
}

function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v));
}

function yyyymmddToISO(n: number) {
    const s = String(n);
    const y = Number(s.slice(0, 4));
    const mo = Number(s.slice(4, 6));
    const d = Number(s.slice(6, 8));
    return fmtLocal(new Date(y, mo - 1, d));
}

function fmtHM(totalMin: number) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${pad(h)}:${pad(m)}`;
}

// Convert Untis compact HHmm integer (e.g., 740, 1018) to minutes since midnight
function untisToMinutes(hhmm: number) {
    const h = Math.floor(hhmm / 100);
    const m = hhmm % 100;
    return h * 60 + m;
}
