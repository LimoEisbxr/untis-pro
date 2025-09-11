import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createAccessRequest } from '../api';

export default function RequestAccessModal({
    isOpen,
    onClose,
    username,
}: {
    isOpen: boolean;
    onClose: () => void;
    username: string;
}) {
    const [showModal, setShowModal] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    type ErrorKind =
        | 'GENERIC'
        | 'ALREADY_PENDING'
        | 'ALREADY_AUTHORIZED'
        | 'NOT_AVAILABLE';
    const [error, setError] = useState<string | null>(null);
    const [errorKind, setErrorKind] = useState<ErrorKind>('GENERIC');
    const [success, setSuccess] = useState(false);

    const ANIM_MS = 200;

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
                // Reset state when modal is fully closed
                setMessage('');
                setError(null);
                setSuccess(false);
            }, ANIM_MS);
        }
        return () => {
            if (t) window.clearTimeout(t);
            if (raf1) cancelAnimationFrame(raf1);
            if (raf2) cancelAnimationFrame(raf2);
        };
    }, [isOpen, showModal]);

    const handleRequestAccess = async () => {
        setLoading(true);
        setError(null);
        setErrorKind('GENERIC');
        try {
            await createAccessRequest(username, message.trim() || undefined);
            setSuccess(true);
        } catch (e) {
            const raw = e instanceof Error ? e.message : String(e);
            // The API throws with the raw response text; attempt to parse JSON { error: string }
            let extracted = raw;
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.error === 'string') {
                    extracted = parsed.error;
                }
            } catch {
                // ignore parse failure; use raw string
            }
            // Normalize and classify for prettier UX
            const lower = (extracted || '').toLowerCase();
            if (
                lower.includes('already exists') ||
                lower.includes('already pending')
            ) {
                setErrorKind('ALREADY_PENDING');
                setError(
                    "Your access request is already pending approval. There's no need to send another one."
                );
            } else if (lower.includes('already authorized')) {
                setErrorKind('ALREADY_AUTHORIZED');
                setError(
                    'You are already authorized. Please close this dialog and sign in normally.'
                );
            } else if (lower.includes('not available')) {
                setErrorKind('NOT_AVAILABLE');
                setError(
                    'Access requests are currently disabled. Please contact an administrator to get access.'
                );
            } else {
                setErrorKind('GENERIC');
                setError(extracted || 'Failed to request access');
            }
        } finally {
            setLoading(false);
        }
    };

    if (!showModal) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-50 grid place-items-center bg-gradient-to-br from-indigo-900/60 via-sky-900/60 to-emerald-900/60 backdrop-blur-md transition-opacity duration-200 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={onClose}
        >
            <div
                className={`relative w-full max-w-lg max-h-[85vh] overflow-y-auto no-native-scrollbar rounded-3xl shadow-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl transition-all duration-200 ease-out will-change-transform will-change-opacity ${
                    isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-4'
                }`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-32 -right-24 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl" />
                </div>
                <div className="relative p-8">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-sky-500 to-emerald-500 p-[2px] shadow-lg">
                            <div className="w-full h-full rounded-[1rem] bg-slate-950 flex items-center justify-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(56,189,248,0.15),transparent_70%)]" />
                                <svg
                                    className="relative w-9 h-9 text-emerald-300 drop-shadow-[0_0_6px_rgba(16,185,129,0.35)]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    role="img"
                                >
                                    <title>Access Request</title>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 3l7 4v5c0 5-3.5 9-7 9s-7-4-7-9V7l7-4z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 13.5a1.75 1.75 0 10.001-3.501A1.75 1.75 0 0012 13.5zm0 0v2.25"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-semibold bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent tracking-tight">
                                Request Access
                            </h2>
                            <p className="mt-2 text-slate-300 text-sm leading-relaxed">
                                Your account{' '}
                                <span className="font-medium text-slate-100">
                                    {username}
                                </span>{' '}
                                is not currently authorized to access Periodix.
                                Provide an optional message to help reviewers
                                understand your request.
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/60 transition-colors"
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

                    {!success ? (
                        <>
                            <div className="mb-6 text-sm text-slate-300">
                                <p>
                                    Once approved, you'll be able to sign in
                                    with your usual Untis credentials.
                                </p>
                            </div>

                            <div className="mb-4">
                                <label
                                    htmlFor="message"
                                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                                >
                                    Optional message (why do you need access?)
                                </label>
                                <textarea
                                    id="message"
                                    className="input resize-none"
                                    rows={3}
                                    placeholder="e.g., I'm a student in class 12A and need access for timetable management..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    maxLength={500}
                                    disabled={loading}
                                />
                                <div className="text-xs text-slate-500 mt-1">
                                    {message.length}/500 characters
                                </div>
                            </div>

                            {error && (
                                <div
                                    className={
                                        errorKind === 'ALREADY_PENDING'
                                            ? 'mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm'
                                            : errorKind === 'ALREADY_AUTHORIZED'
                                            ? 'mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-sm'
                                            : errorKind === 'NOT_AVAILABLE'
                                            ? 'mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-sm'
                                            : 'mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm'
                                    }
                                >
                                    <div className="flex items-start gap-2">
                                        {errorKind === 'ALREADY_PENDING' ? (
                                            <svg
                                                className="w-5 h-5 mt-0.5 flex-shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
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
                                                    d="M12 7v5"
                                                />
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 12l3 3"
                                                />
                                            </svg>
                                        ) : errorKind ===
                                          'ALREADY_AUTHORIZED' ? (
                                            <svg
                                                className="w-5 h-5 mt-0.5 flex-shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
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
                                                    d="M8.5 12.5l2.5 2.5 4.5-4.5"
                                                />
                                            </svg>
                                        ) : errorKind === 'NOT_AVAILABLE' ? (
                                            <svg
                                                className="w-5 h-5 mt-0.5 flex-shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                                                />
                                            </svg>
                                        ) : (
                                            <svg
                                                className="w-5 h-5 mt-0.5 flex-shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                                />
                                            </svg>
                                        )}
                                        <span>{error}</span>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 rounded-xl bg-slate-800/60 hover:bg-slate-700/70 text-slate-200 px-5 py-3 text-sm font-medium shadow-inner transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequestAccess}
                                    className="flex-1 relative group rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 p-[2px] shadow-lg shadow-sky-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={
                                        loading ||
                                        errorKind === 'ALREADY_PENDING'
                                    }
                                    title={
                                        errorKind === 'ALREADY_PENDING'
                                            ? 'A request is already pending'
                                            : undefined
                                    }
                                >
                                    <span className="block w-full h-full rounded-[11px] bg-slate-950 px-5 py-3 text-sm font-semibold tracking-wide text-slate-100 group-hover:bg-slate-900 transition-colors">
                                        {loading
                                            ? 'Requesting...'
                                            : errorKind === 'ALREADY_PENDING'
                                            ? 'Request Pending'
                                            : 'Request Access'}
                                    </span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-center py-6">
                                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-500/20 via-sky-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-slate-700/60">
                                    <svg
                                        className="w-10 h-10 text-emerald-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-slate-100 mb-3">
                                    Request Submitted!
                                </h3>
                                <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                                    Your access request has been sent. You'll be
                                    able to sign in once it's approved. Try
                                    again later or wait for a notification.
                                </p>
                            </div>
                            <div className="mt-4">
                                <button
                                    onClick={onClose}
                                    className="w-full relative group rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 p-[2px] shadow-lg shadow-sky-900/30"
                                >
                                    <span className="block w-full h-full rounded-[11px] bg-slate-950 px-5 py-3 text-sm font-semibold tracking-wide text-slate-100 group-hover:bg-slate-900 transition-colors">
                                        Got it
                                    </span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
