import { useState, useEffect, useCallback } from 'react';
import { getNotifications } from '../api';
import type { Notification } from '../types';

interface UseNotificationsOptions {
    token: string;
    refreshIntervalMs?: number;
}

interface UseNotificationsReturn {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
    refreshNotifications: () => Promise<void>;
    markAsRead: (notificationId: string) => void;
    markAllAsRead: () => void;
    clearError: () => void;
}

/**
 * Hook for managing notifications with auto-refresh
 */
export function useNotifications({
    token,
    refreshIntervalMs = 30000 // 30 seconds default
}: UseNotificationsOptions): UseNotificationsReturn {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const refreshNotifications = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);
            
            const data = await getNotifications(token);
            setNotifications(data.notifications || []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load notifications';
            setError(message);
            console.error('Failed to load notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const markAsRead = useCallback((notificationId: string) => {
        setNotifications(prev =>
            prev.map(notification =>
                notification.id === notificationId
                    ? { ...notification, read: true }
                    : notification
            )
        );
        
        // TODO: Send mark as read request to server
        // This would require adding an API endpoint for marking notifications as read
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev =>
            prev.map(notification => ({ ...notification, read: true }))
        );
        
        // TODO: Send mark all as read request to server
    }, []);

    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.read).length;

    // Load notifications on mount
    useEffect(() => {
        refreshNotifications();
    }, [refreshNotifications]);

    // Set up auto-refresh interval
    useEffect(() => {
        if (refreshIntervalMs <= 0) return;

        const interval = setInterval(() => {
            refreshNotifications();
        }, refreshIntervalMs);

        return () => clearInterval(interval);
    }, [refreshNotifications, refreshIntervalMs]);

    return {
        notifications,
        unreadCount,
        loading,
        error,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        clearError,
    };
}