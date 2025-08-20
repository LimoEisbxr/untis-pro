import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Timetable from '../components/Timetable';
import MoonIcon from '../components/MoonIcon';
import { api, API_BASE, getLessonColors, setLessonColor, removeLessonColor } from '../api';
import { addDays, fmtLocal, startOfWeek } from '../utils/dates';
import type { TimetableResponse, User, LessonColors } from '../types';

export default function Dashboard({
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
    // Selected date (week is derived from this)
    const [start, setStart] = useState<string>(() => fmtLocal(new Date()));
    const [mine, setMine] = useState<TimetableResponse | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
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
    const [lessonColors, setLessonColors] = useState<LessonColors>({});

    // Compute the week range based on the selected date
    const weekStartDate = useMemo(() => startOfWeek(new Date(start)), [start]);
    const weekStartStr = useMemo(
        () => fmtLocal(weekStartDate),
        [weekStartDate]
    );
    const weekEndStr = useMemo(
        () => fmtLocal(addDays(weekStartDate, 6)),
        [weekStartDate]
    );

    const query = useMemo(() => {
        const p = new URLSearchParams();
        if (weekStartStr) p.set('start', weekStartStr);
        if (weekEndStr) p.set('end', weekEndStr);
        const q = p.toString();
        return q ? `?${q}` : '';
    }, [weekStartStr, weekEndStr]);

    const loadMine = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await api<TimetableResponse>(
                `/api/timetable/me${query}`,
                { token }
            );
            setMine(res);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to load';
            setLoadError(msg);
            setMine({
                userId: user.id,
                rangeStart: weekStartStr,
                rangeEnd: weekEndStr,
                payload: [],
            });
        } finally {
            setLoading(false);
        }
    }, [query, token, user.id, weekStartStr, weekEndStr]);

    const loadUser = useCallback(
        async (userId: string) => {
            setLoading(true);
            setLoadError(null);
            try {
                const res = await api<TimetableResponse>(
                    `/api/timetable/user/${userId}${query}`,
                    { token }
                );
                setMine(res);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to load';
                setLoadError(msg);
                setMine({
                    userId,
                    rangeStart: weekStartStr,
                    rangeEnd: weekEndStr,
                    payload: [],
                });
            } finally {
                setLoading(false);
            }
        },
        [query, token, weekStartStr, weekEndStr]
    );

    useEffect(() => {
        if (selectedUser && selectedUser.id !== user.id)
            loadUser(selectedUser.id);
        else loadMine();
    }, [loadUser, loadMine, selectedUser, user.id]);

    // Load user's lesson colors
    useEffect(() => {
        const loadLessonColors = async () => {
            try {
                const colors = await getLessonColors(token);
                setLessonColors(colors);
            } catch (error) {
                console.error('Failed to load lesson colors:', error);
                // Don't show error to user for colors, just use defaults
            }
        };
        loadLessonColors();
    }, [token]);

    // Handle lesson color changes
    const handleColorChange = useCallback(async (lessonName: string, color: string | null) => {
        try {
            const viewingUserId = selectedUser?.id;
            if (color) {
                await setLessonColor(token, lessonName, color, viewingUserId);
                setLessonColors(prev => ({ ...prev, [lessonName]: color }));
            } else {
                await removeLessonColor(token, lessonName, viewingUserId);
                setLessonColors(prev => {
                    const updated = { ...prev };
                    delete updated[lessonName];
                    return updated;
                });
            }
        } catch (error) {
            console.error('Failed to update lesson color:', error);
            // TODO: Show error message to user
        }
    }, [token, selectedUser?.id]);

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
                    <div className="logo-text text-xl sm:text-2xl">
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
                                    setStart(ns);
                                }}
                            >
                                ← Prev week
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={() => {
                                    setStart(fmtLocal(new Date()));
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
                                    setStart(ns);
                                }}
                            >
                                Next week →
                            </button>
                        </div>
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
                            <label className="label">Week</label>
                            <input
                                type="date"
                                className="input"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
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
                            Week: {weekStartStr} → {weekEndStr}
                        </div>
                    </div>
                    <div className="mt-4">
                        {loadError && (
                            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                                {loadError}
                            </div>
                        )}
                        <Timetable 
                            data={mine} 
                            weekStart={weekStartDate}
                            lessonColors={lessonColors}
                            onColorChange={handleColorChange}
                        />
                    </div>
                </section>
            </main>
        </div>
    );
}
