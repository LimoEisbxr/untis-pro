import type { FC } from 'react';
import { useEffect, useState } from 'react';
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
    isToday?: boolean;
    gradientOffsets?: Record<string, number>; // subject -> offset (0..1)
    hideHeader?: boolean; // suppress built-in header (used when external sticky header is rendered)
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
    isToday = false,
    gradientOffsets,
    hideHeader = false,
}) => {
    // Detect mobile (tailwind sm breakpoint <640px). Responsive hook to decide hiding side-by-side overlaps.
    const [isMobile, setIsMobile] = useState<boolean>(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)');
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    const headerPx = hideHeader ? 8 : DAY_HEADER_PX; // minimal spacer when external sticky header used
    const containerHeight =
        (END_MIN - START_MIN) * SCALE + BOTTOM_PAD_PX + headerPx;

    // Precompute whether we should show denser or sparser grid lines (mobile gets 60‑min lines)
    const gridSlotMinutes = isMobile ? 60 : 30;

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

    // Track the last bottom pixel per visual column signature to enforce gaps
    const lastBottomByCol: Record<string, number> = {};

    return (
        <div
            key={keyStr}
            className="relative px-1.5 first:pl-3 last:pr-3 overflow-hidden rounded-xl"
            style={{ height: containerHeight }}
        >
            <div className="absolute inset-0 rounded-xl ring-1 ring-slate-900/10 dark:ring-white/10 shadow-sm overflow-hidden transition-colors bg-gradient-to-b from-slate-50/85 via-slate-100/80 to-sky-50/70 dark:bg-slate-800/40 dark:bg-none" />
            {/* Today highlight overlay */}
            {isToday && (
                <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                    <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_0_2px_rgba(251,191,36,0.35)]" />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-amber-200/20 via-amber-200/10 to-transparent dark:from-amber-300/15 dark:via-amber-300/10" />
                </div>
            )}

            {!hideHeader && (
                <div className="absolute left-0 right-0 top-0 z-10 pointer-events-none">
                    {/* Mobile: two centered rows (weekday, date) */}
                    <div className="block sm:hidden text-center leading-tight pt-1">
                        <div
                            className={`text-[11px] font-semibold ${
                                isToday
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-slate-700 dark:text-slate-200'
                            }`}
                        >
                            {day.toLocaleDateString(undefined, {
                                weekday: 'short',
                            })}
                        </div>
                        <div
                            className={`text-[10px] font-medium ${
                                isToday
                                    ? 'text-amber-600 dark:text-amber-200'
                                    : 'text-slate-500 dark:text-slate-400'
                            }`}
                        >
                            {day.toLocaleDateString(undefined, {
                                day: '2-digit',
                                month: '2-digit',
                            })}
                        </div>
                    </div>

                    {/* Desktop: single line */}
                    <div
                        className={`hidden sm:block text-sm font-semibold tracking-tight leading-snug whitespace-nowrap overflow-hidden text-ellipsis px-2 pt-2 ${
                            isToday
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-slate-700 dark:text-slate-200'
                        }`}
                    >
                        {day.toLocaleDateString(undefined, {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                        })}
                    </div>
                </div>
            )}
            <div
                className="absolute left-0 right-0 opacity-55 dark:opacity-35 pointer-events-none rounded-b-xl overflow-hidden"
                style={{
                    top: headerPx,
                    bottom: 0,
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${
                        gridSlotMinutes * SCALE - 1
                    }px, rgba(100,116,139,0.10) ${
                        gridSlotMinutes * SCALE - 1
                    }px, rgba(100,116,139,0.10) ${gridSlotMinutes * SCALE}px)`,
                }}
            />
            {blocks
                // render in top order to make bottom tracking deterministic
                .slice()
                .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
                .map((b) => {
                    const { l } = b;
                    // On mobile: collapse overlapping columns by rendering only the rightmost
                    if (
                        isMobile &&
                        b.colCount > 1 &&
                        b.colIndex !== b.colCount - 1
                    ) {
                        return null;
                    }

                    const cancelled = l.code === 'cancelled';
                    const irregular = l.code === 'irregular';
                    const subject = l.su?.[0]?.name ?? l.activityType ?? '—';
                    const displaySubject = subject.includes('_')
                        ? subject.split('_')[0] || subject
                        : subject;
                    const room = l.ro?.map((r) => r.name).join(', ');
                    const teacher = l.te?.map((t) => t.name).join(', ');
                    const roomMobile = room
                        ? room
                              .split(',')
                              .map((part) =>
                                  part.replace(/\s+(?:WB?|TV|B)$/i, '').trim()
                              )
                              .join(', ')
                        : room;

                    const effectiveColor =
                        lessonColors[subject] ??
                        defaultLessonColors[subject] ??
                        null;
                    const offset = gradientOffsets?.[subject] ?? 0.5;
                    const gradient = effectiveColor
                        ? generateGradient(effectiveColor, offset)
                        : getDefaultGradient();

                    const GAP_PCT = 2.25;
                    let widthPct =
                        (100 - GAP_PCT * (b.colCount - 1)) / b.colCount;
                    let leftPct = b.colIndex * (widthPct + GAP_PCT);
                    if (isMobile && b.colCount > 1) {
                        widthPct = 100;
                        leftPct = 0;
                    }

                    // Pixel-snapped positioning
                    // Mobile: tighter outer padding but slightly larger minimum block height
                    const PAD_TOP = isMobile ? 2 : 4;
                    const PAD_BOTTOM = isMobile ? 2 : 4;
                    const startPxRaw =
                        (b.startMin - START_MIN) * SCALE + headerPx;
                    const endPxRaw = (b.endMin - START_MIN) * SCALE + headerPx;
                    let topPx = Math.round(startPxRaw) + PAD_TOP;
                    const endPx = Math.round(endPxRaw) - PAD_BOTTOM;
                    // Gap budget (space we leave for enforced separation after adjustments)
                    const GAP_BUDGET = isMobile ? 1 : 2;
                    // Minimum visual height per lesson

                    const MIN_EVENT_HEIGHT = isMobile ? 30 : 14; // slightly larger baseline on mobile for tap comfort
                    let heightPx = Math.max(
                        MIN_EVENT_HEIGHT,
                        endPx - topPx - GAP_BUDGET
                    );

                    // Enforce per-column cumulative bottom to avoid tiny overlaps from rounding
                    const colKey = `${b.colIndex}/${b.colCount}`;
                    const lastBottom = lastBottomByCol[colKey] ?? -Infinity;
                    const desiredTop = lastBottom + (isMobile ? 1 : 2); // reduced gap on mobile
                    if (topPx < desiredTop) {
                        const delta = desiredTop - topPx;
                        topPx += delta;
                        heightPx = Math.max(MIN_EVENT_HEIGHT, heightPx - delta);
                    }
                    lastBottomByCol[colKey] = topPx + heightPx;

                    // Reserve space for bottom labels and pad right for indicators
                    const labelReservePx = cancelled || irregular ? 22 : 0;
                    const MIN_BOTTOM_RESERVE = isMobile ? 4 : 6; // slightly tighter on mobile
                    const reservedBottomPx = Math.max(
                        labelReservePx,
                        MIN_BOTTOM_RESERVE
                    );
                    // Extra right padding for room label shown under icons on desktop
                    const roomPadRightPx = !isMobile && room ? 88 : 0;
                    // Allow a more compact mobile layout: lower height threshold for previews
                    const MIN_PREVIEW_HEIGHT = isMobile ? 44 : 56;
                    const canShowPreview =
                        heightPx - reservedBottomPx >= MIN_PREVIEW_HEIGHT;
                    
                    // Determine if there's enough space to show time frame along with teacher
                    // Use a threshold slightly higher than MIN_EVENT_HEIGHT to ensure readability
                    const MIN_TIME_DISPLAY_HEIGHT = isMobile ? 44 : 32;
                    const canShowTimeFrame = !isMobile && (heightPx - reservedBottomPx >= MIN_TIME_DISPLAY_HEIGHT);

                    // Compute content padding so mobile remains centered when icons exist
                    // Desktop readability fix:
                    // Previously we subtracted the full indicator stack width from the content area (indicatorsPadRightPx),
                    // which caused FitText to aggressively down‑scale subject/time/teacher text even though the icons
                    // only occupy a small corner on the right. We now only reserve space for the optional room label plus
                    // a small constant (8px) and let the text flow underneath the vertical icon column if needed.
                    const contentPadRight = isMobile
                        ? 0 // mobile keeps centered layout
                        : roomPadRightPx + 8; // exclude indicator width for better available text width
                    const contentPadLeft = 0;

                    // Auto contrast decision based on middle gradient (via) luminance heuristics
                    const viaColor = gradient.via;
                    let luminance = 0.3;
                    if (/^#[0-9A-Fa-f]{6}$/.test(viaColor)) {
                        const r = parseInt(viaColor.slice(1, 3), 16) / 255;
                        const g = parseInt(viaColor.slice(3, 5), 16) / 255;
                        const b = parseInt(viaColor.slice(5, 7), 16) / 255;
                        luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    }
                    const textColorClass =
                        luminance > 0.62 ? 'text-slate-900' : 'text-white';

                    return (
                        <div
                            key={l.id}

                            className={`absolute rounded-md p-2 sm:p-2 text-[11px] sm:text-xs ring-1 ring-slate-900/10 dark:ring-white/15 overflow-hidden cursor-pointer transform duration-150 hover:shadow-lg hover:brightness-110 hover:saturate-140 hover:contrast-110 backdrop-blur-[1px] ${textColorClass} ${

                                cancelled
                                    ? 'bg-rose-500/90'
                                    : irregular
                                    ? 'bg-emerald-500/90'
                                    : ''
                            }`}
                            style={{
                                top: topPx,
                                height: heightPx,
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                background: cancelled
                                    ? undefined
                                    : irregular
                                    ? undefined
                                    : (`linear-gradient(to right, ${gradient.from}, ${gradient.via}, ${gradient.to})` as string),
                                // Larger invisible hit target for touch
                                paddingTop: isMobile ? 6 : undefined,
                                paddingBottom: isMobile ? 6 : undefined,
                                boxShadow:
                                    '0 1px 2px -1px rgba(0,0,0,0.25), 0 2px 6px -1px rgba(0,0,0,0.25)',
                            }}
                            title={`${fmtHM(b.startMin)}–${fmtHM(
                                b.endMin
                            )} | ${subject} ${room ? `| ${room}` : ''} ${
                                teacher ? `| ${teacher}` : ''
                            }`}
                            onClick={() => onLessonClick(l)}
                        >
                            {/* Indicators + room label (desktop) */}
                            <div className="absolute top-1 right-1 hidden sm:flex flex-col items-end gap-1">
                                {room && (
                                    <div className="hidden sm:block text-[11px] leading-tight whitespace-nowrap text-white/95 drop-shadow-sm">
                                        {room}
                                    </div>
                                )}
                                <div className="flex gap-1">
                                    {l.homework && l.homework.length > 0 && (
                                        <div className="w-3 h-3 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {l.info && (
                                        <div className="w-3 h-3 bg-blue-400 dark:bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {l.lstext && (
                                        <div className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h8.5a2 2 0 001.414-.586l2.5-2.5A2 2 0 0017 12.5V5a2 2 0 00-2-2H4zm9 10h1.586L13 14.586V13z" />
                                            </svg>
                                        </div>
                                    )}
                                    {l.exams && l.exams.length > 0 && (
                                        <div className="w-3 h-3 bg-red-400 dark:bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div
                                className="flex h-full min-w-0 flex-col"
                                style={{
                                    paddingBottom: reservedBottomPx,
                                    paddingRight: contentPadRight,
                                    paddingLeft: contentPadLeft,
                                }}
                            >
                                {/* Mobile: absolute icons overlay (no layout impact) */}
                                <div className="sm:hidden absolute top-1.5 right-1.5 flex flex-col gap-1 items-end pointer-events-none">
                                    {l.homework && l.homework.length > 0 && (
                                        <div className="w-3.5 h-3.5 bg-amber-500/90 dark:bg-amber-500/90 rounded-full flex items-center justify-center ring-1 ring-black/15 dark:ring-white/20 shadow-md backdrop-blur-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {l.info && (
                                        <div className="w-3.5 h-3.5 bg-blue-500/90 dark:bg-blue-500/90 rounded-full flex items-center justify-center ring-1 ring-black/15 dark:ring-white/20 shadow-md backdrop-blur-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    {l.lstext && (
                                        <div className="w-3.5 h-3.5 bg-violet-500/90 dark:bg-violet-400/90 rounded-full flex items-center justify-center ring-1 ring-black/15 dark:ring-white/20 shadow-md backdrop-blur-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h8.5a2 2 0 001.414-.586l2.5-2.5A2 2 0 0017 12.5V5a2 2 0 00-2-2H4zm9 10h1.586L13 14.586V13z" />
                                            </svg>
                                        </div>
                                    )}
                                    {l.exams && l.exams.length > 0 && (
                                        <div className="w-3.5 h-3.5 bg-red-500/90 dark:bg-red-500/90 rounded-full flex items-center justify-center ring-1 ring-black/15 dark:ring-white/20 shadow-md backdrop-blur-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                {/* Mobile centered layout */}
                                <div className="flex flex-col items-center justify-center text-center gap-0.5 h-full sm:hidden px-0.5">
                                    {l.info && canShowPreview && (
                                        <div className="w-full text-[11px] font-medium leading-snug px-1.5 py-0.5 rounded-md bg-white/25 dark:bg-white/15 backdrop-blur-sm shadow-sm text-white/95 max-h-[40px] overflow-hidden">
                                            {l.info}
                                        </div>
                                    )}
                                    <div
                                        className="font-semibold leading-snug w-full whitespace-nowrap truncate"
                                        style={{
                                            fontSize:
                                                'clamp(12px, 3.5vw, 15px)',

                                        }}
                                    >
                                        {displaySubject}
                                    </div>
                                    {teacher && (
                                        <div className="text-[11px] opacity-90 leading-tight truncate max-w-full">
                                            {teacher}
                                        </div>
                                    )}
                                    {roomMobile && (
                                        <div className="text-[11px] opacity-90 leading-tight truncate max-w-full">
                                            {roomMobile}
                                        </div>
                                    )}
                                    {/* Removed lstext preview in timetable (mobile) */}
                                </div>
                                {/* Original flexible desktop layout */}
                                <div className="hidden sm:flex flex-col sm:flex-row items-stretch justify-between gap-1.5 sm:gap-2 min-w-0 h-full">
                                    <FitText
                                        mode="both"
                                        maxScale={1.6}
                                        minScale={0.9} // prevent overly tiny scaling that reduced readability
                                        reserveBottom={reservedBottomPx}
                                        className="min-w-0 self-stretch"
                                    >
                                        <div className="font-semibold leading-tight text-[13px]">
                                            {displaySubject}
                                        </div>
                                        {canShowTimeFrame && (
                                            <div className="opacity-90 sm:mt-0 leading-tight text-[12px]">
                                                <span className="whitespace-nowrap">
                                                    {fmtHM(b.startMin)}–
                                                    {fmtHM(b.endMin)}
                                                </span>
                                            </div>
                                        )}
                                        {teacher && (
                                            <div className="opacity-90 leading-tight text-[12px]">
                                                {teacher}
                                            </div>
                                        )}
                                    </FitText>
                                </div>
                                {/* Info/Notes preview (desktop) */}
                                {l.info && canShowPreview && (
                                    <div className="hidden sm:block mt-1 text-[11px] leading-snug text-white/90 whitespace-pre-wrap">
                                        {l.info}
                                    </div>
                                )}
                                {/* Removed lstext preview in timetable (desktop) */}
                                {/* {l.lstext && canShowPreview && (
                                    <div className="hidden sm:block mt-0.5 text-[11px] leading-snug text-white/90 whitespace-pre-wrap">
                                        {l.lstext}
                                    </div>
                                )} */}
                                {cancelled && (
                                    <div className="hidden sm:block absolute bottom-1 right-2 text-right text-[10px] font-semibold uppercase tracking-wide">
                                        Cancelled
                                    </div>
                                )}
                                {irregular && (
                                    <div className="hidden sm:block absolute bottom-1 right-2 text-right text-[10px] font-semibold uppercase tracking-wide">
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
