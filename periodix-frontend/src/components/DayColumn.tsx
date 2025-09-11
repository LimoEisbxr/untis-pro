import type { FC, ReactElement } from 'react';
import { useState, useLayoutEffect } from 'react';
import FitText from './FitText';
import EllipsisIcon from './EllipsisIcon';
import type { Lesson, LessonColors } from '../types';
import { fmtHM, untisToMinutes } from '../utils/dates';
import { clamp } from '../utils/dates';
import { generateGradient, getDefaultGradient } from '../utils/colors';
import { extractSubjectType } from '../utils/subjectUtils';
import { hasLessonChanges, getRoomDisplayText } from '../utils/lessonChanges';

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
    hideAdminDefaults?: boolean;
    onLessonClick: (lesson: Lesson) => void;
    isToday?: boolean;
    gradientOffsets?: Record<string, number>; // subject -> offset (0..1)
    hideHeader?: boolean; // suppress built-in header (used when external sticky header is rendered)
    mobileTinyLessonThresholdPx?: number; // threshold for tiny single lessons on mobile (px)
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
    hideAdminDefaults = false,
    onLessonClick,
    isToday = false,
    gradientOffsets,
    hideHeader = false,
    mobileTinyLessonThresholdPx = 56,
}) => {
    // Detect mobile (tailwind sm breakpoint <640px). Responsive hook to decide hiding side-by-side overlaps.
    // Detect mobile synchronously on first render to avoid a second-pass layout jump
    const [isMobile, setIsMobile] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.matchMedia('(max-width: 639px)').matches;
        } catch {
            return false;
        }
    });
    // Use layout effect so updates (e.g., orientation change) happen before paint, reducing flicker
    useLayoutEffect(() => {
        if (typeof window === 'undefined') return;
        let mq: MediaQueryList | null = null;
        try {
            mq = window.matchMedia('(max-width: 639px)');
        } catch {
            return;
        }
        const update = () => setIsMobile(mq!.matches);
        // In case environment changed before hydration
        update();
        mq.addEventListener('change', update);
        return () => {
            if (mq) mq.removeEventListener('change', update);
        };
    }, []);

    // Helper function to detect if a lesson is merged (contains merge separator)
    const isLessonMerged = (lesson: Lesson): boolean => {
        return (
            (lesson.info?.includes(' | ') ?? false) ||
            (lesson.lstext?.includes(' | ') ?? false)
        );
    };
    const headerPx = hideHeader ? 8 : DAY_HEADER_PX; // minimal spacer when external sticky header used
    const containerHeight =
        (END_MIN - START_MIN) * SCALE + BOTTOM_PAD_PX + headerPx;

    // Precompute whether we should show denser or sparser grid lines (mobile gets 60‑min lines)
    const gridSlotMinutes = isMobile ? 60 : 30;

    // Mobile tiny-height threshold for single, non-overlapping lessons.
    // When a block is shorter than this (in px), hide teacher by default and show room only.
    // Priority: if only teacher changed (and room didn't), show teacher instead; if both changed, show room.
    // Fine-tune via prop 'mobileTinyLessonThresholdPx'.

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
                    // Determine if this lesson represents a merged (double / multi) lesson
                    const isMerged = isLessonMerged(l);
                    const hasChanges = hasLessonChanges(l);
                    const subject = l.su?.[0]?.name ?? l.activityType ?? '—';
                    const subjectType = extractSubjectType(subject);
                    const displaySubject = subjectType;
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

                    // Mobile single-lesson (non-overlapping) detection for special styling tweaks
                    const singleMobile = isMobile && b.colCount === 1;

                    const effectiveColor =
                        lessonColors[subjectType] ??
                        (hideAdminDefaults ? null : defaultLessonColors[subjectType]) ??
                        null;
                    const offset = gradientOffsets?.[subjectType] ?? 0.5;
                    const baseGradient = effectiveColor
                        ? generateGradient(effectiveColor, offset)
                        : getDefaultGradient();

                    // Create tinted gradient for cancelled/irregular lessons using CSS overlays
                    const gradient = baseGradient;
                    const statusOverlay = cancelled
                        ? 'linear-gradient(to right, rgba(239, 68, 68, 0.6), rgba(239, 68, 68, 0.55), rgba(239, 68, 68, 0.6))'
                        : irregular
                        ? 'linear-gradient(to right, rgba(16, 185, 129, 0.6), rgba(16, 185, 129, 0.55), rgba(16, 185, 129, 0.6))'
                        : null;

                    const GAP_PCT = 1.5; // Reduced gap for better space utilization
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
                    const labelReservePx = 0; // No longer reserve space for status labels
                    const MIN_BOTTOM_RESERVE = isMobile ? 4 : 6; // slightly tighter on mobile
                    const reservedBottomPx = Math.max(
                        labelReservePx,
                        MIN_BOTTOM_RESERVE
                    );
                    // Extra right padding for room label shown under icons on desktop
                    const roomPadRightPx = !isMobile && room ? 88 : 0;
                    // Allow a more compact mobile layout: lower height threshold for previews
                    // Previously used to decide rendering of inline info previews; now removed.
                    // const MIN_PREVIEW_HEIGHT = isMobile ? 44 : 56;

                    // Determine if there's enough space to show time frame along with teacher
                    // We need space for: subject (~16px) + teacher (~14px) + time (~14px) + margins
                    // Only show time if we have sufficient space for subject + teacher + time (minimum 50px total)
                    const MIN_TIME_DISPLAY_HEIGHT = isMobile ? 56 : 56;
                    // Second threshold for very compact layout: move teacher to same row as subject
                    const MIN_COMPACT_DISPLAY_HEIGHT = isMobile ? 45 : 45;
                    // Separate threshold for cancelled/irregular lessons (they can use compact layout more aggressively)
                    const MIN_COMPACT_DISPLAY_HEIGHT_CANCELLED_IRREGULAR =
                        isMobile ? 55 : 55;
                    const availableSpace = heightPx - reservedBottomPx;
                    const canShowTimeFrame =
                        !isMobile && availableSpace >= MIN_TIME_DISPLAY_HEIGHT;

                    // Use different compact layout thresholds for cancelled/irregular vs normal lessons
                    const compactThreshold =
                        cancelled || irregular
                            ? MIN_COMPACT_DISPLAY_HEIGHT_CANCELLED_IRREGULAR
                            : MIN_COMPACT_DISPLAY_HEIGHT;
                    const shouldUseCompactLayout =
                        !isMobile && availableSpace <= compactThreshold;

                    // Compute content padding so mobile remains centered when icons exist
                    // Desktop readability fix:
                    // Previously we subtracted the full indicator stack width from the content area (indicatorsPadRightPx),
                    // which caused FitText to aggressively down‑scale subject/time/teacher text even though the icons
                    // only occupy a small corner on the right. We now only reserve space for the optional room label plus
                    // a small constant (8px) and let the text flow underneath the vertical icon column if needed.
                    // Reduce padding when lessons are side by side to maximize text space
                    const sideByySideAdjustment =
                        b.colCount > 1
                            ? Math.max(0, roomPadRightPx - 40)
                            : roomPadRightPx;
                    const contentPadRight = isMobile
                        ? 0 // mobile keeps centered layout
                        : sideByySideAdjustment + 4; // reduced padding for side-by-side lessons
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

                    // Decide tiny mobile single layout behavior
                    const roomInfoMeta = getRoomDisplayText(l);
                    const roomChanged = !!roomInfoMeta?.hasChanges;
                    const teacherChanged = !!l.te?.some((t) => !!t.orgname);
                    const isTinyMobileSingle =
                        singleMobile && heightPx < mobileTinyLessonThresholdPx;
                    // In tiny mode:
                    // - default: show room (if available and not cancelled/irregular)
                    // - if only teacher changed, show teacher instead
                    // - if both changed, show room again
                    const showTeacherTiny =
                        isTinyMobileSingle &&
                        ((teacherChanged && !roomChanged) ||
                            (!roomMobile && (l.te?.length ?? 0) > 0));
                    const showRoomTiny =
                        isTinyMobileSingle &&
                        !!roomMobile &&
                        !(cancelled || irregular) &&
                        (!teacherChanged || roomChanged);

                    return (
                        <div
                            key={l.id}
                            className={`timetable-lesson absolute rounded-md p-2 sm:p-2 text-[11px] sm:text-xs ring-1 ring-slate-900/10 dark:ring-white/15 overflow-hidden cursor-pointer transform duration-150 hover:shadow-lg hover:brightness-110 hover:saturate-140 hover:contrast-110 backdrop-blur-[1px] ${textColorClass} ${
                                cancelled
                                    ? 'border-6 border-rose-600 dark:border-rose-500'
                                    : irregular
                                    ? 'border-6 border-emerald-500 dark:border-emerald-400'
                                    : 'ring-1 ring-slate-900/10 dark:ring-white/15'
                            }`}
                            style={{
                                top: topPx,
                                height: heightPx,
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                background: statusOverlay
                                    ? `${statusOverlay}, linear-gradient(to right, ${gradient.from}, ${gradient.via}, ${gradient.to})`
                                    : `linear-gradient(to right, ${gradient.from}, ${gradient.via}, ${gradient.to})`,
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
                                    <div
                                        className={`hidden sm:block text-[11px] leading-tight whitespace-nowrap drop-shadow-sm ${
                                            cancelled
                                                ? 'lesson-cancelled-room'
                                                : ''
                                        }`}
                                    >
                                        {(() => {
                                            const roomInfo =
                                                getRoomDisplayText(l);
                                            // Show only short room codes (no long names or originals) in timetable view
                                            return (
                                                <div
                                                    className={`${
                                                        roomInfo.hasChanges
                                                            ? 'change-highlight'
                                                            : textColorClass
                                                    }`}
                                                >
                                                    {room}
                                                </div>
                                            );
                                        })()}
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
                                    {hasChanges && (
                                        <div className="w-3 h-3 bg-emerald-400 dark:bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                                            <svg
                                                className="w-2 h-2 text-white"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                {/* Desktop inline info snippet under icons (only when time is shown) */}
                                {l.info &&
                                    l.info.trim().length < 4 &&
                                    canShowTimeFrame && (
                                        <div
                                            className="mt-0.5 max-w-[140px] text-[10px] leading-snug text-white/90 text-right bg-black/15 dark:bg-black/20 px-1 py-0.5 rounded-sm backdrop-blur-[1px] overflow-hidden"
                                            style={{ maxHeight: '3.3em' }}
                                        >
                                            {l.info}
                                        </div>
                                    )}
                                {l.lstext &&
                                    l.lstext.trim().length < 4 &&
                                    canShowTimeFrame && (
                                        <div
                                            className="mt-0.5 max-w-[140px] text-[10px] leading-snug text-white/90 text-right bg-black/10 dark:bg-black/15 px-1 py-0.5 rounded-sm backdrop-blur-[1px] overflow-hidden"
                                            style={{ maxHeight: '3.3em' }}
                                        >
                                            {l.lstext}
                                        </div>
                                    )}
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
                                <div className="sm:hidden absolute top-1.5 right-1.5 flex flex-row-reverse gap-1 items-center pointer-events-none">
                                    {/* Mobile badges: show limited badges for single lessons, up to 3 for merged lessons */}
                                    {(() => {
                                        const badges: ReactElement[] = [];
                                        const baseClass =
                                            'w-3.5 h-3.5 rounded-full flex items-center justify-center ring-1 ring-black/15 dark:ring-white/20 shadow-md backdrop-blur-sm';

                                        // Count information types available
                                        const hasHomework =
                                            l.homework && l.homework.length > 0;
                                        const hasInfo = !!l.info;
                                        const hasLstext = !!l.lstext;
                                        const hasExams =
                                            l.exams && l.exams.length > 0;
                                        const informationCount = [
                                            hasHomework,
                                            hasInfo,
                                            hasLstext,
                                            hasExams,
                                        ].filter(Boolean).length;

                                        const isMerged = isLessonMerged(l);

                                        // For single lessons with multiple information types, show ellipsis instead
                                        if (!isMerged && informationCount > 1) {
                                            badges.push(
                                                <div
                                                    key="ellipsis"
                                                    className={`bg-slate-500/90 dark:bg-slate-400/90 ${baseClass}`}
                                                    title="Multiple information items - click lesson for details"
                                                >
                                                    <EllipsisIcon className="w-2 h-2 text-white" />
                                                </div>
                                            );
                                        } else {
                                            // For merged lessons or single lessons with 1 info type, show individual badges
                                            if (hasHomework)
                                                badges.push(
                                                    <div
                                                        key="hw"
                                                        className={`bg-amber-500/90 dark:bg-amber-500/90 ${baseClass}`}
                                                    >
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
                                                );
                                            if (hasInfo)
                                                badges.push(
                                                    <div
                                                        key="info"
                                                        className={`bg-blue-500/90 dark:bg-blue-500/90 ${baseClass}`}
                                                    >
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
                                                );
                                            if (hasLstext)
                                                badges.push(
                                                    <div
                                                        key="lstext"
                                                        className={`bg-violet-500/90 dark:bg-violet-400/90 ${baseClass}`}
                                                    >
                                                        <svg
                                                            className="w-2 h-2 text-white"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h8.5a2 2 0 001.414-.586l2.5-2.5A2 2 0 0017 12.5V5a2 2 0 00-2-2H4zm9 10h1.586L13 14.586V13z" />
                                                        </svg>
                                                    </div>
                                                );
                                            if (hasExams)
                                                badges.push(
                                                    <div
                                                        key="exam"
                                                        className={`bg-red-500/90 dark:bg-red-500/90 ${baseClass}`}
                                                    >
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
                                                );
                                        }

                                        // For merged lessons, keep the limit of 3 badges
                                        return isMerged
                                            ? badges.slice(0, 3)
                                            : badges.slice(0, 1);
                                    })()}
                                </div>

                                {/* Mobile centered layout */}
                                <div className="flex flex-col items-center justify-center text-center gap-0.5 h-full sm:hidden px-0.5">
                                    {/* Info preview removed from mobile timetable view */}
                                    <div
                                        className={`font-semibold leading-snug w-full whitespace-nowrap truncate ${
                                            cancelled
                                                ? 'lesson-cancelled-subject'
                                                : ''
                                        }`}
                                        style={{
                                            fontSize:
                                                'clamp(12px, 3.5vw, 15px)',
                                        }}
                                    >
                                        {displaySubject}
                                    </div>
                                    {(() => {
                                        const hasTeachers = !!(
                                            l.te && l.te.length > 0
                                        );
                                        if (!hasTeachers) return null;
                                        // In tiny mobile single mode, only show teacher if it has priority
                                        if (
                                            isTinyMobileSingle &&
                                            !showTeacherTiny
                                        )
                                            return null;
                                        return (
                                            <div
                                                className={`text-[11px] leading-tight truncate max-w-full flex flex-wrap justify-center gap-x-1 ${
                                                    cancelled
                                                        ? 'lesson-cancelled-teacher'
                                                        : ''
                                                }`}
                                            >
                                                {(l.te ?? []).map((t, i) => (
                                                    <span
                                                        key={i}
                                                        className={
                                                            t.orgname
                                                                ? singleMobile
                                                                    ? 'change-highlight-mobile'
                                                                    : 'change-highlight-inline'
                                                                : undefined
                                                        }
                                                    >
                                                        {t.name}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                    {(() => {
                                        const roomInfo = getRoomDisplayText(l);
                                        // Tiny mode decision: show room when allowed by priority
                                        if (isTinyMobileSingle) {
                                            if (!showRoomTiny) return null;
                                        } else {
                                            // Normal mobile rules
                                            if (
                                                !roomMobile ||
                                                cancelled ||
                                                irregular
                                            )
                                                return null;
                                        }
                                        return (
                                            <div
                                                className={`text-[11px] leading-tight truncate max-w-full ${
                                                    cancelled
                                                        ? 'lesson-cancelled-room'
                                                        : ''
                                                }`}
                                            >
                                                <div
                                                    className={
                                                        roomInfo.hasChanges
                                                            ? singleMobile
                                                                ? 'change-highlight-mobile'
                                                                : 'change-highlight opacity-90'
                                                            : 'opacity-90'
                                                    }
                                                >
                                                    {roomMobile}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* Removed lstext preview in timetable (mobile) */}
                                </div>
                                {/* Desktop layout - adaptive based on available space */}
                                <div className="hidden sm:flex flex-col sm:flex-row items-stretch justify-between gap-1.5 sm:gap-2 min-w-0 h-full">
                                    <FitText
                                        mode="both"
                                        maxScale={1.6}
                                        minScale={0.9} // prevent overly tiny scaling that reduced readability
                                        reserveBottom={reservedBottomPx}
                                        className="min-w-0 self-stretch"
                                    >
                                        {shouldUseCompactLayout ? (
                                            // Compact layout: subject and teacher on same line
                                            <div className="flex flex-wrap items-baseline gap-x-2">
                                                <div
                                                    className={`font-semibold leading-tight text-[13px] ${
                                                        cancelled
                                                            ? 'lesson-cancelled-subject'
                                                            : ''
                                                    }`}
                                                >
                                                    {displaySubject}
                                                </div>
                                                {(() => {
                                                    if (
                                                        !l.te ||
                                                        l.te.length === 0
                                                    )
                                                        return null;
                                                    return (
                                                        <div
                                                            className={`leading-tight text-[12px] flex flex-wrap gap-x-1 ${
                                                                cancelled
                                                                    ? 'lesson-cancelled-teacher'
                                                                    : ''
                                                            }`}
                                                        >
                                                            {l.te.map(
                                                                (t, i) => (
                                                                    <span
                                                                        key={i}
                                                                        className={
                                                                            t.orgname
                                                                                ? 'change-highlight-inline'
                                                                                : undefined
                                                                        }
                                                                    >
                                                                        {t.name}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            // Normal layout: subject, time, teacher in separate rows
                                            <>
                                                <div
                                                    className={`font-semibold leading-tight text-[13px] ${
                                                        cancelled
                                                            ? 'lesson-cancelled-subject'
                                                            : ''
                                                    }`}
                                                >
                                                    {displaySubject}
                                                </div>
                                                {/* Timeframe:
                                                    - For normal lessons: shown (when canShowTimeFrame true)
                                                    - Previously hidden for cancelled / irregular lessons.
                                                    - Request: show it again for merged cancelled / irregular lessons.
                                                      If cancelled, it should be crossed out; irregular stays normal.
                                                */}
                                                {canShowTimeFrame &&
                                                    // normal lesson
                                                    (!(
                                                        cancelled || irregular
                                                    ) ||
                                                        // merged cancelled / irregular lesson
                                                        ((cancelled ||
                                                            irregular) &&
                                                            isMerged)) && (
                                                        <div
                                                            className={`opacity-90 sm:mt-0 leading-tight text-[12px] ${
                                                                cancelled &&
                                                                isMerged
                                                                    ? 'lesson-cancelled-time'
                                                                    : ''
                                                            }`}
                                                        >
                                                            <span className="whitespace-nowrap">
                                                                {fmtHM(
                                                                    b.startMin
                                                                )}
                                                                –
                                                                {fmtHM(
                                                                    b.endMin
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                {(() => {
                                                    if (
                                                        !l.te ||
                                                        l.te.length === 0
                                                    )
                                                        return null;
                                                    return (
                                                        <div
                                                            className={`leading-tight text-[12px] flex flex-wrap gap-x-1 ${
                                                                cancelled
                                                                    ? 'lesson-cancelled-teacher'
                                                                    : ''
                                                            }`}
                                                        >
                                                            {l.te.map(
                                                                (t, i) => (
                                                                    <span
                                                                        key={i}
                                                                        className={
                                                                            t.orgname
                                                                                ? 'change-highlight-inline'
                                                                                : undefined
                                                                        }
                                                                    >
                                                                        {t.name}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </FitText>
                                </div>
                                {/* Info/Notes preview (desktop) */}
                                {/* Info preview moved to indicators area (desktop) */}
                                {/* Removed lstext preview in timetable (desktop) */}
                                {/* {l.lstext && canShowPreview && (
                                    <div className="hidden sm:block mt-0.5 text-[11px] leading-snug text-white/90 whitespace-pre-wrap">
                                        {l.lstext}
                                    </div>
                                )} */}
                                {/* Status text overlays removed - now shown only in modal */}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
};

export default DayColumn;
