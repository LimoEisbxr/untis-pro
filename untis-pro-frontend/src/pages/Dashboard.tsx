import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Timetable from '../components/Timetable';
import MoonIcon from '../components/MoonIcon';
import SettingsModal from '../components/SettingsModal';
import NotificationBell from '../components/NotificationBell';
import NotificationPanel from '../components/NotificationPanel';
import { DesktopTabNavigation, MobileTabNavigation, type Tab } from '../components/TabNavigation';
import SduiNewsList from '../components/SduiNewsList';
import {
    API_BASE,
    getLessonColors,
    setLessonColor,
    removeLessonColor,
    getDefaultLessonColors,
    getNotifications,
} from '../api';
import {
    addDays,
    fmtLocal,
    startOfWeek,
    getISOWeekNumber,
} from '../utils/dates';
import { useTimetableCache } from '../hooks/useTimetableCache';
import type {
    TimetableResponse,
    User,
    LessonColors,
    LessonOffsets,
    Notification,
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
    const [colorError, setColorError] = useState<string | null>(null);
    const [queryText, setQueryText] = useState('');
    const [results, setResults] = useState<
        Array<{ id: string; username: string; displayName: string | null }>
    >([]);
    // Track loading & error state for search to avoid flicker on mobile
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    // Persist last successful results so they don't vanish while a new request is in-flight
    const lastResultsRef = useRef<
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

    // Initialize timetable cache hook
    const { getTimetableData } = useTimetableCache();
    // Short auto-retry countdown for rate limit (429)
    const [retrySeconds, setRetrySeconds] = useState<number | null>(null);
    // Settings modal state
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Notification state
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] =
        useState(false);

    // Tab navigation state
    const [activeTab, setActiveTab] = useState<Tab>('timetable');

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

    // Calculate the calendar week number
    const calendarWeek = useMemo(
        () => getISOWeekNumber(weekStartDate),
        [weekStartDate]
    );

    const loadMine = useCallback(async () => {
        setLoadError(null);
        try {
            const res = await getTimetableData(
                user.id,
                user.id,
                weekStartDate,
                token,
                true
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
    }, [
        getTimetableData,
        user.id,
        weekStartDate,
        token,
        weekStartStr,
        weekEndStr,
    ]);

    const loadUser = useCallback(
        async (userId: string) => {
            /* no loading flag */
            setLoadError(null);
            try {
                const res = await getTimetableData(
                    user.id,
                    userId,
                    weekStartDate,
                    token,
                    false
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
        [
            getTimetableData,
            user.id,
            weekStartDate,
            token,
            weekStartStr,
            weekEndStr,
        ]
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
            // Clear any previous color error when starting a new change
            setColorError(null);
            
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
                
                // Parse error message for user-friendly display
                let userMessage = 'Failed to update lesson color. Please try again.';
                
                try {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const parsed = JSON.parse(errorMessage);
                    
                    // Handle rate limiting errors specifically
                    if (parsed.status === 429) {
                        const errorText = parsed.error || errorMessage;
                        if (errorText.includes('Too many color requests')) {
                            userMessage = 'Too many color changes. Please wait a moment before trying again.';
                        } else if (errorText.includes('Too many WebUntis requests')) {
                            userMessage = 'Rate limit reached. Please wait a few seconds before changing colors.';
                        } else {
                            userMessage = 'Too many requests. Please slow down and try again in a moment.';
                        }
                    } else if (parsed.error) {
                        userMessage = parsed.error;
                    }
                } catch {
                    // If error parsing fails, check for common rate limit messages in raw error
                    const errorText = error instanceof Error ? error.message : String(error);
                    if (errorText.includes('rate limit') || errorText.includes('too many')) {
                        userMessage = 'Rate limit reached. Please wait before changing colors again.';
                    }
                }
                
                // Show error to user
                setColorError(userMessage);
                
                // Auto-clear error after 5 seconds
                setTimeout(() => setColorError(null), 5000);
            }
        },
        [token, selectedUser?.id, user.isAdmin]
    );

    // Load notifications
    const loadNotifications = useCallback(async () => {
        try {
            const response = await getNotifications(token);
            setNotifications(response.notifications);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }, [token]);

    // Load notifications on component mount and periodically
    useEffect(() => {
        loadNotifications();

        // Reload notifications every 30 seconds
        const interval = setInterval(loadNotifications, 30000);
        return () => clearInterval(interval);
    }, [loadNotifications]);

    useEffect(() => {
        const q = queryText.trim();
        if (!q) {
            // Clear everything when field emptied
            setResults([]);
            lastResultsRef.current = [];
            setSearchLoading(false);
            setSearchError(null);
            abortRef.current?.abort();
            return;
        }
        if (q.length < 2) {
            // Don't search with less than 2 characters - clear results and loading state
            setResults([]);
            lastResultsRef.current = [];
            setSearchLoading(false);
            setSearchError(null);
            abortRef.current?.abort();
            return;
        }
        let cancelled = false;
        setSearchLoading(true);
        setSearchError(null);
        const currentQuery = q;
        const h = setTimeout(async () => {
            abortRef.current?.abort();
            const ac = new AbortController();
            abortRef.current = ac;
            try {
                const base = API_BASE
                    ? String(API_BASE).replace(/\/$/, '')
                    : '';
                const url = `${base}/api/users/search?q=${encodeURIComponent(
                    currentQuery
                )}`;
                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: ac.signal,
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (cancelled) return;
                if (queryText.trim() !== currentQuery) return; // stale
                const users = Array.isArray(data.users) ? data.users : [];
                setResults(users);
                lastResultsRef.current = users;
            } catch (e: unknown) {
                if (
                    e &&
                    typeof e === 'object' &&
                    (e as { name?: string }).name === 'AbortError'
                )
                    return; // superseded
                if (!cancelled) {
                    setSearchError(
                        e instanceof Error ? e.message : 'Search failed'
                    );
                    // Retain previous successful results (no setResults) to avoid disappear
                }
            } finally {
                if (!cancelled) setSearchLoading(false);
            }
        }, 180); // slightly faster debounce for snappier feel
        return () => {
            cancelled = true;
            clearTimeout(h);
        };
    }, [queryText, token]);

    // Close the search dropdown on outside click or Escape (desktop only)
    useEffect(() => {
        const handlePointer = (e: MouseEvent | TouchEvent) => {
            // Skip if mobile search is open to avoid interference
            if (mobileSearchOpen) return;

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
    }, [results.length, mobileSearchOpen]);

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
                        <NotificationBell
                            notifications={notifications}
                            onClick={() => setIsNotificationPanelOpen(true)}
                            className="mr-1"
                            isOpen={isNotificationPanelOpen}
                        />
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
            
            {/* Main layout with sidebar for desktop */}
            <div className="flex min-h-[calc(100vh-80px)]">
                {/* Desktop sidebar navigation */}
                <DesktopTabNavigation 
                    activeTab={activeTab} 
                    onTabChange={setActiveTab} 
                />
                
                {/* Main content area */}
                <main className="flex-1 overflow-auto">
                    <div className="mx-auto max-w-screen-2xl p-4">
                        {activeTab === 'timetable' ? (
                            <section className="card p-4">
                    <div className="space-y-2 sm:space-y-4">
                        {/* Row 1: navigation buttons (enlarged slightly on mobile) */}
                        <div className="grid grid-cols-3 gap-2 sm:flex sm:w-full sm:items-center sm:gap-3">
                            <button
                                className="btn-secondary px-3 py-1.5 text-sm sm:text-sm flex items-center justify-center"
                                onClick={() => {
                                    const ns = fmtLocal(
                                        addDays(new Date(start), -7)
                                    );
                                    setStart(ns);
                                }}
                                aria-label="Previous week"
                            >
                                <span aria-hidden className="mr-1 sm:mr-1">
                                    ←
                                </span>
                                <span className="hidden sm:inline">
                                    Prev Week
                                </span>
                                <span className="sm:hidden">Prev</span>
                            </button>
                            <button
                                className="btn-secondary px-3 py-1.5 text-sm sm:text-sm flex items-center justify-center"
                                onClick={() => setStart(fmtLocal(new Date()))}
                                aria-label="This week"
                            >
                                <span className="hidden sm:inline">
                                    This Week
                                </span>
                                <span className="sm:hidden">This</span>
                            </button>
                            <button
                                className="btn-secondary px-3 py-1.5 text-sm sm:text-sm flex items-center justify-center"
                                onClick={() => {
                                    const ns = fmtLocal(
                                        addDays(new Date(start), 7)
                                    );
                                    setStart(ns);
                                }}
                                aria-label="Next week"
                            >
                                <span className="hidden sm:inline mr-1">
                                    Next Week
                                </span>
                                <span className="sm:hidden">Next</span>
                                <span aria-hidden className="ml-1">
                                    →
                                </span>
                            </button>
                        </div>

                        {/* Row 2: search (desktop), mobile icons (search+home), week picker */}
                        <div className="flex flex-wrap items-end gap-3">
                            {/* Desktop search */}
                            <div
                                className="hidden sm:flex items-end gap-3 flex-1 max-w-2xl"
                                ref={searchBoxRef}
                            >
                                <div className="flex-1">
                                    <label className="label sm:text-sm text-[11px]">
                                        Search
                                    </label>
                                    <div className="relative">
                                        <input
                                            className="input text-sm pr-8"
                                            placeholder="Student…"
                                            value={queryText}
                                            onChange={(e) =>
                                                setQueryText(e.target.value)
                                            }
                                        />
                                        {searchLoading &&
                                            queryText.trim().length >= 2 && (
                                                <div
                                                    className="absolute right-7 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                                                    aria-label="Loading"
                                                    role="status"
                                                >
                                                    <svg
                                                        viewBox="0 0 24 24"
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                    >
                                                        <circle
                                                            cx="12"
                                                            cy="12"
                                                            r="9"
                                                            className="opacity-25"
                                                        />
                                                        <path
                                                            d="M21 12a9 9 0 0 0-9-9"
                                                            className="opacity-75"
                                                        />
                                                    </svg>
                                                </div>
                                            )}
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
                                                                    setSelectedUser(
                                                                        r
                                                                    );
                                                                    setQueryText(
                                                                        r.displayName ||
                                                                            r.username
                                                                    );
                                                                    setResults(
                                                                        []
                                                                    );
                                                                    if (
                                                                        r.id !==
                                                                        user.id
                                                                    )
                                                                        loadUser(
                                                                            r.id
                                                                        );
                                                                    else
                                                                        loadMine();
                                                                }}
                                                            >
                                                                <div className="font-medium">
                                                                    {r.displayName ||
                                                                        r.username}
                                                                </div>
                                                                {r.displayName && (
                                                                    <div className="text-xs text-slate-500">
                                                                        {
                                                                            r.username
                                                                        }
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {searchError &&
                                            queryText.trim().length >= 2 && (
                                                <div className="absolute z-40 mt-1 w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200">
                                                    {searchError}
                                                </div>
                                            )}
                                        {queryText.trim().length === 1 && (
                                            <div className="absolute z-40 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                                Type at least 2 characters…
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="hidden sm:flex pb-[2px]">
                                    <button
                                        className="rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700"
                                        title="My timetable"
                                        aria-label="Load my timetable"
                                        onClick={() => {
                                            setSelectedUser(null);
                                            setQueryText('');
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
                            {/* Week picker with calendar week display */}
                            <div className="flex items-end gap-3 ml-auto">
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label className="label sm:text-sm text-[11px]">
                                            Week
                                        </label>
                                        <label className="label sm:text-sm text-[11px]">
                                            CW {calendarWeek}
                                        </label>
                                    </div>
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
                        
                        {/* Color change error message */}
                        {colorError && (
                            <div className="mb-3 rounded-md border border-rose-300 bg-rose-50 p-3 text-rose-800 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                                <div className="flex items-start gap-2">
                                    <svg 
                                        className="w-5 h-5 mt-0.5 flex-shrink-0" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={2} 
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
                                        />
                                    </svg>
                                    <span>{colorError}</span>
                                </div>
                            </div>
                        )}
                        
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
                            }}
                        />
                    </div>
                </section>
                        ) : (
                            <SduiNewsList token={token} />
                        )}
                    </div>
                </main>
            </div>
            
            {/* Mobile bottom navigation */}
            <MobileTabNavigation 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
            />

            {/* Mobile full-screen search overlay */}
            {mobileSearchOpen && (
                <div className="sm:hidden fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col">
                    {/* Header with gradient blur effect */}
                    <div className="header-blur p-4 border-b border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 relative">
                                <input
                                    id="mobile-search-input"
                                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-base shadow-sm"
                                    placeholder="Search for a student..."
                                    value={queryText}
                                    onChange={(e) =>
                                        setQueryText(e.target.value)
                                    }
                                />
                                {queryText && (
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
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
                                {searchLoading &&
                                    queryText.trim().length >= 2 && (
                                        <div
                                            className="absolute right-10 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                                            aria-label="Loading"
                                            role="status"
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                className="h-5 w-5"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="9"
                                                    className="opacity-25"
                                                />
                                                <path
                                                    d="M21 12a9 9 0 0 0-9-9"
                                                    className="opacity-75"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                {searchError &&
                                    queryText.trim().length >= 2 && (
                                        <div className="absolute left-0 right-0 top-full mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-200 shadow">
                                            {searchError}
                                        </div>
                                    )}
                                {queryText.trim().length === 1 && (
                                    <div className="absolute left-0 right-0 top-full mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 shadow">
                                        Type at least 2 characters…
                                    </div>
                                )}
                            </div>
                            <button
                                className="rounded-xl px-4 py-3 bg-slate-200/90 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium shadow-sm"
                                onClick={() => {
                                    setMobileSearchOpen(false);
                                    setQueryText(''); // Clear search when closing
                                    setResults([]); // Clear results when closing
                                }}
                                aria-label="Close search"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {/* Results area with improved styling */}
                    <div className="flex-1 overflow-auto p-4">
                        {(() => {
                            const trimmed = queryText.trim();
                            if (!trimmed) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-4">
                                            <svg
                                                className="w-8 h-8 text-sky-600 dark:text-sky-400"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="1.5"
                                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                                />
                                            </svg>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-300 text-lg font-medium mb-2">
                                            Search for students
                                        </p>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                                            Start typing to find students and
                                            view their timetables
                                        </p>
                                    </div>
                                );
                            }
                            if (trimmed.length === 1) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                            <svg
                                                className="w-8 h-8 text-slate-400 dark:text-slate-500"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="1.5"
                                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                                />
                                            </svg>
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium mb-2">
                                            Keep typing…
                                        </p>
                                        <p className="text-slate-400 dark:text-slate-500 text-sm">
                                            Type at least 2 characters to search
                                        </p>
                                    </div>
                                );
                            }
                            if (searchLoading) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 animate-spin text-slate-400 dark:text-slate-500">
                                            <svg
                                                viewBox="0 0 24 24"
                                                className="w-8 h-8"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="9"
                                                    className="opacity-25"
                                                />
                                                <path
                                                    d="M21 12a9 9 0 0 0-9-9"
                                                    className="opacity-75"
                                                />
                                            </svg>
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                                            Searching…
                                        </p>
                                    </div>
                                );
                            }
                            if (searchError) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                                            <svg
                                                className="w-8 h-8 text-amber-600 dark:text-amber-300"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="1.5"
                                                    d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                        </div>
                                        <p className="text-amber-700 dark:text-amber-300 text-sm mb-1">
                                            {searchError}
                                        </p>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs">
                                            Adjust your search and try again
                                        </p>
                                    </div>
                                );
                            }
                            if (results.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                            <svg
                                                className="w-8 h-8 text-slate-400 dark:text-slate-500"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth="1.5"
                                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                                />
                                            </svg>
                                        </div>
                                        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium mb-2">
                                            No results found
                                        </p>
                                        <p className="text-slate-400 dark:text-slate-500 text-sm">
                                            Try a different search term
                                        </p>
                                    </div>
                                );
                            }
                            return (
                                <div className="space-y-2">
                                    {results.map((r, index) => (
                                        <div
                                            key={r.id}
                                            className="animate-fade-in"
                                            style={{
                                                animationDelay: `${
                                                    index * 50
                                                }ms`,
                                            }}
                                        >
                                            <button
                                                className="w-full rounded-xl p-4 text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 shadow-sm hover:shadow-md group"
                                                onClick={() => {
                                                    setSelectedUser(r);
                                                    setQueryText('');
                                                    setResults([]);
                                                    setMobileSearchOpen(false);
                                                    if (r.id !== user.id)
                                                        loadUser(r.id);
                                                    else loadMine();
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                                                        {(
                                                            r.displayName ||
                                                            r.username
                                                        )
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                                                            {r.displayName ||
                                                                r.username}
                                                        </div>
                                                        {r.displayName && (
                                                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                                                @{r.username}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-slate-400 dark:text-slate-500 group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors">
                                                        <svg
                                                            className="w-5 h-5"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth="2"
                                                                d="M9 5l7 7-7 7"
                                                            />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
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

            <NotificationPanel
                notifications={notifications}
                token={token}
                isOpen={isNotificationPanelOpen}
                onClose={() => setIsNotificationPanelOpen(false)}
                onNotificationUpdate={loadNotifications}
            />
        </div>
    );
}
