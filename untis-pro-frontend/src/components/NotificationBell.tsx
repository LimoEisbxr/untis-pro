import { useState, useEffect } from 'react';
import type { Notification } from '../types';

interface NotificationBellProps {
    notifications: Notification[];
    onClick: () => void;
    className?: string;
}

export default function NotificationBell({ notifications, onClick, className = '' }: NotificationBellProps) {
    const [animate, setAnimate] = useState(false);
    
    const unreadCount = notifications.filter(n => !n.read).length;
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
            onClick={onClick}
            className={`relative p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors ${className}`}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
            <svg 
                className={`w-6 h-6 transition-transform ${animate ? 'animate-pulse' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
            >
                <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 17h5l-5 5v-5zM11 3a8 8 0 016 8v3l2 2H5l2-2V11a8 8 0 016-8z" 
                />
            </svg>
            
            {/* Notification badge */}
            {unreadCount > 0 && (
                <span className={`absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform transition-transform ${
                    animate ? 'scale-110' : 'scale-100'
                } ${
                    unreadCount > 99 ? 'bg-red-500 rounded-md min-w-[1.5rem]' : 'bg-red-500 rounded-full min-w-[1.25rem] h-5'
                }`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
            
            {/* Pulse ring for new notifications */}
            {hasNew && animate && (
                <span className="absolute -top-1 -right-1 inline-flex h-6 w-6">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                </span>
            )}
        </button>
    );
}