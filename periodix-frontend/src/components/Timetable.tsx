import { useEffect, useMemo, useState, useRef } from 'react';
import type {
    Lesson,
    TimetableResponse,
    LessonColors,
    Homework,
    Exam,
} from '../types';
import {
    addDays,
    fmtLocal,
    startOfWeek,
    yyyymmddToISO,
    fmtHM,
    untisToMinutes,
} from '../utils/dates';
import { setLessonColor } from '../api';
import LessonModal from './LessonModal';
import TimeAxis from './TimeAxis';
import DayColumn from './DayColumn';
// (Mobile vertical layout removed; keeping original horizontal week view across breakpoints)

/**
 * Check if two lessons can be merged based on matching criteria
 * and break time between them (5 minutes or less)
 */
function canMergeLessons(lesson1: Lesson, lesson2: Lesson): boolean {
    // Check if subjects match
    const subject1 = lesson1.su?.[0]?.name ?? lesson1.activityType ?? '';
    const subject2 = lesson2.su?.[0]?.name ?? lesson2.activityType ?? '';
    if (subject1 !== subject2) return false;

    // Check if teachers match
    const teacher1 = lesson1.te
        ?.map((t) => t.name)
        .sort()
        .join(',');
    const teacher2 = lesson2.te
        ?.map((t) => t.name)
        .sort()
        .join(',');
    if (teacher1 !== teacher2) return false;

    // Check if rooms match
    const room1 = lesson1.ro
        ?.map((r) => r.name)
        .sort()
        .join(',');
    const room2 = lesson2.ro
        ?.map((r) => r.name)
        .sort()
        .join(',');
    if (room1 !== room2) return false;

    // Check if lesson codes match (both cancelled, both irregular, etc.)
    if (lesson1.code !== lesson2.code) return false;

    // Calculate break time in minutes
    const lesson1EndMin = untisToMinutes(lesson1.endTime);
    const lesson2StartMin = untisToMinutes(lesson2.startTime);
    const breakMinutes = lesson2StartMin - lesson1EndMin;

    // Merge if break is 5 minutes or less (including negative for overlapping)
    return breakMinutes <= 5;
}

/**
 * Check if two homework items are identical based on content
 */
function areHomeworkIdentical(hw1: Homework, hw2: Homework): boolean {
    return (
        hw1.text === hw2.text &&
        hw1.subject?.name === hw2.subject?.name &&
        hw1.date === hw2.date &&
        hw1.remark === hw2.remark
    );
}

/**
 * Check if two exam items are identical based on content
 */
function areExamsIdentical(exam1: Exam, exam2: Exam): boolean {
    return (
        exam1.name === exam2.name &&
        exam1.subject?.name === exam2.subject?.name &&
        exam1.date === exam2.date &&
        exam1.startTime === exam2.startTime &&
        exam1.endTime === exam2.endTime &&
        exam1.text === exam2.text
    );
}

/**
 * Deduplicate homework arrays, preserving completed status
 */
function deduplicateHomework(
    homework1: Homework[] = [],
    homework2: Homework[] = []
): Homework[] {
    const allHomework = [...homework1, ...homework2];
    const deduplicated: Homework[] = [];

    for (const hw of allHomework) {
        const existingIndex = deduplicated.findIndex((existing) =>
            areHomeworkIdentical(existing, hw)
        );

        if (existingIndex === -1) {
            // New homework, add it
            deduplicated.push(hw);
        } else {
            // Duplicate found, merge completion status (completed if either is completed)
            deduplicated[existingIndex] = {
                ...deduplicated[existingIndex],
                completed:
                    deduplicated[existingIndex].completed || hw.completed,
            };
        }
    }

    return deduplicated;
}

/**
 * Deduplicate exam arrays
 */
function deduplicateExams(exams1: Exam[] = [], exams2: Exam[] = []): Exam[] {
    const allExams = [...exams1, ...exams2];
    const deduplicated: Exam[] = [];

    for (const exam of allExams) {
        const existingIndex = deduplicated.findIndex((existing) =>
            areExamsIdentical(existing, exam)
        );

        if (existingIndex === -1) {
            // New exam, add it
            deduplicated.push(exam);
        }
        // For exams, we don't merge anything - just avoid duplicates
    }

    return deduplicated;
}

/**
 * Merge two lessons into one, combining their time ranges and preserving all data
 */
function mergeTwoLessons(lesson1: Lesson, lesson2: Lesson): Lesson {
    // Helper to combine textual note fields without duplicating identical segments
    const combineNotes = (a?: string, b?: string): string | undefined => {
        const parts: string[] = [];
        const add = (val?: string) => {
            if (!val) return;
            // Split in case prior merge already joined with ' | '
            val.split('|')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((seg) => {
                    const normalized = seg.toLowerCase();
                    // Avoid duplicates (case-insensitive)
                    if (!parts.some((p) => p.toLowerCase() === normalized)) {
                        parts.push(seg);
                    }
                });
        };
        add(a);
        add(b);
        if (!parts.length) return undefined;
        return parts.join(' | ');
    };
    return {
        ...lesson1, // Use first lesson as base
        startTime: Math.min(lesson1.startTime, lesson2.startTime),
        endTime: Math.max(lesson1.endTime, lesson2.endTime),
        // Merge and deduplicate homework arrays
        homework: deduplicateHomework(lesson1.homework, lesson2.homework),
        // Merge and deduplicate exam arrays
        exams: deduplicateExams(lesson1.exams, lesson2.exams),
        // Combine info and lstext with separator, removing duplicates
        info: combineNotes(lesson1.info, lesson2.info),
        lstext: combineNotes(lesson1.lstext, lesson2.lstext),
        // Use lower ID to maintain consistency
        id: Math.min(lesson1.id, lesson2.id),
    };
}

/**
 * Merge consecutive lessons that meet the merging criteria
 */
function mergeLessons(lessons: Lesson[]): Lesson[] {
    if (lessons.length <= 1) return lessons;

    const merged: Lesson[] = [];
    let current = lessons[0];

    for (let i = 1; i < lessons.length; i++) {
        const next = lessons[i];

        if (canMergeLessons(current, next)) {
            // Merge current with next
            current = mergeTwoLessons(current, next);
        } else {
            // Can't merge, add current to result and move to next
            merged.push(current);
            current = next;
        }
    }

    // Add the last lesson
    merged.push(current);

    return merged;
}

export default function Timetable({
    data,
    weekStart,
    lessonColors = {},
    defaultLessonColors = {},
    isAdmin = false,
    onColorChange,
    serverLessonOffsets = {},
    token,
    viewingUserId,
    onWeekNavigate,
    onLessonModalStateChange,
    isOnboardingActive,
}: {
    data: TimetableResponse | null;
    weekStart: Date;
    lessonColors?: LessonColors;
    defaultLessonColors?: LessonColors;
    isAdmin?: boolean;
    onColorChange?: (
        lessonName: string,
        color: string | null,
        offset?: number
    ) => void;
    serverLessonOffsets?: Record<string, number>;
    token?: string;
    viewingUserId?: string; // if admin is viewing a student
    onWeekNavigate?: (direction: 'prev' | 'next') => void; // optional external navigation handler
    onLessonModalStateChange?: (isOpen: boolean) => void; // callback for onboarding
    isOnboardingActive?: boolean;
    // Extended: allow passing current offset when color set
    // (so initial color creation can persist chosen offset)
    // Keeping backwards compatibility (third param optional)
}) {
    const START_MIN = 7 * 60 + 40; // 07:40
    const END_MIN = 17 * 60 + 15; // 17:15
    const totalMinutes = END_MIN - START_MIN;
    const [SCALE, setSCALE] = useState<number>(1);
    const [axisWidth, setAxisWidth] = useState<number>(56); // dynamic; shrinks on mobile

    // Developer mode visibility (controlled by env, query param, or persisted localStorage flag)
    const envDevFlag =
        String(import.meta.env.VITE_ENABLE_DEVELOPER_MODE ?? '')
            .trim()
            .toLowerCase() === 'true';
    const queryDevFlag =
        typeof window !== 'undefined'
            ? (() => {
                  try {
                      const v = new URLSearchParams(window.location.search).get(
                          'dev'
                      );
                      return (
                          !!v &&
                          ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
                      );
                  } catch {
                      return false;
                  }
              })()
            : false;
    // Only allow toggle if env flag OR query param present right now (no localStorage persistence of visibility)
    const isDeveloperModeEnabled = envDevFlag || queryDevFlag;

    const [isDeveloperMode, setIsDeveloperMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            return localStorage.getItem('PeriodixDevActive') === '1';
        } catch {
            return false;
        }
    });

    // Persist active developer mode toggle state
    useEffect(() => {
        try {
            localStorage.setItem(
                'PeriodixDevActive',
                isDeveloperMode ? '1' : '0'
            );
        } catch {
            /* ignore */
        }
    }, [isDeveloperMode]);

    // If toggle becomes unavailable (env off & no query), ensure dev mode not active to avoid confusing hidden state
    useEffect(() => {
        if (!isDeveloperModeEnabled && isDeveloperMode) {
            setIsDeveloperMode(false);
        }
    }, [isDeveloperModeEnabled, isDeveloperMode]);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    // For privacy: non-admins always use their own (viewer) bucket, never the timetable owner's ID.
    // If we later have the viewer's concrete user id, swap 'self' with it; this prevents leaking offsets across viewed timetables.
    const storageKey = isAdmin
        ? 'adminLessonGradientOffsets'
        : 'lessonGradientOffsets:self';
    const legacyKey = 'lessonGradientOffsets';
    const [gradientOffsets, setGradientOffsets] = useState<
        Record<string, number>
    >(() => {
        // Attempt to load user‑scoped first
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) return JSON.parse(raw);
            // Migrate legacy key once if present
            const legacy = localStorage.getItem(legacyKey);
            if (legacy) {
                localStorage.setItem(storageKey, legacy);
                return JSON.parse(legacy);
            }
        } catch {
            /* ignore */
        }
        return serverLessonOffsets || {};
    });

    // When server offsets change (after fetch), merge them (client overrides win if exist)
    useEffect(() => {
        if (serverLessonOffsets && Object.keys(serverLessonOffsets).length) {
            // Prefer fresh server values over any cached local ones to avoid stale offsets
            setGradientOffsets((prev) => ({ ...prev, ...serverLessonOffsets }));
        }
    }, [serverLessonOffsets]);

    // Reload offsets if user changes (e.g., switching accounts without full reload)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) setGradientOffsets(JSON.parse(raw));
            else setGradientOffsets({});
        } catch {
            setGradientOffsets({});
        }
    }, [storageKey]);

    // Debounce timers per lesson to avoid hammering the API while user drags slider
    const offsetPersistTimers = useRef<Record<string, number>>({});
    const OFFSET_DEBOUNCE_MS = 600;

    const updateGradientOffset = (lessonName: string, offset: number) => {
        // Immediate local/UI update
        setGradientOffsets((prev) => {
            const next = { ...prev };
            if (offset === 0.5) delete next[lessonName];
            else next[lessonName] = offset;
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
            } catch {
                /* ignore */
            }
            return next;
        });

        // Only schedule persistence if a real color override exists (custom or admin default)
        const hasExplicitColor =
            !!lessonColors[lessonName] || !!defaultLessonColors[lessonName];
        if (!token || !hasExplicitColor) return;

        // Clear any pending timer for this lesson
        const existing = offsetPersistTimers.current[lessonName];
        if (existing) window.clearTimeout(existing);

        // Schedule new persistence after user stops adjusting
        offsetPersistTimers.current[lessonName] = window.setTimeout(() => {
            const color =
                lessonColors[lessonName] || defaultLessonColors[lessonName]!;
            setLessonColor(
                token,
                lessonName,
                color,
                viewingUserId,
                offset
            ).catch(() => undefined);
            delete offsetPersistTimers.current[lessonName];
        }, OFFSET_DEBOUNCE_MS);
    };

    // Cleanup timers on unmount
    useEffect(() => {
        const timersRef = offsetPersistTimers.current; // snapshot
        return () => {
            Object.values(timersRef).forEach((id) => window.clearTimeout(id));
        };
    }, []);

    const handleLessonClick = (lesson: Lesson) => {
        setSelectedLesson(lesson);
        setIsModalOpen(true);

        // Notify onboarding if active (global callback)
        if (
            typeof (
                window as Window &
                    typeof globalThis & {
                        onboardingLessonModalStateChange?: (
                            isOpen: boolean
                        ) => void;
                    }
            ).onboardingLessonModalStateChange === 'function'
        ) {
            (
                window as Window &
                    typeof globalThis & {
                        onboardingLessonModalStateChange: (
                            isOpen: boolean
                        ) => void;
                    }
            ).onboardingLessonModalStateChange(true);
        }

        // Notify parent component (Dashboard) for onboarding
        if (onLessonModalStateChange) {
            onLessonModalStateChange(true);
        }
    };

    // Responsive vertical spacing; mobile gets tighter layout
    const [BOTTOM_PAD_PX, setBOTTOM_PAD_PX] = useState(12);
    const [DAY_HEADER_PX, setDAY_HEADER_PX] = useState(28);

    useEffect(() => {
        function computeScale() {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
            const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
            const isMobile = vw < 640;
            // Target vertical pixels for timetable (excludes header) – dynamic for better fill
            // Mobile: keep more compact (1.0–1.15 px/min) to avoid excessive scrolling
            if (isMobile) {
                const targetHeight = Math.min(
                    880,
                    Math.max(660, Math.floor(vh * 0.9))
                );
                setSCALE(targetHeight / totalMinutes);
                setAxisWidth(vw < 400 ? 40 : 44);
                setDAY_HEADER_PX(40); // a little taller, easier tap
                setBOTTOM_PAD_PX(6);
            } else {
                const targetHeight = Math.max(560, Math.floor(vh * 0.78));
                setSCALE(targetHeight / totalMinutes);
                setAxisWidth(56);
                setDAY_HEADER_PX(32);
                setBOTTOM_PAD_PX(14);
            }
        }
        computeScale();
        window.addEventListener('resize', computeScale);
        return () => window.removeEventListener('resize', computeScale);
    }, [totalMinutes]);

    const monday = startOfWeek(weekStart);
    const days = useMemo(
        () => Array.from({ length: 5 }, (_, i) => addDays(monday, i)),
        [monday]
    );

    // Swipe gestures (mobile) to navigate weeks
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const SWIPE_THRESHOLD = 60; // px
    const SWIPE_MAX_OFF_AXIS = 80; // allow some vertical movement
    const containerRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = containerRef.current;
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
                if (dx < 0) onWeekNavigate?.('next');
                else onWeekNavigate?.('prev');
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
    }, [onWeekNavigate]);

    // Track current time and compute line position
    const [now, setNow] = useState<Date>(() => new Date());
    useEffect(() => {
        const update = () => setNow(new Date());
        update();
        const id = setInterval(update, 30_000);
        return () => clearInterval(id);
    }, []);

    const todayISO = fmtLocal(new Date());
    const isCurrentWeek = useMemo(
        () => days.some((d) => fmtLocal(d) === todayISO),
        [days, todayISO]
    );
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const isWithinDay = nowMin >= START_MIN && nowMin <= END_MIN;
    const showNowLine = isCurrentWeek && isWithinDay;
    // When using sticky external header we shrink internal header in columns to 8px
    const internalHeaderPx = 8; // must match DayColumn hideHeader calculation
    const nowY = (nowMin - START_MIN) * SCALE + internalHeaderPx;

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
        for (const k of Object.keys(byDay)) {
            byDay[k].sort(
                (a, b) => a.startTime - b.startTime || a.endTime - b.endTime
            );
            // Apply lesson merging after sorting
            byDay[k] = mergeLessons(byDay[k]);
        }
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
        <div
            ref={containerRef}
            className="w-full overflow-x-hidden pt-[env(safe-area-inset-top)]"
        >
            {isDeveloperModeEnabled && (
                <div className="mb-4 flex justify-end px-2">
                    <button
                        type="button"
                        onClick={() => setIsDeveloperMode((v) => !v)}
                        className={`group inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow ring-1 ring-slate-900/10 dark:ring-white/10 transition ${
                            isDeveloperMode
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                        aria-pressed={isDeveloperMode}
                        aria-label="Toggle developer mode"
                    >
                        <span
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                                isDeveloperMode
                                    ? 'bg-indigo-500'
                                    : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span
                                className={`absolute left-0 h-5 w-5 rounded-full bg-white dark:bg-slate-200 shadow transform transition-transform duration-200 ${
                                    isDeveloperMode
                                        ? 'translate-x-4'
                                        : 'translate-x-0'
                                }`}
                            />
                        </span>
                        <span className="text-sm font-medium">
                            Developer Mode
                        </span>
                    </button>
                </div>
            )}

            {/* Unified horizontal week view (fits viewport width) */}
            {/* Sticky weekday header (separate from columns so it stays visible during vertical scroll) */}
            <div className="sticky top-0 z-30 bg-gradient-to-b from-white/85 to-white/60 dark:from-slate-900/85 dark:to-slate-900/60 backdrop-blur supports-[backdrop-filter]:backdrop-blur rounded-lg ring-1 ring-black/5 dark:ring-white/10 border border-slate-300/60 dark:border-slate-600/60 shadow-sm mb-2 px-1 sm:px-2">
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: `${axisWidth}px repeat(5, 1fr)`,
                    }}
                >
                    <div className="h-10 flex items-center justify-center text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
                        {/* Axis label placeholder */}
                        <span>Time</span>
                    </div>
                    {days.map((d) => {
                        const isToday = fmtLocal(d) === todayISO;
                        return (
                            <div
                                key={fmtLocal(d)}
                                className="h-10 flex flex-col items-center justify-center py-1"
                            >
                                <div
                                    className={`text-[11px] sm:text-xs font-semibold leading-tight ${
                                        isToday
                                            ? 'text-amber-700 dark:text-amber-300'
                                            : 'text-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    {d.toLocaleDateString(undefined, {
                                        weekday: 'short',
                                    })}
                                </div>
                                <div
                                    className={`text-[10px] sm:text-[11px] font-medium ${
                                        isToday
                                            ? 'text-amber-600 dark:text-amber-200'
                                            : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                >
                                    {d.toLocaleDateString(undefined, {
                                        day: '2-digit',
                                        month: '2-digit',
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="overflow-hidden w-full">
                <div
                    className="grid gap-x-1 sm:gap-x-3 w-full relative"
                    style={{
                        gridTemplateColumns: `${axisWidth}px repeat(5, 1fr)`,
                    }}
                >
                    {/* Grid header placeholders */}
                    <div />
                    {days.map((d) => (
                        <div
                            key={fmtLocal(d)}
                            className="px-0 first:pl-0 last:pr-0 sm:px-1.5 sm:first:pl-3 sm:last:pr-3 h-0"
                        />
                    ))}

                    {/* Current time line overlay */}
                    {showNowLine && (
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -translate-y-1/2 z-40"
                            style={{
                                top: nowY,
                                left: `calc(${axisWidth}px + 0.25rem)`, // axis width + gap (responsive gap handled by CSS)
                                right: '0.25rem',
                            }}
                        >
                            <div className="relative w-full">
                                {/* Base thin line spanning full width with subtle glow - centered to align with thick overlay */}
                                <div className="h-[1px] w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-pink-500 shadow-[0_0_4px_rgba(244,63,94,0.4)] -translate-y-1/2" />

                                {/* Seamless thicker overlay for current day with tapered edges */}
                                <div
                                    className="absolute top-0 h-[3px] -translate-y-1/2"
                                    style={{
                                        left: `${
                                            (days.findIndex(
                                                (d) => fmtLocal(d) === todayISO
                                            ) /
                                                5) *
                                            100
                                        }%`,
                                        width: '20%',
                                        background: `linear-gradient(to right, 
                                            transparent 0%, 
                                            rgba(244,63,94,0.3) 2%, 
                                            rgb(244,63,94) 8%, 
                                            rgb(217,70,239) 50%, 
                                            rgb(236,72,153) 92%, 
                                            rgba(236,72,153,0.3) 98%, 
                                            transparent 100%
                                        )`,
                                        filter: 'drop-shadow(0 0 6px rgba(244,63,94,0.6))',
                                    }}
                                />

                                {/* Additional glow effect for seamless blending */}
                                <div
                                    className="absolute top-0 h-[5px] -translate-y-1/2 opacity-40"
                                    style={{
                                        left: `${
                                            (days.findIndex(
                                                (d) => fmtLocal(d) === todayISO
                                            ) /
                                                5) *
                                            100
                                        }%`,
                                        width: '20%',
                                        background: `linear-gradient(to right, 
                                            transparent 0%, 
                                            rgba(244,63,94,0.1) 5%, 
                                            rgba(244,63,94,0.6) 50%, 
                                            rgba(244,63,94,0.1) 95%, 
                                            transparent 100%
                                        )`,
                                        filter: 'blur(1px)',
                                    }}
                                />

                                {/* Time indicator dot and label positioned for current day */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2"
                                    style={{
                                        left: `${
                                            (days.findIndex(
                                                (d) => fmtLocal(d) === todayISO
                                            ) /
                                                5) *
                                            100
                                        }%`,
                                    }}
                                >
                                    {/* <div
                                        className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white/80 dark:ring-slate-900/60 shadow-lg -translate-x-1/2"
                                        style={{
                                            filter: 'drop-shadow(0 0 4px rgba(244,63,94,0.8))',
                                        }}
                                    /> */}
                                    <div className="absolute -top-[15px] -translate-x-1/2 whitespace-nowrap">
                                        <span
                                            className="rounded-full bg-rose-500/95 px-1 py-[1px] text-[10px] font-semibold text-white shadow-lg"
                                            style={{
                                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                                            }}
                                        >
                                            {fmtHM(nowMin)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <TimeAxis
                        START_MIN={START_MIN}
                        END_MIN={END_MIN}
                        SCALE={SCALE}
                        DAY_HEADER_PX={DAY_HEADER_PX}
                        BOTTOM_PAD_PX={BOTTOM_PAD_PX}
                        internalHeaderPx={internalHeaderPx}
                    />
                    {days.map((d) => {
                        const key = fmtLocal(d);
                        const items = lessonsByDay[key] || [];
                        const isToday = key === todayISO;
                        return (
                            <DayColumn
                                key={key}
                                day={d}
                                keyStr={key}
                                items={items}
                                START_MIN={START_MIN}
                                END_MIN={END_MIN}
                                SCALE={SCALE}
                                DAY_HEADER_PX={DAY_HEADER_PX}
                                BOTTOM_PAD_PX={BOTTOM_PAD_PX}
                                lessonColors={lessonColors}
                                defaultLessonColors={defaultLessonColors}
                                onLessonClick={handleLessonClick}
                                isToday={isToday}
                                gradientOffsets={gradientOffsets}
                                hideHeader
                            />
                        );
                    })}
                </div>
            </div>

            <LessonModal
                lesson={selectedLesson}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedLesson(null);

                    // Notify onboarding if active (global callback)
                    if (
                        typeof (
                            window as Window &
                                typeof globalThis & {
                                    onboardingLessonModalStateChange?: (
                                        isOpen: boolean
                                    ) => void;
                                }
                        ).onboardingLessonModalStateChange === 'function'
                    ) {
                        (
                            window as Window &
                                typeof globalThis & {
                                    onboardingLessonModalStateChange: (
                                        isOpen: boolean
                                    ) => void;
                                }
                        ).onboardingLessonModalStateChange(false);
                    }

                    // Notify parent component (Dashboard) for onboarding
                    if (onLessonModalStateChange) {
                        onLessonModalStateChange(false);
                    }
                }}
                isDeveloperMode={isDeveloperMode}
                lessonColors={lessonColors}
                defaultLessonColors={defaultLessonColors}
                isAdmin={isAdmin}
                onColorChange={onColorChange}
                gradientOffsets={gradientOffsets}
                onGradientOffsetChange={updateGradientOffset}
                isOnboardingActive={isOnboardingActive}
            />
        </div>
    );
}
