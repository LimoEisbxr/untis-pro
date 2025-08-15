import { useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react';
import type { Lesson, TimetableResponse } from '../types';
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

export default function Timetable({
    data,
    weekStart,
}: {
    data: TimetableResponse | null;
    weekStart: Date;
}) {
    const START_MIN = 7 * 60 + 40; // 07:40
    const END_MIN = 17 * 60 + 15; // 17:15
    const totalMinutes = END_MIN - START_MIN;
    const [SCALE, setSCALE] = useState<number>(1);
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
            <div
                className="min-w-[820px] grid gap-x-3"
                style={{ gridTemplateColumns: '64px repeat(5, 1fr)' }}
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
                            className="relative px-1.5 first:pl-3 last:pr-3"
                            style={{ height: containerHeight }}
                        >
                            <div className="absolute inset-0 rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 shadow-sm overflow-hidden transition-colors bg-gradient-to-b from-slate-50/85 via-slate-100/80 to-sky-50/70 dark:bg-slate-800/40 dark:bg-none" />
                            <div className="absolute left-0 right-0 top-0 z-10 px-2 pt-2 pointer-events-none">
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {d.toLocaleDateString(undefined, {
                                        weekday: 'long',
                                        month: '2-digit',
                                        day: '2-digit',
                                    })}
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
                                        className={`absolute rounded-md p-2 text-xs ring-1 ring-slate-900/15 dark:ring-white/20 overflow-hidden ${
                                            cancelled
                                                ? 'bg-rose-500/90 text-white'
                                                : irregular
                                                ? 'bg-emerald-500/90 text-white'
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
        </div>
    );
}
