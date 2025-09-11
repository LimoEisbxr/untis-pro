import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PendingAccessRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    username: string;
    requestedAt?: string;
}

// A visually rich modal informing the user their access request is pending.
export default function PendingAccessRequestModal({
    isOpen,
    onClose,
    username,
    requestedAt,
}: PendingAccessRequestModalProps) {
    const [showModal, setShowModal] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const ANIM_MS = 220;

    useEffect(() => {
        let t: number | undefined;
        let raf1: number | undefined;
        let raf2: number | undefined;
        if (isOpen) {
            if (!showModal) setShowModal(true);
            setIsVisible(false);
            raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setIsVisible(true));
            });
        } else if (showModal) {
            setIsVisible(false);
            t = window.setTimeout(() => {
                setShowModal(false);
            }, ANIM_MS);
        }
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        if (isOpen) window.addEventListener('keydown', handleKey);
        return () => {
            if (t) window.clearTimeout(t);
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
            window.removeEventListener('keydown', handleKey);
        };
        // onClose is expected to be stable (from parent state hook). Include for completeness.
    }, [isOpen, showModal, onClose]);

    if (!showModal) return null;

    const formattedDate = requestedAt
        ? new Date(requestedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          })
        : undefined;

    return createPortal(
        <div
            className={`fixed inset-0 z-50 grid place-items-center bg-gradient-to-br from-indigo-900/60 via-sky-900/60 to-emerald-900/60 backdrop-blur-md transition-opacity duration-200 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                className={`relative w-full max-w-lg mx-auto rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl transition-all duration-300 ease-out ${
                    isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-4'
                }`}
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-32 -right-24 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
                </div>
                <div className="relative p-8">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-sky-500 to-emerald-500 p-[2px] shadow-lg">
                            <div className="w-full h-full rounded-[1rem] bg-slate-950 flex items-center justify-center">
                                <svg
                                    className="w-8 h-8 text-sky-300"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="9"
                                        strokeWidth={2}
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 7v5l3 3"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-semibold bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent tracking-tight">
                                Access Request Pending
                            </h2>
                            <p className="mt-2 text-slate-300 text-sm leading-relaxed">
                                The account{' '}
                                <span className="font-medium text-slate-100">
                                    {username}
                                </span>{' '}
                                already has an access request pending approval.
                                We will review it soon—there's nothing else you
                                need to do right now.
                            </p>
                        </div>
                    </div>
                    <div className="grid gap-4">
                        {formattedDate && (
                            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4 text-xs text-slate-300 flex items-center gap-3">
                                <svg
                                    className="w-5 h-5 text-slate-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 7V3m8 4V3M5 11h14M5 19h14M5 11V9a2 2 0 012-2h10a2 2 0 012 2v2m-2 8a2 2 0 002-2v-6M5 19a2 2 0 01-2-2v-6"
                                    />
                                </svg>
                                <div>
                                    <div className="font-medium text-slate-200 tracking-wide mb-0.5">
                                        Requested
                                    </div>
                                    <div className="font-mono text-slate-400">
                                        {formattedDate}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-sky-500/10 to-emerald-500/10 px-5 py-4 text-sm text-slate-200 flex items-start gap-3">
                            <svg
                                className="w-5 h-5 text-sky-300 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                                />
                            </svg>
                            <p className="leading-relaxed">
                                You can close this window and try signing in
                                again later. Approval times vary based on
                                reviewer availability.
                            </p>
                        </div>
                    </div>
                    <div className="mt-8">
                        <button
                            onClick={onClose}
                            className="w-full relative group rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 p-[2px] shadow-lg shadow-sky-900/30"
                        >
                            <span className="block w-full h-full rounded-[11px] bg-slate-950 px-5 py-3 text-sm font-semibold tracking-wide text-slate-100 group-hover:bg-slate-900 transition-colors">
                                Got it
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
