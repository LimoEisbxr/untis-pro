import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lesson, LessonColors } from '../types';
import { DevJsonPanel } from './lesson-modal/DevJsonPanel';
import { HomeworkList, ExamsList } from './lesson-modal/HomeworkList';
import { ColorCustomization } from './lesson-modal/ColorCustomization';
import {
    LessonInfoBlocks,
    LessonStatus,
    LessonInfoMessage,
} from './lesson-modal/InfoBlocks';

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
    isOnboardingActive,
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
    isOnboardingActive?: boolean;
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

    const cancelled = lesson.code === 'cancelled';

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] modal-portal flex items-center justify-center p-4 bg-black/50 ${
                isOnboardingActive
                    ? 'backdrop-blur-sm backdrop-saturate-100 backdrop-contrast-100'
                    : 'backdrop-blur-lg backdrop-saturate-150 backdrop-contrast-125'
            } transition-opacity duration-200 ease-out ${
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
                            <LessonInfoBlocks
                                lesson={lesson}
                                cancelled={cancelled}
                            />
                            <LessonStatus code={lesson.code} />

                            {lesson.info && (
                                <LessonInfoMessage
                                    title="Lesson Information"
                                    text={lesson.info}
                                    variant="info"
                                    cancelled={cancelled}
                                />
                            )}

                            {lesson.lstext && (
                                <LessonInfoMessage
                                    title="Lesson Notes"
                                    text={lesson.lstext}
                                    variant="notes"
                                    cancelled={cancelled}
                                />
                            )}

                            <HomeworkList lesson={lesson} />

                            <ExamsList lesson={lesson} />

                            <ColorCustomization
                                lesson={lesson}
                                lessonColors={lessonColors}
                                defaultLessonColors={defaultLessonColors}
                                gradientOffsets={gradientOffsets}
                                isAdmin={isAdmin}
                                onColorChange={onColorChange}
                                onGradientOffsetChange={onGradientOffsetChange}
                            />

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
