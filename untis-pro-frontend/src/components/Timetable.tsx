import {
    useEffect,
    useMemo,
    useState,
    useRef,
    useLayoutEffect,
    useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import type { Lesson, TimetableResponse, LessonColors } from '../types';
import {
    addDays,
    clamp,
    fmtHM,
    fmtLocal,
    startOfWeek,
    untisToMinutes,
    yyyymmddToISO,
} from '../utils/dates';
import { DEFAULT_PERIODS } from '../utils/periods';
import {
    generateGradient,
    gradientToTailwindClasses,
    getDefaultGradient,
} from '../utils/colors';
import ColorPicker from './ColorPicker';

function FitText({
    children,
    reserveBottom = 0,
    align = 'left',
    mode = 'both',
    minScale = 0.6,
    maxScale = 2.0,
    className,
}: {
    children: React.ReactNode;
    reserveBottom?: number; // pixels to reserve at the bottom (e.g., for badges)
    align?: 'left' | 'right';
    mode?: 'height' | 'both';
    minScale?: number;
    maxScale?: number;
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const measure = () => {
            const cont = containerRef.current;
            const content = contentRef.current;
            if (!cont || !content) return;
            // Reset transform to measure natural size
            const prev = content.style.transform;
            content.style.transform = 'scale(1)';
            const cw = cont.clientWidth || 1;
            const ch = Math.max(1, (cont.clientHeight || 1) - reserveBottom);
            const sw = content.scrollWidth || 1;
            const sh = content.scrollHeight || 1;
            const sW = cw / sw;
            const sH = ch / sh;
            const raw = mode === 'height' ? sH : Math.min(sW, sH);
            const s = Math.max(minScale, Math.min(maxScale, raw));
            if (Number.isFinite(s)) setScale(s);
            // restore previous transform for React to update next paint
            content.style.transform = prev;
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (containerRef.current) ro.observe(containerRef.current);
        if (contentRef.current) ro.observe(contentRef.current);
        window.addEventListener('resize', measure);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [reserveBottom, mode, minScale, maxScale]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ position: 'relative', overflow: 'hidden', height: '100%' }}
        >
            <div
                ref={contentRef}
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin:
                        align === 'right' ? 'top right' : 'top left',
                    display: 'block',
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                }}
            >
                {children}
            </div>
        </div>
    );
}

// Modal component for lesson details
function LessonModal({
    lesson,
    isOpen,
    onClose,
    isDeveloperMode,
    lessonColors,
    defaultLessonColors,
    isAdmin,
    onColorChange,
}: {
    lesson: Lesson | null;
    isOpen: boolean;
    onClose: () => void;
    isDeveloperMode: boolean;
    lessonColors?: LessonColors;
    defaultLessonColors?: LessonColors;
    isAdmin?: boolean;
    onColorChange?: (lessonName: string, color: string | null) => void;
}) {
    const [animatingOut, setAnimatingOut] = useState(false);
    const [entered, setEntered] = useState(false);
    const [copied, setCopied] = useState(false);

    // Lock scrolling by disabling the custom scroll container
    const lockScroll = () => {
        document.documentElement.classList.add('modal-open');
    };
    const unlockScroll = () => {
        document.documentElement.classList.remove('modal-open');
    };

    // Mount for exit animation
    const shouldRender = isOpen || animatingOut;

    useEffect(() => {
        if (isOpen) {
            // trigger enter animation on next tick
            const t = setTimeout(() => setEntered(true), 0);
            lockScroll();
            return () => {
                clearTimeout(t);
                // In case modal is unmounted while open
                unlockScroll();
            };
        }
        return;
    }, [isOpen]);

    const handleClose = useCallback(() => {
        setEntered(false);
        setAnimatingOut(true);
        // allow animation to finish
        setTimeout(() => {
            setAnimatingOut(false);
            unlockScroll();
            onClose();
        }, 200);
    }, [onClose]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };
        if (shouldRender) document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [shouldRender, handleClose]);

    if (!shouldRender || !lesson) return null;

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    };

    const subject = lesson.su?.[0]?.name ?? lesson.activityType ?? '—';
    const subjectLong = lesson.su?.[0]?.longname ?? subject;
    const room = lesson.ro?.map((r) => r.name).join(', ');
    const roomLong = lesson.ro?.map((r) => r.longname || r.name).join(', ');
    const teacher = lesson.te?.map((t) => t.name).join(', ');
    const teacherLong = lesson.te?.map((t) => t.longname || t.name).join(', ');
    const startTime = fmtHM(untisToMinutes(lesson.startTime));
    const endTime = fmtHM(untisToMinutes(lesson.endTime));

    // Render the modal at the document.body level to ensure the backdrop covers the entire viewport
    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] modal-portal flex items-center justify-center p-4 transition-opacity duration-200 ${
                entered ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={handleClose}
        >
            {/* Backdrop */}
            <div
                aria-hidden
                className={`absolute inset-0 bg-black/50 backdrop-blur-lg backdrop-saturate-150 backdrop-contrast-125 transition-opacity duration-200 ${
                    entered ? 'opacity-100' : 'opacity-0'
                }`}
            />

            {/* Panel */}
            <div
                className={`relative w-full max-w-2xl max-h-[85vh] overflow-y-auto no-native-scrollbar rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md transition-all duration-200 ease-out ${
                    entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-slate-50/60 to-white/30 dark:from-slate-800/60 dark:to-slate-900/30 rounded-t-2xl">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        {isDeveloperMode
                            ? 'Lesson Data (Developer Mode)'
                            : 'Lesson Details'}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="inline-flex items-center justify-center rounded-md p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition"
                        aria-label="Close"
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
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    {isDeveloperMode ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                                    Raw JSON Data
                                </h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() =>
                                            copyToClipboard(
                                                JSON.stringify(lesson, null, 2)
                                            )
                                        }
                                        className={`px-3 py-1.5 text-sm rounded-md shadow transition inline-flex items-center gap-1 ${
                                            copied
                                                ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                        }`}
                                        aria-live="polite"
                                    >
                                        {copied ? (
                                            <>
                                                <svg
                                                    className="w-4 h-4"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth="2"
                                                        d="M5 13l4 4L19 7"
                                                    />
                                                </svg>
                                                <span>Copied</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg
                                                    className="w-4 h-4"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth="2"
                                                        d="M8 16h8M8 12h8m-7 8h6a2 2 0 002-2V7a2 2 0 00-2-2h-3.5L10 3H8a2 2 0 00-2 2v13a2 2 0 002 2z"
                                                    />
                                                </svg>
                                                <span>Copy JSON</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <pre className="bg-slate-900/90 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto ring-1 ring-black/10 dark:ring-white/10">
                                {JSON.stringify(lesson, null, 2)}
                            </pre>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                                        Subject
                                    </h3>
                                    <p className="text-slate-900 dark:text-slate-100">
                                        {subjectLong}
                                    </p>
                                    {subjectLong !== subject && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            ({subject})
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                                        Time
                                    </h3>
                                    <p className="text-slate-900 dark:text-slate-100">
                                        {startTime} - {endTime}
                                    </p>
                                </div>
                                {teacherLong && (
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                                            Teacher
                                        </h3>
                                        <p className="text-slate-900 dark:text-slate-100">
                                            {teacherLong}
                                        </p>
                                        {teacherLong !== teacher && (
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                ({teacher})
                                            </p>
                                        )}
                                    </div>
                                )}
                                {roomLong && (
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                                            Room
                                        </h3>
                                        <p className="text-slate-900 dark:text-slate-100">
                                            {roomLong}
                                        </p>
                                        {roomLong !== room && (
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                ({room})
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {lesson.code && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                                        Status
                                    </h3>
                                    <p
                                        className={`inline-block px-2 py-1 rounded-md text-xs font-semibold tracking-wide ${
                                            lesson.code === 'cancelled'
                                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                                                : lesson.code === 'irregular'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200'
                                        }`}
                                    >
                                        {lesson.code.charAt(0).toUpperCase() +
                                            lesson.code.slice(1)}
                                    </p>
                                </div>
                            )}

                            {/* Color Customization Section */}
                            {onColorChange && subject && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                                        Customize Color
                                    </h3>
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                        <ColorPicker
                                            currentColor={
                                                lessonColors?.[subject]
                                            }
                                            fallbackColor={
                                                defaultLessonColors?.[subject]
                                            }
                                            canRemoveFallback={!!isAdmin}
                                            onColorChange={(color) =>
                                                onColorChange(subject, color)
                                            }
                                            onRemoveColor={() =>
                                                onColorChange(subject, null)
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

export default function Timetable({
    data,
    weekStart,
    lessonColors = {},
    defaultLessonColors = {},
    isAdmin = false,
    onColorChange,
}: {
    data: TimetableResponse | null;
    weekStart: Date;
    lessonColors?: LessonColors;
    defaultLessonColors?: LessonColors;
    isAdmin?: boolean;
    onColorChange?: (lessonName: string, color: string | null) => void;
}) {
    const START_MIN = 7 * 60 + 40; // 07:40
    const END_MIN = 17 * 60 + 15; // 17:15
    const totalMinutes = END_MIN - START_MIN;
    const [SCALE, setSCALE] = useState<number>(1);

    // Check if developer mode should be available via environment variable
    // Be tolerant to whitespace/casing in .env values (e.g., "true ")
    const isDeveloperModeEnabled =
        String(import.meta.env.VITE_ENABLE_DEVELOPER_MODE ?? '')
            .trim()
            .toLowerCase() === 'true';

    // Developer mode and modal state
    const [isDeveloperMode, setIsDeveloperMode] = useState(false);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleLessonClick = (lesson: Lesson) => {
        setSelectedLesson(lesson);
        setIsModalOpen(true);
    };

    const BOTTOM_PAD_PX = 12;
    const DAY_HEADER_PX = 28;
    const containerHeight =
        totalMinutes * SCALE + BOTTOM_PAD_PX + DAY_HEADER_PX;
    const timesHeight = totalMinutes * SCALE;

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

    const monday = startOfWeek(weekStart);
    const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));

    // Build unique timestamp labels (dedupe touching boundaries) with a minimum vertical gap.
    const timeLabelPositions = useMemo(() => {
        const minGapPx = 15;
        const toY = (min: number) => (min - START_MIN) * SCALE;
        const maxY = (END_MIN - START_MIN) * SCALE;
        type L = { y: number; label: string };
        const labels: L[] = [];
        let prevEnd: number | null = null;
        for (let i = 0; i < DEFAULT_PERIODS.length; i++) {
            const p = DEFAULT_PERIODS[i];
            const s = untisToMinutes(p.start);
            const e = untisToMinutes(p.end);
            // Add start if it's not equal to previous period's end
            if (i === 0 || prevEnd === null || s !== prevEnd) {
                labels.push({ y: toY(s), label: fmtHM(s) });
            }
            // Always add end (next start will be skipped if equal)
            labels.push({ y: toY(e), label: fmtHM(e) });
            prevEnd = e;
        }
        labels.sort((a, b) => a.y - b.y);

        // Cluster nearby labels and distribute them evenly around their mean to avoid overlaps
        const clusters: L[][] = [];
        let current: L[] = [];
        for (const l of labels) {
            if (current.length === 0) current.push({ ...l });
            else {
                const last = current[current.length - 1];
                if (l.y - last.y < minGapPx) current.push({ ...l });
                else {
                    clusters.push(current);
                    current = [{ ...l }];
                }
            }
        }
        if (current.length) clusters.push(current);

        const out: L[] = [];
        for (const c of clusters) {
            if (c.length === 1) {
                out.push(c[0]);
                continue;
            }
            const mean = c.reduce((s, v) => s + v.y, 0) / c.length;
            const span = (c.length - 1) * minGapPx;
            let start = mean - span / 2;
            // Clamp entire cluster within bounds
            if (start < 0) start = 0;
            if (start + span > maxY) start = Math.max(0, maxY - span);
            for (let i = 0; i < c.length; i++)
                out.push({ y: start + i * minGapPx, label: c[i].label });
        }
        return out;
    }, [SCALE, START_MIN, END_MIN]);

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
            {/* Developer Mode Toggle - only show if enabled via environment variable */}
            {isDeveloperModeEnabled && (
                <div className="mb-4 flex justify-end px-1.5">
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

            <div
                className="min-w-[320px] sm:min-w-[640px] lg:min-w-[820px] grid gap-x-1 sm:gap-x-3"
                style={{ gridTemplateColumns: 'var(--time-col-width) repeat(5, 1fr)' }}
            >
                <div />
                {days.map((d) => (
                    <div
                        key={fmtLocal(d)}
                        className="px-1.5 first:pl-3 last:pr-3 h-0"
                    />
                ))}
                {/* Left-side column with lesson-based markers (numbers + times). */}
                <div
                    className="relative"
                    style={{
                        height: containerHeight,
                    }}
                >
                    {/* Centered outlined container for timestamps and lesson numbers */}
                    <div
                        className="absolute left-0 right-0"
                        style={{
                            top: 0,
                            height: DAY_HEADER_PX + timesHeight + BOTTOM_PAD_PX,
                        }}
                    >
                        <div className="mx-1 h-full rounded-md ring-1 ring-slate-900/10 dark:ring-white/10 shadow-sm overflow-hidden bg-gradient-to-b from-slate-50/85 via-slate-100/80 to-sky-50/70 dark:bg-slate-800/40 dark:bg-none relative">
                            {/* Unique time labels (deduped & gapped) */}
                            {timeLabelPositions.map((t, i) => (
                                <div
                                    key={i}
                                    className="absolute left-0 right-0 -translate-y-1/2 text-[11px] leading-none text-slate-500 dark:text-slate-400 select-none text-center"
                                    style={{ top: t.y + DAY_HEADER_PX }}
                                >
                                    {t.label}
                                </div>
                            ))}
                            {/* Big period numbers */}
                            {DEFAULT_PERIODS.map((p) => {
                                const sMin = untisToMinutes(p.start);
                                const eMin = untisToMinutes(p.end);
                                return (
                                    <div
                                        key={p.number}
                                        className="absolute left-0 right-0"
                                    >
                                        <div
                                            className="absolute left-0 right-0 -translate-y-1/2 select-none text-slate-400 dark:text-slate-500 text-center"
                                            style={{
                                                top:
                                                    ((sMin + eMin) / 2 -
                                                        START_MIN) *
                                                        SCALE +
                                                    DAY_HEADER_PX,
                                                fontSize: 22,
                                                fontWeight: 800,
                                            }}
                                        >
                                            {p.number}.
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                {days.map((d) => {
                    const key = fmtLocal(d);
                    const items = lessonsByDay[key] || [];
                    type Block = {
                        l: Lesson;
                        startMin: number;
                        endMin: number;
                        colIndex: number;
                        colCount: number;
                    };
                    const blocks: Block[] = (() => {
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
                            for (const ev of cl)
                                out.push({
                                    l: ev.l,
                                    startMin: ev.startMin,
                                    endMin: ev.endMin,
                                    colIndex: placement.get(ev)!,
                                    colCount,
                                });
                        }
                        return out;
                    })();

                    return (
                        <div
                            key={key}
                            className="relative px-1.5 first:pl-3 last:pr-3 overflow-hidden"
                            style={{ height: containerHeight }}
                        >
                            <div className="absolute inset-0 rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 shadow-sm overflow-hidden transition-colors bg-gradient-to-b from-slate-50/85 via-slate-100/80 to-sky-50/70 dark:bg-slate-800/40 dark:bg-none" />
                            <div className="absolute left-0 right-0 top-0 z-10 px-1 sm:px-2 pt-1 sm:pt-2 pointer-events-none">
                                <div className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    <span className="hidden sm:block">
                                        {d.toLocaleDateString(undefined, {
                                            weekday: 'long',
                                            month: '2-digit',
                                            day: '2-digit',
                                        })}
                                    </span>
                                    <span className="sm:hidden">
                                        {d.toLocaleDateString(undefined, {
                                            weekday: 'short',
                                            day: '2-digit',
                                        })}
                                    </span>
                                </div>
                            </div>
                            <div
                                className="absolute left-0 right-0 opacity-60 dark:opacity-40 pointer-events-none rounded-b-xl overflow-hidden"
                                style={{
                                    top: DAY_HEADER_PX,
                                    bottom: 0,
                                    backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${
                                        30 * SCALE - 1
                                    }px, rgba(100,116,139,0.12) ${
                                        30 * SCALE - 1
                                    }px, rgba(100,116,139,0.12) ${
                                        30 * SCALE
                                    }px)`,
                                }}
                            />
                            {blocks.map((b) => {
                                const { l } = b;
                                const top =
                                    (b.startMin - START_MIN) * SCALE +
                                    DAY_HEADER_PX;
                                const height = Math.max(
                                    14,
                                    (b.endMin - b.startMin) * SCALE
                                );
                                const cancelled = l.code === 'cancelled';
                                const irregular = l.code === 'irregular';
                                const subject =
                                    l.su?.[0]?.name ?? l.activityType ?? '—';
                                const room = l.ro
                                    ?.map((r) => r.name)
                                    .join(', ');
                                const teacher = l.te
                                    ?.map((t) => t.name)
                                    .join(', ');

                                // Get custom color or use default
                                const effectiveColor =
                                    lessonColors[subject] ??
                                    defaultLessonColors[subject] ??
                                    null;
                                const gradient = effectiveColor
                                    ? generateGradient(effectiveColor)
                                    : getDefaultGradient();

                                const GAP_PCT = 2.25;
                                const widthPct =
                                    (100 - GAP_PCT * (b.colCount - 1)) /
                                    b.colCount;
                                const leftPct =
                                    b.colIndex * (widthPct + GAP_PCT);
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
                                        className={`absolute rounded-md p-1.5 sm:p-2 text-xs ring-1 ring-slate-900/15 dark:ring-white/20 overflow-hidden cursor-pointer transform-gpu transition duration-150 hover:shadow-lg hover:brightness-115 hover:saturate-150 hover:contrast-110 active:scale-95 hover:-translate-y-0.5 text-white touch-manipulation ${
                                            cancelled
                                                ? 'bg-rose-500/90'
                                                : irregular
                                                ? 'bg-emerald-500/90'
                                                : ''
                                        }`}
                                        style={{
                                            top: adjTop,
                                            height: adjHeight,
                                            left: `${leftPct}%`,
                                            width: `${widthPct}%`,
                                            background: cancelled
                                                ? undefined
                                                : irregular
                                                ? undefined
                                                : gradientToTailwindClasses(
                                                      gradient
                                                  ),
                                        }}
                                        title={`${fmtHM(b.startMin)}–${fmtHM(
                                            b.endMin
                                        )} | ${subject} ${
                                            room ? `| ${room}` : ''
                                        } ${teacher ? `| ${teacher}` : ''}`}
                                        onClick={() => handleLessonClick(l)}
                                    >
                                        <div className="flex h-full min-w-0 flex-col">
                                            <div className="flex items-stretch justify-between gap-2 min-w-0 h-full">
                                                <FitText
                                                    mode="both"
                                                    maxScale={1.8}
                                                    reserveBottom={0}
                                                    className="min-w-0 self-stretch"
                                                >
                                                    <div className="font-semibold">
                                                        {subject}
                                                    </div>
                                                    <div className="opacity-90">
                                                        <span className="whitespace-nowrap">
                                                            {fmtHM(b.startMin)}–
                                                            {fmtHM(b.endMin)}
                                                        </span>
                                                    </div>
                                                    {teacher && (
                                                        <div className="opacity-90">
                                                            {teacher}
                                                        </div>
                                                    )}
                                                </FitText>
                                                {room && (
                                                    <FitText
                                                        mode="both"
                                                        maxScale={1.8}
                                                        reserveBottom={
                                                            cancelled ||
                                                            irregular
                                                                ? 16
                                                                : 0
                                                        }
                                                        align="right"
                                                        className="min-w-0 max-w-[45%] text-right self-stretch"
                                                    >
                                                        <div>{room}</div>
                                                    </FitText>
                                                )}
                                            </div>
                                            {cancelled && (
                                                <div className="absolute bottom-1 right-2 text-right text-[10px] font-semibold uppercase tracking-wide">
                                                    Cancelled
                                                </div>
                                            )}
                                            {irregular && (
                                                <div className="absolute bottom-1 right-2 text-right text-[10px] font-semibold uppercase tracking-wide">
                                                    Irregular
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

            {/* Lesson Detail Modal */}
            <LessonModal
                lesson={selectedLesson}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedLesson(null);
                }}
                isDeveloperMode={isDeveloperMode}
                lessonColors={lessonColors}
                defaultLessonColors={defaultLessonColors}
                isAdmin={isAdmin}
                onColorChange={onColorChange}
            />
        </div>
    );
}
