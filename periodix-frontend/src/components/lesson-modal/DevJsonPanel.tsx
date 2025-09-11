import { useState } from 'react';
import type { Lesson } from '../../types';

export function DevJsonPanel({ lesson }: { lesson: Lesson }) {
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
