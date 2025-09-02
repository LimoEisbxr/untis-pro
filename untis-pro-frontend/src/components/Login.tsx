import { useState } from 'react';
import { api } from '../api';
import type { User } from '../types';
import RequestAccessModal from './RequestAccessModal';

export default function Login({
    onAuth,
}: {
    onAuth: (token: string, user: User) => void;
}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRequestAccessModal, setShowRequestAccessModal] = useState(false);

    async function submit() {
        setLoading(true);
        setError(null);
        try {
            const body = {
                username,
                password,
            };
            const res = await api<{ token: string; user: User }>(
                `/api/auth/login`,
                { method: 'POST', body: JSON.stringify(body) }
            );
            onAuth(res.token, res.user);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);

            // Check if this is a whitelist error by looking for the error message
            if (
                msg.includes('NOT_WHITELISTED') ||
                msg.includes('not authorized for this beta')
            ) {
                setShowRequestAccessModal(true);
                return;
            }

            // Try to parse JSON error response from the API
            let errorMessage = 'An error occurred during sign in';
            let errorCode: string | null = null;

            try {
                const errorData = JSON.parse(msg);
                if (errorData.error) {
                    errorMessage = errorData.error;
                    errorCode = errorData.code;
                }
            } catch {
                // If not JSON, use the raw message
                errorMessage = msg || 'Failed';
            }

            // Provide user-friendly messages for specific error codes
            if (errorCode === 'BAD_CREDENTIALS') {
                errorMessage =
                    'Invalid username or password. Please check your Untis credentials and try again.';
            } else if (errorCode === 'UNTIS_LOGIN_FAILED') {
                errorMessage =
                    'Unable to connect to Untis. Please try again later.';
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100 text-slate-900 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100">
            <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/80 backdrop-blur p-6 shadow-xl dark:bg-slate-900/80 dark:border-slate-700/50">
                <div className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent text-2xl font-semibold">
                    Periodix
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                    Sign in with your Untis credentials
                </p>
                <div className="mt-6 space-y-3">
                    <input
                        className="input"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <input
                        className="input"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-200">
                            <div className="flex items-start gap-2">
                                <svg
                                    className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500 dark:text-red-400"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}
                    <div className="pt-2">
                        <button
                            disabled={loading}
                            className="btn-primary w-full"
                            onClick={() => submit()}
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </div>
                </div>
            </div>

            <RequestAccessModal
                isOpen={showRequestAccessModal}
                onClose={() => setShowRequestAccessModal(false)}
                username={username}
            />
        </div>
    );
}
