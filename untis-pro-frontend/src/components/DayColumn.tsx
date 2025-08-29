import type { FC } from 'react';
import FitText from './FitText';
import type { Lesson, LessonColors } from '../types';
import { fmtHM, untisToMinutes } from '../utils/dates';
import { clamp } from '../utils/dates';
import { generateGradient, getDefaultGradient } from '../utils/colors';

export type Block = {
    l: Lesson;
    startMin: number;
    endMin: number;
    colIndex: number;
    colCount: number;
};

export type DayColumnProps = {
    day: Date;
    keyStr: string;
    items: Lesson[];
    START_MIN: number;
    END_MIN: number;
    SCALE: number;
    DAY_HEADER_PX: number;
    BOTTOM_PAD_PX: number;
    lessonColors: LessonColors;
    defaultLessonColors: LessonColors;
    onLessonClick: (lesson: Lesson) => void;
    gradientOffsets?: Record<string, number>; // subject -> offset (0..1)
};

const DayColumn: FC<DayColumnProps> = ({
    day,
    keyStr,
    items,
    START_MIN,
    END_MIN,
    SCALE,
    DAY_HEADER_PX,
    BOTTOM_PAD_PX,
    lessonColors,
    defaultLessonColors,
    onLessonClick,
    gradientOffsets,
}) => {
    const containerHeight =
        (END_MIN - START_MIN) * SCALE + BOTTOM_PAD_PX + DAY_HEADER_PX;

    type ClusterBlock = {
        l: Lesson;
        startMin: number;
        endMin: number;
    };

    const blocks: Block[] = (() => {
        const evs: ClusterBlock[] = items
            .map((l) => {
                const s = clamp(
                    untisToMinutes(l.startTime),
                    START_MIN,
                    END_MIN
                );
                const e = Math.max(
                    s,
                    clamp(untisToMinutes(l.endTime), START_MIN, END_MIN)
                );
                return { l, startMin: s, endMin: e };
            })
            .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
        const clusters: Array<ClusterBlock[]> = [];
        let current: ClusterBlock[] = [];
        let curMaxEnd = -1;
        for (const ev of evs) {
            if (current.length === 0 || ev.startMin < curMaxEnd) {
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
            const columns: Array<ClusterBlock[]> = [];
            const placement = new Map<ClusterBlock, number>();
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
            key={keyStr}
            className="relative px-1.5 first:pl-3 last:pr-3 overflow-hidden"
            style={{ height: containerHeight }}
        >
            <div className="absolute inset-0 rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 shadow-sm overflow-hidden transition-colors bg-gradient-to-b from-slate-50/85 via-slate-100/80 to-sky-50/70 dark:bg-slate-800/40 dark:bg-none" />
            <div className="absolute left-0 right-0 top-0 z-10 px-2 pt-2 pointer-events-none">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {day.toLocaleDateString(undefined, {
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
                    }px, rgba(100,116,139,0.12) ${30 * SCALE}px)`,
                }}
            />
            {blocks.map((b) => {
                const { l } = b;
                const top = (b.startMin - START_MIN) * SCALE + DAY_HEADER_PX;
                const height = Math.max(14, (b.endMin - b.startMin) * SCALE);
                const cancelled = l.code === 'cancelled';
                const irregular = l.code === 'irregular';
                const subject = l.su?.[0]?.name ?? l.activityType ?? '—';
                const room = l.ro?.map((r) => r.name).join(', ');
                const teacher = l.te?.map((t) => t.name).join(', ');

                const effectiveColor =
                    lessonColors[subject] ??
                    defaultLessonColors[subject] ??
                    null;
                const offset = gradientOffsets?.[subject] ?? 0.5;
                const gradient = effectiveColor
                    ? generateGradient(effectiveColor, offset)
                    : getDefaultGradient();

                const GAP_PCT = 2.25;
                const widthPct =
                    (100 - GAP_PCT * (b.colCount - 1)) / b.colCount;
                const leftPct = b.colIndex * (widthPct + GAP_PCT);
                const PAD_TOP = 4;
                const PAD_BOTTOM = 4;
                const adjTop = top + PAD_TOP;
                const adjHeight = Math.max(12, height - (PAD_TOP + PAD_BOTTOM));

                return (
                    <div
                        key={l.id}
                        className={`absolute rounded-md p-2 text-xs ring-1 ring-slate-900/15 dark:ring-white/20 overflow-hidden cursor-pointer transform-gpu transition duration-150 hover:shadow-lg hover:brightness-115 hover:saturate-150 hover:contrast-110 hover:-translate-y-0.5 text-white ${
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
                                : (`linear-gradient(to right, ${gradient.from}, ${gradient.via}, ${gradient.to})` as string),
                        }}
                        title={`${fmtHM(b.startMin)}–${fmtHM(
                            b.endMin
                        )} | ${subject} ${room ? `| ${room}` : ''} ${
                            teacher ? `| ${teacher}` : ''
                        }`}
                        onClick={() => onLessonClick(l)}
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
                                            cancelled || irregular ? 16 : 0
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
};

export default DayColumn;
