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
    const [error, setError] = useState<string | null>(null);
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
        try {
            await createAccessRequest(username, message.trim() || undefined);
            setSuccess(true);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || 'Failed to request access');
        } finally {
            setLoading(false);
        }
    };

    if (!showModal) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={onClose}
        >
            <div
                className={`relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-all duration-200 ease-out will-change-transform will-change-opacity ${
                    isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2'
                }`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            Request Access
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {!success ? (
                        <>
                            <div className="mb-6 text-sm text-slate-700 dark:text-slate-300">
                                <p className="mb-3">
                                    Your account <strong className="text-slate-900 dark:text-slate-100">{username}</strong> is 
                                    not currently authorized to access Untis Pro. You can request access and an administrator 
                                    will review your request.
                                </p>
                                <p>
                                    Once your request is approved, you'll be able to sign in with your regular Untis credentials.
                                </p>
                            </div>

                            <div className="mb-4">
                                <label htmlFor="message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="btn-secondary flex-1"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequestAccess}
                                    className="btn-primary flex-1"
                                    disabled={loading}
                                >
                                    {loading ? 'Requesting...' : 'Request Access'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-center py-4">
                                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                                    Request Submitted!
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                                    Your access request has been sent to the administrators. 
                                    You'll be able to sign in once your request is approved.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="btn-primary w-full"
                            >
                                Got it
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}