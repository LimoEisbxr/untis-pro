import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Timetable from '../components/Timetable';
import MoonIcon from '../components/MoonIcon';
import SettingsModal from '../components/SettingsModal';
import {
    api,
    API_BASE,
    getLessonColors,
    setLessonColor,
    removeLessonColor,
    getDefaultLessonColors,
} from '../api';
import { addDays, fmtLocal, startOfWeek } from '../utils/dates';
import type {
    TimetableResponse,
    User,
    LessonColors,
    LessonOffsets,
} from '../types';

export default function Dashboard({
    token,
    user,
    onLogout,
    dark,
    setDark,
    onUserUpdate,
}: {
    token: string;
    user: User;
    onLogout: () => void;
    dark: boolean;
    setDark: (v: boolean) => void;
    onUserUpdate: (u: User) => void;
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
    const searchBoxRef = useRef<HTMLDivElement | null>(null);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false); // full-screen popup on mobile

    // Auto-focus mobile search input when overlay opens
    useEffect(() => {
        if (mobileSearchOpen) {
            const t = setTimeout(() => {
                const el = document.getElementById(
                    'mobile-search-input'
                ) as HTMLInputElement | null;
                el?.focus();
            }, 30);
            return () => clearTimeout(t);
        }
    }, [mobileSearchOpen]);
    const [lessonColors, setLessonColors] = useState<LessonColors>({});
    const [defaultLessonColors, setDefaultLessonColors] =
        useState<LessonColors>({});
    const [lessonOffsets, setLessonOffsets] = useState<LessonOffsets>({});
    // Short auto-retry countdown for rate limit (429)
    const [retrySeconds, setRetrySeconds] = useState<number | null>(null);
    // Settings modal state
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    // Animation state for smooth week transitions - content only
    const [weekTransitionDirection, setWeekTransitionDirection] = useState<'left' | 'right' | null>(null);
    const [transitioningData, setTransitioningData] = useState<TimetableResponse | null>(null);

    // Swipe gesture handling (moved to Dashboard level to work even when no timetable)
    const mainContentRef = useRef<HTMLDivElement | null>(null);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const SWIPE_THRESHOLD = 60; // px
    const SWIPE_MAX_OFF_AXIS = 80; // allow some vertical movement

    // Derive a friendly info message for admin users when their own timetable isn't available
    const adminInfoMessage = useMemo(() => {
        if (!loadError || !user?.isAdmin) return null;
        // loadError may be raw text or a JSON string like {"error":"Target user not found"}
        let msg = loadError;
        try {
            const parsed = JSON.parse(loadError);
            if (parsed && typeof parsed === 'object' && parsed.error)
                msg = String(parsed.error);
        } catch {
            // ignore JSON parse errors; use loadError as-is
        }
        if (/target user not found/i.test(msg)) {
            return `Admins don't have a personal timetable. Use "Find student" above to search and view a user's timetable.`;
        }
        return null;
    }, [loadError, user?.isAdmin]);

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
        setLoadError(null);
        try {
            const res = await api<TimetableResponse>(
                `/api/timetable/me${query}`,
                { token }
            );
            setMine(res);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to load';
            // Auto-retry if rate-limited; avoid replacing timetable with an empty one
            try {
                const parsed = JSON.parse(msg);
                if (parsed?.status === 429) {
                    const retryAfterSec = Math.max(
                        1,
                        Number(parsed?.retryAfter || 0) || 1
                    );
                    setRetrySeconds(retryAfterSec);
                    setLoadError(null); // handled by retry banner below
                    const t = setTimeout(() => {
                        setRetrySeconds(null);
                        loadMine();
                    }, retryAfterSec * 1000);
                    // Best-effort: clear timer if component unmounts or deps change
                    return () => clearTimeout(t);
                }
            } catch {
                // ignore JSON parse errors and non-structured messages
            }
            setLoadError(msg);
            // Non-429: fall back to an empty timetable to keep UI consistent
            setMine({
                userId: user.id,
                rangeStart: weekStartStr,
                rangeEnd: weekEndStr,
                payload: [],
            });
        } finally {
            /* no loading flag */
        }
    }, [query, token, user.id, weekStartStr, weekEndStr]);

    const loadUser = useCallback(
        async (userId: string) => {
            /* no loading flag */
            setLoadError(null);
            try {
                const res = await api<TimetableResponse>(
                    `/api/timetable/user/${userId}${query}`,
                    { token }
                );
                setMine(res);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to load';
                // Auto-retry if rate-limited; avoid replacing timetable with an empty one
                try {
                    const parsed = JSON.parse(msg);
                    if (parsed?.status === 429) {
                        const retryAfterSec = Math.max(
                            1,
                            Number(parsed?.retryAfter || 0) || 1
                        );
                        setRetrySeconds(retryAfterSec);
                        setLoadError(null);
                        const t = setTimeout(() => {
                            setRetrySeconds(null);
                            loadUser(userId);
                        }, retryAfterSec * 1000);
                        return () => clearTimeout(t);
                    }
                } catch {
                    // ignore JSON parse errors and non-structured messages
                }
                setLoadError(msg);
                setMine({
                    userId,
                    rangeStart: weekStartStr,
                    rangeEnd: weekEndStr,
                    payload: [],
                });
            } finally {
                /* no loading flag */
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
                const { colors, offsets } = await getLessonColors(token);
                setLessonColors(colors);
                setLessonOffsets(offsets || {});
            } catch (error) {
                console.error('Failed to load lesson colors:', error);
                // Don't show error to user for colors, just use defaults
            }
        };
        const loadDefaults = async () => {
            try {
                const defaults = await getDefaultLessonColors(token);
                setDefaultLessonColors(defaults);
            } catch {
                // Ignore; fallback to hardcoded defaults in UI
            }
        };
        loadLessonColors();
        loadDefaults();
    }, [token]);

    // Handle lesson color changes
    const handleColorChange = useCallback(
        async (lessonName: string, color: string | null, offset?: number) => {
            try {
                const viewingUserId = selectedUser?.id;
                if (color) {
                    await setLessonColor(
                        token,
                        lessonName,
                        color,
                        viewingUserId,
                        offset
                    );
                    setLessonColors((prev) => ({
                        ...prev,
                        [lessonName]: color,
                    }));
                    // If admin, this sets a global default too; reflect immediately
                    if (user.isAdmin) {
                        setDefaultLessonColors((prev) => ({
                            ...prev,
                            [lessonName]: color,
                        }));
                        // Re-fetch to avoid any drift or silent failure
                        getDefaultLessonColors(token)
                            .then((d) => setDefaultLessonColors(d))
                            .catch(() => undefined);
                    }
                } else {
                    await removeLessonColor(token, lessonName, viewingUserId);
                    setLessonColors((prev) => {
                        const updated = { ...prev };
                        delete updated[lessonName];
                        return updated;
                    });
                    // If admin, removing resets the global default; update fallback immediately
                    if (user.isAdmin) {
                        setDefaultLessonColors((prev) => {
                            const updated = { ...prev };
                            delete updated[lessonName];
                            return updated;
                        });
                        // Also clear any local offset cache for that lesson so the UI doesn't show stale variation
                        try {
                            const k = 'adminLessonGradientOffsets';
                            const raw = localStorage.getItem(k);
                            if (raw) {
                                const obj = JSON.parse(raw);
                                if (obj && typeof obj === 'object') {
                                    delete obj[lessonName];
                                    localStorage.setItem(
                                        k,
                                        JSON.stringify(obj)
                                    );
                                }
                            }
                        } catch {
                            // ignore localStorage errors
                        }
                        // Re-fetch to confirm removal persisted (and not re-created elsewhere)
                        getDefaultLessonColors(token)
                            .then((d) => setDefaultLessonColors(d))
                            .catch(() => undefined);
                    }
                }
            } catch (error) {
                console.error('Failed to update lesson color:', error);
                // TODO: Show error message to user
            }
        },
        [token, selectedUser?.id, user.isAdmin]
    );

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

    // Close the search dropdown on outside click or Escape
    useEffect(() => {
        const handlePointer = (e: MouseEvent | TouchEvent) => {
            const node = searchBoxRef.current;
            if (!node) return;
            if (!node.contains(e.target as Node)) {
                if (results.length) setResults([]);
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && results.length) setResults([]);
        };
        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('touchstart', handlePointer);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('touchstart', handlePointer);
            document.removeEventListener('keydown', handleKey);
        };
    }, [results.length]);

    // Dashboard-level swipe handling for week navigation (works even when no timetable)
    useEffect(() => {
        const el = mainContentRef.current;
        if (!el) return;
        let skipSwipe = false;
        const INTERACTIVE_SELECTOR =
            'input,textarea,select,button,[contenteditable="true"],[role="textbox"]';
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const target = e.target as HTMLElement | null;
            // Ignore swipe if user starts on an interactive control to allow focusing
            if (
                target &&
                (target.closest(INTERACTIVE_SELECTOR) ||
                    target.tagName === 'INPUT')
            ) {
                skipSwipe = true;
                touchStartX.current = null;
                touchStartY.current = null;
                return; // let the browser handle focus normally
            }
            skipSwipe = false;
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
        };
        const handleTouchEnd = (e: TouchEvent) => {
            if (skipSwipe) {
                skipSwipe = false;
                return;
            }
            if (touchStartX.current == null || touchStartY.current == null)
                return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            const dy = e.changedTouches[0].clientY - touchStartY.current;
            if (
                Math.abs(dx) > SWIPE_THRESHOLD &&
                Math.abs(dy) < SWIPE_MAX_OFF_AXIS
            ) {
                if (dx > 0) {
                    // Swipe right = previous week (content moves right, new comes from left)
                    const newData = { ...mine! }; // Current data becomes "old"
                    setTransitioningData(newData);
                    setWeekTransitionDirection('right');
                    const ns = fmtLocal(addDays(new Date(start), -7));
                    setStart(ns);
                    setTimeout(() => {
                        setWeekTransitionDirection(null);
                        setTransitioningData(null);
                    }, 400);
                } else {
                    // Swipe left = next week (content moves left, new comes from right)
                    const newData = { ...mine! }; // Current data becomes "old"
                    setTransitioningData(newData);
                    setWeekTransitionDirection('left');
                    const ns = fmtLocal(addDays(new Date(start), 7));
                    setStart(ns);
                    setTimeout(() => {
                        setWeekTransitionDirection(null);
                        setTransitioningData(null);
                    }, 400);
                }
            }
            touchStartX.current = null;
            touchStartY.current = null;
        };
        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchend', handleTouchEnd);
        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchend', handleTouchEnd);
        };
    }, [start, mine]);

    return (
        <div className={'min-h-screen'}>
            <header className="header-blur">
                <div className="mx-auto flex max-w-screen-2xl items-center justify-between p-4">
                    <div className="logo-text text-xl sm:text-2xl">
                        Untis Pro
                    </div>
                    <div className="flex items-center">
                        <div className="text-sm text-slate-600 dark:text-slate-300 mr-4">
                            {user.displayName || user.username}
                        </div>
                        <button
                            className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
                            title="Settings"
                            onClick={() => setIsSettingsModalOpen(true)}
                            aria-label="Settings"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                className="text-slate-600 dark:text-slate-300"
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
                        </button>
                        <button
                            className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700 ml-1"
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
                        <button
                            className="btn-secondary ml-2 sm:ml-3"
                            onClick={onLogout}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>
            <main ref={mainContentRef} className="mx-auto max-w-screen-2xl p-4">
                <section className="card p-4">
                    <div className="space-y-2 sm:space-y-4">
                        {/* Row 1: navigation buttons (desktop only - hidden on mobile for swipe-only navigation) */}
                        <div className="hidden sm:flex sm:w-full sm:items-center sm:gap-3">
                            <button
                                className="btn-secondary px-3 py-1.5 text-sm sm:text-sm flex items-center justify-center"
                                onClick={() => {
                                    const newData = { ...mine! };
                                    setTransitioningData(newData);
                                    setWeekTransitionDirection('right');
                                    const ns = fmtLocal(
                                        addDays(new Date(start), -7)
                                    );
                                    setStart(ns);
                                    setTimeout(() => {
                                        setWeekTransitionDirection(null);
                                        setTransitioningData(null);
                                    }, 400);
                                }}
                                aria-label="Previous week"
                            >
                                <span aria-hidden className="mr-1 sm:mr-1">
                                    ←
                                </span>
                                <span className="hidden sm:inline">
                                    Prev Week
                                </span>
                            </button>
                            <button
                                className="btn-secondary px-3 py-1.5 text-sm sm:text-sm flex items-center justify-center"
                                onClick={() => {
                                    setWeekTransitionDirection('left');
                                    setStart(fmtLocal(new Date()));
                                    setTimeout(() => {
                                        setWeekTransitionDirection(null);
                                        setTransitioningData(null);
                                    }, 400);
                                }}
                                aria-label="This week"
                            >
                                <span className="hidden sm:inline">
                                    This Week
                                </span>
                            </button>
                            <button
                                className="btn-secondary px-3 py-1.5 text-sm sm:text-sm flex items-center justify-center"
                                onClick={() => {
                                    const newData = { ...mine! };
                                    setTransitioningData(newData);
                                    setWeekTransitionDirection('left');
                                    const ns = fmtLocal(
                                        addDays(new Date(start), 7)
                                    );
                                    setStart(ns);
                                    setTimeout(() => {
                                        setWeekTransitionDirection(null);
                                        setTransitioningData(null);
                                    }, 400);
                                }}
                                aria-label="Next week"
                            >
                                <span className="hidden sm:inline mr-1">
                                    Next Week
                                </span>
                                <span aria-hidden className="ml-1">
                                    →
                                </span>
                            </button>
                        </div>

                        {/* Row 2: search (desktop), mobile icons (search+home), week picker */}
                        <div className="flex flex-wrap items-end gap-3">
                            {/* Desktop search */}
                            <div className="hidden sm:flex items-end gap-3 flex-1 max-w-2xl" ref={searchBoxRef}>
                                <div className="flex-1">
                                    <label className="label sm:text-sm text-[11px]">Search</label>
                                    <div className="relative">
                                        <input
                                            className="input text-sm pr-8"
                                            placeholder="Student…"
                                            value={queryText}
                                            onChange={(e) =>
                                                setQueryText(e.target.value)
                                            }
                                        />
                                        {queryText && (
                                            <button
                                                type="button"
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                                aria-label="Clear search"
                                                onClick={() => setQueryText('')}
                                            >
                                                ×
                                            </button>
                                        )}
                                        {results.length > 0 && (
                                            <div className="absolute z-40 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                                                <ul className="max-h-60 overflow-auto py-1 text-sm">
                                                    {results.map((r) => (
                                                        <li key={r.id}>
                                                            <button
                                                                className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                                                                onClick={() => {
                                                                    setSelectedUser(r);
                                                                    setQueryText(r.displayName || r.username);
                                                                    setResults([]);
                                                                    if (r.id !== user.id) loadUser(r.id);
                                                                    else loadMine();
                                                                }}
                                                            >
                                                                <div className="font-medium">{r.displayName || r.username}</div>
                                                                {r.displayName && (
                                                                    <div className="text-xs text-slate-500">{r.username}</div>
                                                                )}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="hidden sm:flex pb-[2px]">
                                    <button
                                        className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
                                        title="My timetable (current week)"
                                        aria-label="Load my timetable for current week"
                                        onClick={() => {
                                            setSelectedUser(null);
                                            setQueryText('');
                                            setStart(fmtLocal(new Date())); // Reset to current week
                                            loadMine();
                                        }}
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
                            {/* Mobile icon cluster */}
                            <div className="flex items-end gap-2 sm:hidden">
                                <button
                                    type="button"
                                    className="rounded-md p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    aria-label="Open search"
                                    onClick={() => setMobileSearchOpen(true)}
                                >
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.35-4.35" />
                                    </svg>
                                </button>

                                <button
                                    className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    title="My timetable (current week)"
                                    onClick={() => {
                                        setSelectedUser(null);
                                        setQueryText('');
                                        setStart(fmtLocal(new Date())); // Reset to current week
                                        loadMine();
                                    }}
                                    aria-label="Load my timetable for current week"
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
                            {/* Week picker (week info removed) */}
                            <div className="flex items-end gap-3 ml-auto mr-5">
                                <div>
                                    <label className="label sm:text-sm text-[11px]">
                                        Week
                                    </label>
                                    <input
                                        type="date"
                                        className="input text-sm"
                                        value={start}
                                        onChange={(e) =>
                                            setStart(e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                        {/* Week info removed */}
                    </div>
                    <div className="mt-4">
                        {retrySeconds !== null ? (
                            <div className="mb-3 rounded-md border border-sky-300 bg-sky-50 p-3 text-sky-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
                                Rate limit reached. Retrying in {retrySeconds}s…
                            </div>
                        ) : adminInfoMessage ? (
                            <div className="mb-3 rounded-md border border-sky-300 bg-sky-50 p-3 text-sky-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
                                {adminInfoMessage}
                            </div>
                        ) : loadError ? (
                            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                                {(() => {
                                    try {
                                        const parsed = JSON.parse(loadError);
                                        return parsed?.error || loadError;
                                    } catch {
                                        return loadError;
                                    }
                                })()}
                            </div>
                        ) : null}
                        <div className="content-transition-wrapper">
                            <Timetable
                                data={mine}
                                weekStart={weekStartDate}
                                lessonColors={lessonColors}
                                defaultLessonColors={defaultLessonColors}
                                isAdmin={!!user.isAdmin}
                                onColorChange={handleColorChange}
                                serverLessonOffsets={lessonOffsets}
                                token={token}
                                viewingUserId={selectedUser?.id}
                                onWeekNavigate={(dir) => {
                                    const newData = { ...mine! };
                                    setTransitioningData(newData);
                                    
                                    // Trigger animation based on direction
                                    setWeekTransitionDirection(dir === 'prev' ? 'right' : 'left');
                                    
                                    if (dir === 'prev') {
                                        const ns = fmtLocal(
                                            addDays(new Date(start), -7)
                                        );
                                        setStart(ns);
                                    } else {
                                        const ns = fmtLocal(
                                            addDays(new Date(start), 7)
                                        );
                                        setStart(ns);
                                    }
                                    
                                    // Reset animation state after animation completes
                                    setTimeout(() => {
                                        setWeekTransitionDirection(null);
                                        setTransitioningData(null);
                                    }, 400);
                                }}
                                transitionDirection={weekTransitionDirection}
                                transitioningData={transitioningData}
                            />
                        </div>
                    </div>
                </section>
            </main>

            {/* Mobile full-screen search overlay */}
            {mobileSearchOpen && (
                <div className="sm:hidden fixed inset-0 z-50 bg-white dark:bg-slate-900 p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <input
                            id="mobile-search-input"
                            className="input flex-1 text-sm"
                            placeholder="Search student…"
                            value={queryText}
                            onChange={(e) => setQueryText(e.target.value)}
                        />
                        {queryText && (
                            <button
                                className="rounded-md p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200"
                                onClick={() => setQueryText('')}
                                aria-label="Clear search"
                                title="Clear search"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-5 w-5"
                                >
                                    <path d="M18 6 6 18" />
                                    <path d="M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                        <button
                            className="rounded-md px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200"
                            onClick={() => setMobileSearchOpen(false)}
                            aria-label="Close search"
                        >
                            Close
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto -mx-2 px-2">
                        {results.length === 0 && queryText ? (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                No results
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {results.map((r) => (
                                    <li key={r.id}>
                                        <button
                                            className="w-full rounded-md px-3 py-2 text-left bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm"
                                            onClick={() => {
                                                setSelectedUser(r);
                                                setQueryText(
                                                    r.displayName || r.username
                                                );
                                                setResults([]);
                                                setMobileSearchOpen(false);
                                                if (r.id !== user.id)
                                                    loadUser(r.id);
                                                else loadMine();
                                            }}
                                        >
                                            <div className="font-medium">
                                                {r.displayName || r.username}
                                            </div>
                                            {r.displayName && (
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    {r.username}
                                                </div>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            <SettingsModal
                token={token}
                user={user}
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                onUserUpdate={onUserUpdate}
            />
        </div>
    );
}
