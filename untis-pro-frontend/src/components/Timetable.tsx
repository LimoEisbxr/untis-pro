import { useEffect, useMemo, useState } from 'react';
import type { Lesson, TimetableResponse, LessonColors } from '../types';
import {
    addDays,
    fmtLocal,
    startOfWeek,
    yyyymmddToISO,
    fmtHM,
} from '../utils/dates';
import LessonModal from './LessonModal';
import TimeAxis from './TimeAxis';
import DayColumn from './DayColumn';

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

    const isDeveloperModeEnabled =
        String(import.meta.env.VITE_ENABLE_DEVELOPER_MODE ?? '')
            .trim()
            .toLowerCase() === 'true';

    const [isDeveloperMode, setIsDeveloperMode] = useState(false);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleLessonClick = (lesson: Lesson) => {
        setSelectedLesson(lesson);
        setIsModalOpen(true);
    };

    const BOTTOM_PAD_PX = 12;
    const DAY_HEADER_PX = 28;

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
        <div className="w-full overflow-x-auto">
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
                className="min-w-[820px] grid gap-x-3 relative"
                style={{ gridTemplateColumns: '64px repeat(5, 1fr)' }}
            >
                {/* Grid header placeholders */}
                <div />
                {days.map((d) => (
                    <div
                        key={fmtLocal(d)}
                        className="px-1.5 first:pl-3 last:pr-3 h-0"
                    />
                ))}

                {/* Current time line overlay */}
                {showNowLine && (
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -translate-y-1/2 z-40"
                        style={{
                            top: nowY,
                            left: 'calc(64px + 0.75rem + 0.75rem)', // time axis (64px) + grid gap (0.75rem) + first column left padding (0.75rem)
                            right: '0.75rem', // last column right padding
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
                        />
                    );
                })}
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
            />
        </div>
    );
}
