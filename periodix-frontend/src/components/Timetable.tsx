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
import {
    shouldNavigateWeek,
    applyRubberBandResistance,
} from '../utils/timetable/layout';
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
    hideAdminDefaults = false,
    isAdmin = false,
    onColorChange,
    serverLessonOffsets = {},
    token,
    viewingUserId,
    onWeekNavigate,
    getAdjacentWeekData,
    onLessonModalStateChange,
    isOnboardingActive,
    onRefresh,
}: {
    data: TimetableResponse | null;
    weekStart: Date;
    lessonColors?: LessonColors;
    defaultLessonColors?: LessonColors;
    hideAdminDefaults?: boolean;
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
    getAdjacentWeekData?: (
        direction: 'prev' | 'next'
    ) => TimetableResponse | null; // function to get cached data for adjacent weeks
    onLessonModalStateChange?: (isOpen: boolean) => void; // callback for onboarding
    isOnboardingActive?: boolean;
    onRefresh?: () => Promise<void>; // callback for pull-to-refresh
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

    // Multi-week data for sliding animation
    const prevWeekMonday = useMemo(() => addDays(monday, -7), [monday]);
    const nextWeekMonday = useMemo(() => addDays(monday, 7), [monday]);

    const prevWeekDays = useMemo(
        () => Array.from({ length: 5 }, (_, i) => addDays(prevWeekMonday, i)),
        [prevWeekMonday]
    );

    const nextWeekDays = useMemo(
        () => Array.from({ length: 5 }, (_, i) => addDays(nextWeekMonday, i)),
        [nextWeekMonday]
    );

    // Advanced swipe animation for smooth week navigation
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const touchStartTime = useRef<number | null>(null);
    const lastMoveXRef = useRef<number | null>(null);
    const lastMoveTimeRef = useRef<number | null>(null);
    const flingVelocityRef = useRef<number>(0); // px per second captured at release
    const [translateX, setTranslateX] = useState(0); // Current transform offset
    const [isDragging, setIsDragging] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const slidingTrackRef = useRef<HTMLDivElement | null>(null);

    // Pull-to-refresh state
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCompletingRefresh, setIsCompletingRefresh] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const refreshThreshold = 100; // Distance needed to trigger refresh

    const animationRef = useRef<number | null>(null);
    const translateXRef = useRef(0); // keep latest translateX for animation starts
    useEffect(() => {
        translateXRef.current = translateX;
    }, [translateX]);
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        // Capture the ref at the beginning of the effect
        const currentAnimationRef = animationRef.current;

        let skipSwipe = false;
        let wheelDeltaX = 0;
        let wheelDeltaY = 0;
        let wheelTimeout: number | null = null;
        const INTERACTIVE_SELECTOR =
            'input,textarea,select,button,[contenteditable="true"],[role="textbox"]';

        const handleTouchStart = (e: TouchEvent) => {
            if (
                e.touches.length !== 1 ||
                isAnimating ||
                isRefreshing ||
                isCompletingRefresh ||
                isAnimatingOut
            )
                return;
            const target = e.target as HTMLElement | null;
            // Ignore swipe if user starts on an interactive control
            if (
                target &&
                (target.closest(INTERACTIVE_SELECTOR) ||
                    target.tagName === 'INPUT')
            ) {
                skipSwipe = true;
                return;
            }

            skipSwipe = false;
            setIsDragging(true);
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            touchStartTime.current = Date.now();
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (
                skipSwipe ||
                !isDragging ||
                touchStartX.current == null ||
                touchStartY.current == null
            )
                return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const dx = currentX - touchStartX.current;
            const dy = currentY - touchStartY.current;

            // Check if this is a downward swipe at the top of the page
            const isAtTop = el.scrollTop <= 5; // Allow small tolerance for scroll position
            const isDownwardSwipe =
                dy > 0 && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 20;

            if (isAtTop && isDownwardSwipe && onRefresh) {
                // This is a pull-to-refresh gesture
                e.preventDefault();
                setIsPulling(true);

                // Calculate pull distance with resistance
                let distance = dy;
                if (distance > refreshThreshold) {
                    // Add resistance when pulling beyond threshold
                    distance = refreshThreshold + (dy - refreshThreshold) * 0.3;
                }

                setPullDistance(
                    Math.max(0, Math.min(distance, refreshThreshold * 1.5))
                );
                return;
            }

            // Check if this is more of a vertical scroll (but not pull-to-refresh)
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 20) {
                skipSwipe = true;
                setIsDragging(false);
                setTranslateX(0);
                setIsPulling(false);
                setPullDistance(0);
                return;
            }

            // Reset pull-to-refresh state if it was a horizontal gesture
            if (isPulling) {
                setIsPulling(false);
                setPullDistance(0);
            }
            // Prevent default only for horizontal swipes to avoid conflicts with scrolling
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
                e.preventDefault();
            }

            // Update transform with improved rubber band resistance
            const containerWidth = el.getBoundingClientRect().width;
            const newTranslateX = applyRubberBandResistance(dx, containerWidth);

            setTranslateX(newTranslateX);

            // Track recent movement for velocity (use last segment for fling feel)
            lastMoveXRef.current = currentX;
            lastMoveTimeRef.current = performance.now();
        };

        const performNavigation = (
            direction: 'prev' | 'next',
            userVelocityPxPerSec?: number
        ) => {
            if (isAnimating) return;
            setIsAnimating(true);

            // Cancel any in‑flight animation
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }

            // Determine precise stride (distance between week centers) to avoid gap/overshoot.
            let targetX: number;
            const startX = translateXRef.current; // may be partial if user let go mid-drag
            const track = slidingTrackRef.current;
            if (track) {
                const weekEls = Array.from(track.children) as HTMLElement[]; // [prev,current,next]
                if (weekEls.length === 3) {
                    const currentBox = weekEls[1].getBoundingClientRect();
                    // Measure stride using adjacent week's left delta (accounts for gap + exact width)
                    const nextBox = weekEls[2].getBoundingClientRect();
                    const prevBox = weekEls[0].getBoundingClientRect();
                    const strideNext = nextBox.left - currentBox.left;
                    const stridePrev = currentBox.left - prevBox.left;
                    const stride =
                        direction === 'next' ? strideNext : stridePrev;
                    targetX = direction === 'next' ? -stride : stride; // move opposite to direction to reveal that week
                } else {
                    // Fallback: approximate using container width minus axis column (prevents large overshoot)
                    const fullWidth = el.getBoundingClientRect().width;
                    targetX =
                        direction === 'next'
                            ? -(fullWidth - axisWidth)
                            : fullWidth - axisWidth;
                }
            } else {
                const fullWidth = el.getBoundingClientRect().width;
                targetX =
                    direction === 'next'
                        ? -(fullWidth - axisWidth)
                        : fullWidth - axisWidth;
            }
            const delta = targetX - startX;

            // Determine duration based on stride & user swipe velocity (if provided)
            const stride = Math.abs(delta);
            const DEFAULT_SPEED = 1900; // px/sec baseline similar to prior perceived speed
            const MIN_DURATION = 180; // ms
            const MAX_DURATION = 520; // ms (fallback upper bound)
            const speed = Math.min(
                6000,
                Math.max(900, userVelocityPxPerSec || DEFAULT_SPEED)
            );
            let DURATION = (stride / speed) * 1000; // ms
            if (!isFinite(DURATION)) DURATION = 380;
            DURATION = Math.min(MAX_DURATION, Math.max(MIN_DURATION, DURATION));
            const durationMs = DURATION; // capture for closure clarity
            const startTime = performance.now();

            // Mild ease-out to mask discrete frame finish while keeping momentum feel
            const ease = (t: number) => {
                if (t <= 0) return 0;
                if (t >= 1) return 1;
                // easeOutCubic
                const u = 1 - t;
                return 1 - u * u * u;
            };

            const step = (now: number) => {
                const t = Math.min(1, (now - startTime) / durationMs);
                const eased = ease(t);
                setTranslateX(startX + delta * eased);
                if (t < 1) {
                    animationRef.current = requestAnimationFrame(step);
                } else {
                    // Finalize at exact target to avoid sub‑pixel remainder
                    setTranslateX(targetX);
                    // Immediately swap week (without visible jump) by resetting translateX after data update
                    // Use rAF so layout with final frame paints first
                    requestAnimationFrame(() => {
                        onWeekNavigate?.(direction);
                        // Reset without animation: just place new current week centered
                        setTranslateX(0);
                        setIsAnimating(false);
                    });
                }
            };
            animationRef.current = requestAnimationFrame(step);
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (skipSwipe) {
                skipSwipe = false;
                setIsDragging(false);
                setTranslateX(0);
                setIsPulling(false);
                setPullDistance(0);
                return;
            }

            if (
                !isDragging ||
                touchStartX.current == null ||
                touchStartY.current == null ||
                touchStartTime.current == null
            ) {
                setIsDragging(false);
                setTranslateX(0);
                setIsPulling(false);
                setPullDistance(0);
                return;
            }

            const currentX = e.changedTouches[0].clientX;
            const currentY = e.changedTouches[0].clientY;

            setIsDragging(false);

            // Handle pull-to-refresh
            if (isPulling && onRefresh && pullDistance >= refreshThreshold) {
                setIsRefreshing(true);
                setIsPulling(false);
                setPullDistance(0);

                onRefresh()
                    .then(() => {
                        // Start completion phase with loading circle
                        setIsRefreshing(false);
                        setIsCompletingRefresh(true);

                        // Show completion loading for 1 second, then animate out
                        setTimeout(() => {
                            setIsCompletingRefresh(false);
                            setIsAnimatingOut(true);

                            // Complete the animation after flying out
                            setTimeout(() => {
                                setIsAnimatingOut(false);
                            }, 500); // Animation duration
                        }, 1000); // 1 second loading circle
                    })
                    .catch((error) => {
                        console.error('Refresh failed:', error);
                        setIsRefreshing(false);
                    });

                touchStartX.current = null;
                touchStartY.current = null;
                touchStartTime.current = null;
                return;
            }

            // Reset pull-to-refresh state if threshold not reached
            if (isPulling) {
                setIsPulling(false);
                setPullDistance(0);
            }

            // Use improved navigation detection
            const navigation = shouldNavigateWeek(
                touchStartX.current,
                touchStartY.current,
                currentX,
                currentY,
                touchStartTime.current
            );

            if (navigation.shouldNavigate && navigation.direction) {
                // Compute fling velocity using last segment vs touch start for fallback
                let velocity = flingVelocityRef.current;
                if (
                    !velocity &&
                    lastMoveXRef.current != null &&
                    lastMoveTimeRef.current != null &&
                    touchStartX.current != null &&
                    touchStartTime.current != null
                ) {
                    const dtTotal =
                        (performance.now() - touchStartTime.current) / 1000; // s
                    const dxTotal = lastMoveXRef.current - touchStartX.current; // px
                    if (dtTotal > 0) velocity = Math.abs(dxTotal / dtTotal); // px/s
                }
                performNavigation(navigation.direction, velocity);
            } else {
                // Snap back to current position
                setTranslateX(0);
            }

            touchStartX.current = null;
            touchStartY.current = null;
            touchStartTime.current = null;
        };

        const handleWheel = (e: WheelEvent) => {
            if (isAnimating) return;

            const target = e.target as HTMLElement | null;
            // Ignore wheel if user is over an interactive control
            if (
                target &&
                (target.closest(INTERACTIVE_SELECTOR) ||
                    target.tagName === 'INPUT')
            ) {
                return;
            }

            // Accumulate wheel delta for trackpad gesture detection
            wheelDeltaX += e.deltaX;
            wheelDeltaY += e.deltaY;

            // Clear previous timeout
            if (wheelTimeout) {
                clearTimeout(wheelTimeout);
            }

            // Check if this is primarily a horizontal gesture
            const isHorizontalGesture =
                Math.abs(wheelDeltaX) > Math.abs(wheelDeltaY) * 2;

            if (isHorizontalGesture) {
                // Prevent default to avoid horizontal scrolling
                e.preventDefault();

                // Determine if we've accumulated enough delta for navigation
                const WHEEL_THRESHOLD = 100;

                if (Math.abs(wheelDeltaX) > WHEEL_THRESHOLD) {
                    const direction = wheelDeltaX > 0 ? 'next' : 'prev';
                    // Wheel gestures: approximate speed from accumulated delta & time window
                    const gestureSpeed = Math.min(
                        5000,
                        Math.max(1200, Math.abs(wheelDeltaX) * 12)
                    );
                    performNavigation(direction, gestureSpeed);

                    // Reset wheel delta after navigation
                    wheelDeltaX = 0;
                    wheelDeltaY = 0;
                    return;
                }
            }

            // Reset wheel delta after a short delay if no navigation occurred
            wheelTimeout = window.setTimeout(() => {
                wheelDeltaX = 0;
                wheelDeltaY = 0;
            }, 150);
        };

        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        el.addEventListener('touchend', handleTouchEnd, { passive: true });
        el.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
            el.removeEventListener('wheel', handleWheel);
            if (wheelTimeout) {
                clearTimeout(wheelTimeout);
            }
            // Use the captured ref value for cleanup
            if (currentAnimationRef) cancelAnimationFrame(currentAnimationRef);
        };
    }, [
        onWeekNavigate,
        isDragging,
        isAnimating,
        axisWidth,
        isPulling,
        isRefreshing,
        isCompletingRefresh,
        isAnimatingOut,
        onRefresh,
        pullDistance,
    ]);

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

    // Process previous week's data
    const prevWeekLessonsByDay = useMemo(() => {
        const byDay: Record<string, Lesson[]> = {};
        for (const d of prevWeekDays) byDay[fmtLocal(d)] = [];

        const prevWeekData = getAdjacentWeekData?.('prev');
        const lessons = Array.isArray(prevWeekData?.payload)
            ? (prevWeekData?.payload as Lesson[])
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
    }, [prevWeekDays, getAdjacentWeekData]);

    // Process next week's data
    const nextWeekLessonsByDay = useMemo(() => {
        const byDay: Record<string, Lesson[]> = {};
        for (const d of nextWeekDays) byDay[fmtLocal(d)] = [];

        const nextWeekData = getAdjacentWeekData?.('next');
        const lessons = Array.isArray(nextWeekData?.payload)
            ? (nextWeekData?.payload as Lesson[])
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
    }, [nextWeekDays, getAdjacentWeekData]);

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
            className="relative w-full overflow-x-hidden pt-[env(safe-area-inset-top)]"
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

            {/* Pull-to-refresh indicator - overlaid above everything */}
            {(isPulling ||
                isRefreshing ||
                isCompletingRefresh ||
                isAnimatingOut) && (
                <div
                    className={`absolute top-0 left-0 right-0 z-50 flex justify-center items-center py-3 transition-all duration-300 ease-out ${
                        isAnimatingOut
                            ? 'animate-[flyOut_500ms_ease-in_forwards]'
                            : ''
                    }`}
                    style={{
                        transform: isAnimatingOut
                            ? 'translateY(-100px)'
                            : `translateY(${
                                  isPulling
                                      ? Math.max(0, pullDistance * 0.8)
                                      : 20
                              }px)`,
                        opacity: isAnimatingOut
                            ? 0
                            : isPulling
                            ? Math.min(1, pullDistance / refreshThreshold)
                            : 1,
                        transition: isAnimatingOut
                            ? 'transform 500ms ease-in, opacity 500ms ease-in'
                            : 'all 300ms ease-out',
                    }}
                >
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur rounded-full shadow-lg border border-slate-200/60 dark:border-slate-600/60 text-slate-600 dark:text-slate-400">
                        {isRefreshing ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-sky-600 border-t-transparent"></div>
                                <span className="text-sm font-medium">
                                    Refreshing...
                                </span>
                            </>
                        ) : isCompletingRefresh ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-600 border-t-transparent"></div>
                                <span className="text-sm font-medium">
                                    Complete!
                                </span>
                            </>
                        ) : (
                            <>
                                <div
                                    className={`transition-transform duration-200 ${
                                        pullDistance >= refreshThreshold
                                            ? 'rotate-180'
                                            : ''
                                    }`}
                                >
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                        />
                                    </svg>
                                </div>
                                <span className="text-sm font-medium">
                                    {pullDistance >= refreshThreshold
                                        ? 'Release to refresh'
                                        : 'Pull to refresh'}
                                </span>
                            </>
                        )}
                    </div>
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
                {/* New sliding layout structure */}
                <div className="flex w-full relative">
                    {/* Fixed TimeAxis - stays in place */}
                    <div style={{ width: `${axisWidth}px` }}>
                        <TimeAxis
                            START_MIN={START_MIN}
                            END_MIN={END_MIN}
                            SCALE={SCALE}
                            DAY_HEADER_PX={DAY_HEADER_PX}
                            BOTTOM_PAD_PX={BOTTOM_PAD_PX}
                            internalHeaderPx={internalHeaderPx}
                        />
                    </div>

                    {/* Sliding container for day columns */}
                    <div className="flex-1 overflow-hidden relative">
                        {/* Subtle overlay during dragging to indicate interaction */}
                        {isDragging && (
                            <div className="absolute inset-0 bg-black/5 dark:bg-white/5 z-20 pointer-events-none transition-opacity duration-150" />
                        )}
                        <div
                            ref={slidingTrackRef}
                            className="flex"
                            style={{
                                transform: `translateX(calc(-33.333% + ${translateX}px))`,
                                width: '300%',
                                // We fully manage animation via requestAnimationFrame; disable CSS transitions to prevent conflicts
                                transition: 'none',
                                gap: '0.75rem',
                            }}
                        >
                            {/* Previous Week */}
                            <div
                                className="flex gap-x-1 sm:gap-x-3 relative"
                                style={{ width: 'calc(33.333% - 0.5rem)' }}
                            >
                                {prevWeekDays.map((d) => {
                                    const key = fmtLocal(d);
                                    const items =
                                        prevWeekLessonsByDay[key] || [];
                                    return (
                                        <div key={key} className="flex-1">
                                            <DayColumn
                                                day={d}
                                                keyStr={key}
                                                items={items}
                                                START_MIN={START_MIN}
                                                END_MIN={END_MIN}
                                                SCALE={SCALE}
                                                DAY_HEADER_PX={DAY_HEADER_PX}
                                                BOTTOM_PAD_PX={BOTTOM_PAD_PX}
                                                lessonColors={lessonColors}
                                                defaultLessonColors={
                                                    defaultLessonColors
                                                }
                                                hideAdminDefaults={hideAdminDefaults}
                                                onLessonClick={
                                                    handleLessonClick
                                                }
                                                isToday={false}
                                                gradientOffsets={
                                                    gradientOffsets
                                                }
                                                hideHeader
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Current Week */}
                            <div
                                className="flex gap-x-1 sm:gap-x-3 relative"
                                style={{ width: 'calc(33.333% - 0.5rem)' }}
                            >
                                {/* Current time line overlay - only show on current week */}
                                {showNowLine && (
                                    <div
                                        aria-hidden
                                        className="pointer-events-none absolute -translate-y-1/2 z-40"
                                        style={{
                                            top: nowY,
                                            left: '0.25rem',
                                            right: '0.25rem',
                                        }}
                                    >
                                        <div className="relative w-full">
                                            {/* Base thin line spanning full width with subtle glow */}
                                            <div className="h-[1px] w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-pink-500 shadow-[0_0_4px_rgba(244,63,94,0.4)] -translate-y-1/2" />

                                            {/* Seamless thicker overlay for current day with tapered edges */}
                                            <div
                                                className="absolute top-0 h-[3px] -translate-y-1/2"
                                                style={{
                                                    left: `${
                                                        (days.findIndex(
                                                            (d) =>
                                                                fmtLocal(d) ===
                                                                todayISO
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
                                                            (d) =>
                                                                fmtLocal(d) ===
                                                                todayISO
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
                                                            (d) =>
                                                                fmtLocal(d) ===
                                                                todayISO
                                                        ) /
                                                            5) *
                                                        100
                                                    }%`,
                                                }}
                                            >
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

                                {days.map((d) => {
                                    const key = fmtLocal(d);
                                    const items = lessonsByDay[key] || [];
                                    const isToday = key === todayISO;
                                    return (
                                        <div key={key} className="flex-1">
                                            <DayColumn
                                                day={d}
                                                keyStr={key}
                                                items={items}
                                                START_MIN={START_MIN}
                                                END_MIN={END_MIN}
                                                SCALE={SCALE}
                                                DAY_HEADER_PX={DAY_HEADER_PX}
                                                BOTTOM_PAD_PX={BOTTOM_PAD_PX}
                                                lessonColors={lessonColors}
                                                defaultLessonColors={
                                                    defaultLessonColors
                                                }
                                                hideAdminDefaults={hideAdminDefaults}
                                                onLessonClick={
                                                    handleLessonClick
                                                }
                                                isToday={isToday}
                                                gradientOffsets={
                                                    gradientOffsets
                                                }
                                                hideHeader
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Next Week */}
                            <div
                                className="flex gap-x-1 sm:gap-x-3 relative"
                                style={{ width: 'calc(33.333% - 0.5rem)' }}
                            >
                                {nextWeekDays.map((d) => {
                                    const key = fmtLocal(d);
                                    const items =
                                        nextWeekLessonsByDay[key] || [];
                                    return (
                                        <div key={key} className="flex-1">
                                            <DayColumn
                                                day={d}
                                                keyStr={key}
                                                items={items}
                                                START_MIN={START_MIN}
                                                END_MIN={END_MIN}
                                                SCALE={SCALE}
                                                DAY_HEADER_PX={DAY_HEADER_PX}
                                                BOTTOM_PAD_PX={BOTTOM_PAD_PX}
                                                lessonColors={lessonColors}
                                                defaultLessonColors={
                                                    defaultLessonColors
                                                }
                                                hideAdminDefaults={hideAdminDefaults}
                                                onLessonClick={
                                                    handleLessonClick
                                                }
                                                isToday={false}
                                                gradientOffsets={
                                                    gradientOffsets
                                                }
                                                hideHeader
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
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
