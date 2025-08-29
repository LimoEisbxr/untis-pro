import { useState } from 'react';
import { api } from '../api';
import type { User } from '../types';

export default function Login({
    onAuth,
}: {
    onAuth: (token: string, user: User) => void;
}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            setError(msg || 'Failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-100 text-slate-900 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100">
            <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/80 backdrop-blur p-6 shadow-xl dark:bg-slate-900/80 dark:border-slate-700/50">
                <div className="bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent text-2xl font-semibold">
                    Untis Pro
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
                        <div className="text-red-600 text-sm">{error}</div>
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
        </div>
    );
}
