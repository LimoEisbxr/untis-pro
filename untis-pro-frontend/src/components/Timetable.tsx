import { useEffect, useMemo, useState } from 'react';
import type { Lesson, TimetableResponse, LessonColors } from '../types';
import {
    addDays,
    fmtLocal,
    startOfWeek,
    yyyymmddToISO,
    fmtHM,
} from '../utils/dates';
import { setLessonColor } from '../api';
import LessonModal from './LessonModal';
import TimeAxis from './TimeAxis';
import DayColumn from './DayColumn';
// (Mobile vertical layout removed; keeping original horizontal week view across breakpoints)

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
    // Extended: allow passing current offset when color set
    // (so initial color creation can persist chosen offset)
    // Keeping backwards compatibility (third param optional)
}) {
    const START_MIN = 7 * 60 + 40; // 07:40
    const END_MIN = 17 * 60 + 15; // 17:15
    const totalMinutes = END_MIN - START_MIN;
    const [SCALE, setSCALE] = useState<number>(1);
    const [axisWidth, setAxisWidth] = useState<number>(56); // narrower on very small screens

    const isDeveloperModeEnabled =
        String(import.meta.env.VITE_ENABLE_DEVELOPER_MODE ?? '')
            .trim()
            .toLowerCase() === 'true';

    const [isDeveloperMode, setIsDeveloperMode] = useState(false);
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

    const updateGradientOffset = (lessonName: string, offset: number) => {
        setGradientOffsets((prev) => {
            const next = { ...prev };
            if (offset === 0.5) {
                delete next[lessonName];
            } else {
                next[lessonName] = offset;
            }
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
            } catch {
                /* ignore */
            }
            return next;
        });
        // Only persist offset if there is an explicit color override (user or admin)
        const hasExplicitColor =
            !!lessonColors[lessonName] || !!defaultLessonColors[lessonName];
        if (token && hasExplicitColor) {
            const color =
                lessonColors[lessonName] || defaultLessonColors[lessonName]!;
            setLessonColor(
                token,
                lessonName,
                color,
                viewingUserId,
                offset
            ).catch(() => undefined);
        }
    };

    const handleLessonClick = (lesson: Lesson) => {
        setSelectedLesson(lesson);
        setIsModalOpen(true);
    };

    const BOTTOM_PAD_PX = 12;
    const [DAY_HEADER_PX, setDAY_HEADER_PX] = useState(28);

    useEffect(() => {
        function computeScale() {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
            const isMobile =
                typeof window !== 'undefined' && window.innerWidth < 640;
            // Increase desired pixel height on mobile so cards become taller
            const baseTarget = isMobile ? 900 : 540; // bigger vertical canvas on mobile
            const desired = Math.max(
                baseTarget,
                Math.floor(vh * (isMobile ? 1.2 : 0.8))
            );
            setSCALE(desired / totalMinutes);
            if (typeof window !== 'undefined') {
                setAxisWidth(isMobile ? 44 : 56);
                setDAY_HEADER_PX(isMobile ? 42 : 28);
            }
        }
        computeScale();
        window.addEventListener('resize', computeScale);
        return () => window.removeEventListener('resize', computeScale);
    }, [totalMinutes]);

    const monday = startOfWeek(weekStart);
    const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));

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
    const nowY = (nowMin - START_MIN) * SCALE + DAY_HEADER_PX;

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
                (a, b) => a.startTime - b.startTime || a.endTime - b.endTime
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
        <div className="w-full overflow-x-hidden">
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
                                left: `calc(${axisWidth}px + 0.75rem)`, // axis width + gap (sm gap handled by responsive CSS)
                                right: '0.75rem',
                            }}
                        >
                            <div className="flex items-center">
                                <div className="relative w-full">
                                    <div className="h-[2px] w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-pink-500 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]" />
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white/80 dark:ring-slate-900/60 shadow-md" />
                                    <div className="absolute left-0 -top-5 -translate-x-1/2 whitespace-nowrap">
                                        <span className="rounded-full bg-rose-500/90 px-2 py-[2px] text-[10px] font-semibold text-white shadow">
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
                }}
                isDeveloperMode={isDeveloperMode}
                lessonColors={lessonColors}
                defaultLessonColors={defaultLessonColors}
                isAdmin={isAdmin}
                onColorChange={onColorChange}
                gradientOffsets={gradientOffsets}
                onGradientOffsetChange={updateGradientOffset}
            />
        </div>
    );
}
