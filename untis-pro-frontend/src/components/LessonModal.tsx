import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lesson, LessonColors } from '../types';
import { fmtHM, untisToMinutes } from '../utils/dates';
import ColorPicker from './ColorPicker';

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
        if (isOpen) {
            const t = setTimeout(() => setEntered(true), 0);
            lockScroll();
            return () => {
                clearTimeout(t);
                unlockScroll();
            };
        }
        return;
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
    const subjectLong = lesson.su?.[0]?.longname ?? subject;
    const room = lesson.ro?.map((r) => r.name).join(', ');
    const roomLong = lesson.ro?.map((r) => r.longname || r.name).join(', ');
    const teacher = lesson.te?.map((t) => t.name).join(', ');
    const teacherLong = lesson.te?.map((t) => t.longname || t.name).join(', ');
    const startTime = fmtHM(untisToMinutes(lesson.startTime));
    const endTime = fmtHM(untisToMinutes(lesson.endTime));

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] modal-portal flex items-center justify-center p-4 transition-opacity duration-200 ${
                entered ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={handleClose}
        >
            <div
                aria-hidden
                className={`absolute inset-0 bg-black/50 backdrop-blur-lg backdrop-saturate-150 backdrop-contrast-125 transition-opacity duration-200 ${
                    entered ? 'opacity-100' : 'opacity-0'
                }`}
            />

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
                                                onColorChange(
                                                    subject,
                                                    color,
                                                    gradientOffsets?.[
                                                        subject
                                                    ] ?? 0.5
                                                )
                                            }
                                            onRemoveColor={() =>
                                                onColorChange(subject, null)
                                            }
                                            isAdmin={!!isAdmin}
                                            gradientOffset={
                                                gradientOffsets?.[subject] ??
                                                0.5
                                            }
                                            onGradientOffsetChange={(v) =>
                                                onGradientOffsetChange?.(
                                                    subject,
                                                    v
                                                )
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
