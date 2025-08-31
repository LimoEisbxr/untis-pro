import { useState, useEffect } from 'react';
import type { Notification } from '../types';

interface NotificationBellProps {
    notifications: Notification[];
    onClick: () => void;
    className?: string;
    isOpen?: boolean; // reflect panel state for aria
}

export default function NotificationBell({
    notifications,
    onClick,
    className = '',
    isOpen,
}: NotificationBellProps) {
    const [animate, setAnimate] = useState(false);

    const unreadCount = notifications.filter((n) => !n.read).length;
    const hasNew = unreadCount > 0;

    // Animate when new notifications arrive
    useEffect(() => {
        if (hasNew) {
            setAnimate(true);
            const timer = setTimeout(() => setAnimate(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [hasNew]);

    return (
        <button
            type="button"
            onClick={onClick}
            aria-haspopup="dialog"
            aria-expanded={isOpen ? true : false}
            className={`relative rounded-full p-3 sm:p-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95 touch-manipulation z-20 ${className}`}
            title={`Notifications${
                unreadCount > 0 ? ` (${unreadCount} unread)` : ''
            }`}
            aria-label={`Notifications${
                unreadCount > 0 ? ` (${unreadCount} unread)` : ''
            }`}
            style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
            }}
            data-role="notification-bell"
        >
            <svg
                className={`w-5 h-5 text-slate-600 dark:text-slate-300 transition-transform ${
                    animate ? 'animate-pulse' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="m13.73 21a2 2 0 0 1-3.46 0" />
            </svg>

            {/* Notification badge */}
            {unreadCount > 0 && (
                <span
                    className={`absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform transition-transform pointer-events-none ${
                        animate ? 'scale-110' : 'scale-100'
                    } ${
                        unreadCount > 99
                            ? 'bg-red-500 rounded-md min-w-[1.5rem]'
                            : 'bg-red-500 rounded-full min-w-[1.25rem] h-5'
                    }`}
                >
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}

            {/* Pulse ring for new notifications */}
            {hasNew && animate && (
                <span className="absolute -top-1 -right-1 inline-flex h-6 w-6 pointer-events-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                </span>
            )}
        </button>
    );
}
