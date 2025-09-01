import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lesson, LessonColors } from '../types';
import { fmtHM, untisToMinutes } from '../utils/dates';
import ColorPicker from './ColorPicker';
import { extractSubjectType } from '../utils/subjectUtils';
import { getTeacherDisplayText, getRoomDisplayText } from '../utils/lessonChanges';

export default function LessonModal({
    lesson,
    isOpen,
    onClose,
    isDeveloperMode,
    lessonColors,
    defaultLessonColors,
    isAdmin,
    onColorChange,
    gradientOffsets,
    onGradientOffsetChange,
}: {
    lesson: Lesson | null;
    isOpen: boolean;
    onClose: () => void;
    isDeveloperMode: boolean;
    lessonColors?: LessonColors;
    defaultLessonColors?: LessonColors;
    isAdmin?: boolean;
    onColorChange?: (
        lessonName: string,
        color: string | null,
        offset?: number
    ) => void;
    gradientOffsets?: Record<string, number>;
    onGradientOffsetChange?: (lessonName: string, offset: number) => void;
}) {
    const [animatingOut, setAnimatingOut] = useState(false);
    const [entered, setEntered] = useState(false);
    const [copied, setCopied] = useState(false);

    const lockScroll = () => {
        document.documentElement.classList.add('modal-open');
    };
    const unlockScroll = () => {
        document.documentElement.classList.remove('modal-open');
    };

    const shouldRender = isOpen || animatingOut;

    useEffect(() => {
        let raf1: number | null = null;
        let raf2: number | null = null;
        if (isOpen) {
            setAnimatingOut(false);
            setEntered(false); // ensure starting state for transition
            lockScroll();
            // Use double rAF to guarantee initial styles are committed before transition (Firefox smoothness)
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setEntered(true));
            });
        } else {
            // If modal is programmatically hidden without close animation
            if (!animatingOut) {
                unlockScroll();
            }
        }
        return () => {
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleClose = useCallback(() => {
        setEntered(false);
        setAnimatingOut(true);
        setTimeout(() => {
            setAnimatingOut(false);
            unlockScroll();
            onClose();
        }, 200);
    }, [onClose]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') handleClose();
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
    const subjectType = extractSubjectType(subject);
    const subjectLong = lesson.su?.[0]?.longname ?? subject;
    
    // Use helper functions to get teacher and room display info
    const teacherInfo = getTeacherDisplayText(lesson);
    const roomInfo = getRoomDisplayText(lesson);
    
    // Keep old variables for backward compatibility in other parts
    const teacher = teacherInfo.current;
    const teacherLong = lesson.te?.map((t) => t.longname || t.name).join(', ') || '';
    const room = roomInfo.current;
    const roomLong = lesson.ro?.map((r) => r.longname || r.name).join(', ') || '';
    
    const startTime = fmtHM(untisToMinutes(lesson.startTime));
    const endTime = fmtHM(untisToMinutes(lesson.endTime));

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] modal-portal flex items-center justify-center p-4 bg-black/50 backdrop-blur-lg backdrop-saturate-150 backdrop-contrast-125 transition-opacity duration-200 ease-out ${
                entered ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={handleClose}
        >
            <div
                className={`relative w-full max-w-2xl max-h-[85vh] overflow-y-auto no-native-scrollbar rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/75 dark:bg-slate-900/80 backdrop-blur-md transition-all duration-200 ease-out will-change-transform will-change-opacity ${
                    entered
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2'
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
                                {teacherInfo.current && (
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                                            Teacher
                                        </h3>
                                        <div className="space-y-1">
                                            <p className="text-slate-900 dark:text-slate-100">
                                                {teacherInfo.hasChanges ? (
                                                    <span className="change-highlight">
                                                        {teacherLong || teacherInfo.current}
                                                    </span>
                                                ) : (
                                                    teacherLong || teacherInfo.current
                                                )}
                                            </p>
                                            {teacherInfo.hasChanges && teacherInfo.original && (
                                                <p className="text-sm change-original">
                                                    Original: {teacherInfo.original}
                                                </p>
                                            )}
                                            {teacherLong !== teacher && !teacherInfo.hasChanges && (
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    ({teacher})
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {roomInfo.current && (
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                                            Room
                                        </h3>
                                        <div className="space-y-1">
                                            <p className="text-slate-900 dark:text-slate-100">
                                                {roomInfo.hasChanges ? (
                                                    <span className="change-highlight">
                                                        {roomLong || roomInfo.current}
                                                    </span>
                                                ) : (
                                                    roomLong || roomInfo.current
                                                )}
                                            </p>
                                            {roomInfo.hasChanges && roomInfo.original && (
                                                <p className="text-sm change-original">
                                                    Original: {roomInfo.original}
                                                </p>
                                            )}
                                            {roomLong !== room && !roomInfo.hasChanges && (
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    ({room})
                                                </p>
                                            )}
                                        </div>
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

                            {lesson.info && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                                        Lesson Information
                                    </h3>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 rounded-md flex items-center justify-center">
                                                <svg
                                                    className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
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
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                                                    {lesson.info}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {lesson.lstext && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                                        Lesson Notes
                                    </h3>
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-700 rounded-md flex items-center justify-center">
                                                <svg
                                                    className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400"
                                                    fill="currentColor"
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h8.5a2 2 0 001.414-.586l2.5-2.5A2 2 0 0017 12.5V5a2 2 0 00-2-2H4zm9 10h1.586L13 14.586V13z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-indigo-900 dark:text-indigo-100 whitespace-pre-wrap">
                                                    {lesson.lstext}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {lesson.homework && lesson.homework.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                                        Homework
                                    </h3>
                                    <div className="space-y-3">
                                        {lesson.homework.map((hw, index) => (
                                            <div
                                                key={hw.id || index}
                                                className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                            hw.completed
                                                                ? 'bg-green-100 border-green-500 dark:bg-green-900/50 dark:border-green-400'
                                                                : 'bg-white border-amber-400 dark:bg-slate-800 dark:border-amber-500'
                                                        }`}
                                                    >
                                                        {hw.completed && (
                                                            <svg
                                                                className="w-3 h-3 text-green-600 dark:text-green-400"
                                                                fill="currentColor"
                                                                viewBox="0 0 20 20"
                                                            >
                                                                <path
                                                                    fillRule="evenodd"
                                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                    clipRule="evenodd"
                                                                />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                                                            {hw.text}
                                                        </p>
                                                        {hw.remark && (
                                                            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                                                                {hw.remark}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-4 text-xs text-amber-600 dark:text-amber-400">
                                                            <span>
                                                                Due:{' '}
                                                                {new Date(
                                                                    String(
                                                                        hw.date
                                                                    ).replace(
                                                                        /(\d{4})(\d{2})(\d{2})/,
                                                                        '$1-$2-$3'
                                                                    )
                                                                ).toLocaleDateString()}
                                                            </span>
                                                            <span
                                                                className={
                                                                    hw.completed
                                                                        ? 'text-green-600 dark:text-green-400 font-medium'
                                                                        : ''
                                                                }
                                                            >
                                                                {hw.completed
                                                                    ? 'Completed'
                                                                    : 'Pending'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {lesson.exams && lesson.exams.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                                        Exams
                                    </h3>
                                    <div className="space-y-3">
                                        {lesson.exams.map((exam, index) => (
                                            <div
                                                key={exam.id || index}
                                                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1 flex-shrink-0 w-6 h-6 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-md flex items-center justify-center">
                                                        <svg
                                                            className="w-3 h-3 text-red-600 dark:text-red-400"
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
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                                                            {exam.name}
                                                        </p>
                                                        {exam.text && (
                                                            <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                                                                {exam.text}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-4 text-xs text-red-600 dark:text-red-400">
                                                            <span>
                                                                Date:{' '}
                                                                {new Date(
                                                                    String(
                                                                        exam.date
                                                                    ).replace(
                                                                        /(\d{4})(\d{2})(\d{2})/,
                                                                        '$1-$2-$3'
                                                                    )
                                                                ).toLocaleDateString()}
                                                            </span>
                                                            <span>
                                                                Time:{' '}
                                                                {fmtHM(
                                                                    untisToMinutes(
                                                                        exam.startTime
                                                                    )
                                                                )}{' '}
                                                                -{' '}
                                                                {fmtHM(
                                                                    untisToMinutes(
                                                                        exam.endTime
                                                                    )
                                                                )}
                                                            </span>
                                                        </div>
                                                        {exam.rooms &&
                                                            exam.rooms.length >
                                                                0 && (
                                                                <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                                                                    Room:{' '}
                                                                    {exam.rooms
                                                                        .map(
                                                                            (r: {
                                                                                name: string;
                                                                            }) =>
                                                                                r.name
                                                                        )
                                                                        .join(
                                                                            ', '
                                                                        )}
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {onColorChange && subjectType && (
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                                        Customize Color
                                    </h3>
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                        <ColorPicker
                                            currentColor={
                                                lessonColors?.[subjectType]
                                            }
                                            fallbackColor={
                                                defaultLessonColors?.[subjectType]
                                            }
                                            canRemoveFallback={!!isAdmin}
                                            onColorChange={(color) =>
                                                onColorChange(
                                                    subjectType,
                                                    color,
                                                    gradientOffsets?.[
                                                        subjectType
                                                    ] ?? 0.5
                                                )
                                            }
                                            onRemoveColor={() =>
                                                onColorChange(subjectType, null)
                                            }
                                            isAdmin={!!isAdmin}
                                            gradientOffset={
                                                gradientOffsets?.[subjectType] ??
                                                0.5
                                            }
                                            onGradientOffsetChange={(v) =>
                                                onGradientOffsetChange?.(
                                                    subjectType,
                                                    v
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Inline raw JSON (collapsible) when developer mode env is enabled. */}
                            {String(
                                import.meta.env.VITE_ENABLE_DEVELOPER_MODE ?? ''
                            )
                                .trim()
                                .toLowerCase() === 'true' && (
                                <DevJsonPanel lesson={lesson} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

// Lightweight internal component to show a collapsible JSON block when developer env flag is on
function DevJsonPanel({ lesson }: { lesson: Lesson }) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const json = JSON.stringify(lesson, null, 2);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* ignore */
        }
    };
    return (
        <div className="border border-dashed border-indigo-300 dark:border-indigo-600/60 rounded-lg">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2 text-left text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50/70 dark:hover:bg-indigo-900/30 rounded-t-lg transition"
                aria-expanded={open}
            >
                <span>Raw Lesson JSON (dev)</span>
                <svg
                    className={`w-4 h-4 transition-transform ${
                        open ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                    />
                </svg>
            </button>
            {open && (
                <div className="p-3 pt-0">
                    <div className="flex justify-end py-2">
                        <button
                            onClick={copy}
                            className={`text-xs px-2 py-1 rounded-md shadow-sm inline-flex items-center gap-1 transition ${
                                copied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                            }`}
                        >
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <pre className="bg-slate-900/90 text-slate-100 p-3 rounded-md text-[11px] leading-snug overflow-x-auto max-h-72">
                        {json}
                    </pre>
                </div>
            )}
        </div>
    );
}
