// Notification utilities for browser notifications and PWA support

export type NotificationPermissionState = 'default' | 'granted' | 'denied';

export interface NotificationOptions {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
    requireInteraction?: boolean;
    actions?: NotificationAction[];
}

export interface NotificationAction {
    action: string;
    title: string;
    icon?: string;
}

// Convert VAPID public key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Check if browser supports notifications
export function isNotificationSupported(): boolean {
    return 'Notification' in window;
}

// Check if service worker is supported
export function isServiceWorkerSupported(): boolean {
    return 'serviceWorker' in navigator;
}

// Detect if running as an installed (standalone) PWA
export function isStandalonePWA(): boolean {
    try {
        const legacyStandalone = (navigator as unknown as { standalone?: boolean }).standalone;
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            legacyStandalone === true
        );
    } catch {
        return false;
    }
}

// Basic iOS device detection (phone/tablet)
export function isIOS(): boolean {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// Extract major iOS version (returns null if not iOS or unknown)
export function getiOSVersion(): number | null {
    if (!isIOS()) return null;
    const match = window.navigator.userAgent.match(/OS (\d+)_/i);
    if (match && match[1]) {
        const v = parseInt(match[1], 10);
        return Number.isFinite(v) ? v : null;
    }
    return null;
}

// Determine whether push-capable Web Push prerequisites are satisfied on iOS
export function isIOSPushCapable(): boolean {
    const v = getiOSVersion();
    return isIOS() && isStandalonePWA() && !!v && v >= 16; // 16.4+ originally; use 16 baseline
}

// Get current notification permission status
export function getNotificationPermission(): NotificationPermissionState {
    if (!isNotificationSupported()) {
        return 'denied';
    }
    return Notification.permission as NotificationPermissionState;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
    if (!isNotificationSupported()) {
        throw new Error('Notifications not supported');
    }

    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionState;
}

// Show a browser notification
export function showNotification(options: NotificationOptions): Notification | null {
    if (!isNotificationSupported() || getNotificationPermission() !== 'granted') {
        return null;
    }

    const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icon-192.png',
        badge: options.badge || '/icon-192.png',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction,
    });

    return notification;
}

// Get device type for notification preferences
export function getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/tablet|ipad|playbook|silk/.test(userAgent)) {
        return 'tablet';
    }
    
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/.test(userAgent)) {
        return 'mobile';
    }
    
    return 'desktop';
}

// Subscribe to push notifications via service worker
export async function subscribeToPushNotifications(vapidPublicKey?: string): Promise<PushSubscription | null> {
    if (!isServiceWorkerSupported()) {
        throw new Error('Service workers not supported');
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
        return existingSubscription;
    }

    if (!vapidPublicKey) {
        throw new Error('VAPID public key is required for push notifications');
    }

    try {
        // Convert VAPID key to Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource,
        });
        return subscription;
    } catch (error) {
        console.warn('Push subscription failed:', error);
        throw error;
    }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
    if (!isServiceWorkerSupported()) {
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            return await subscription.unsubscribe();
        }
        
        return true;
    } catch (error) {
        console.error('Failed to unsubscribe from push notifications:', error);
        return false;
    }
}

// Show notification with automatic fallback
export async function showNotificationWithFallback(options: NotificationOptions): Promise<void> {
    // Try service worker notification first (for PWA)
    if (isServiceWorkerSupported()) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(options.title, {
                body: options.body,
                icon: options.icon || '/icon-192.png',
                badge: options.badge || '/icon-192.png',
                tag: options.tag,
                data: options.data,
                requireInteraction: options.requireInteraction,
                ...(options.actions && { actions: options.actions }),
            });
            return;
        } catch (error) {
            console.warn('Service worker notification failed, falling back to browser notification:', error);
        }
    }

    // Fallback to regular browser notification
    showNotification(options);
}

// Format notification for display
export function formatNotificationTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Check if notification should be shown based on user preferences
export function shouldShowNotification(
    notificationType: string,
    settings: {
        browserNotificationsEnabled?: boolean;
        timetableChangesEnabled?: boolean;
        accessRequestsEnabled?: boolean;
        irregularLessonsEnabled?: boolean;
        cancelledLessonsEnabled?: boolean;
    }
): boolean {
    if (!settings.browserNotificationsEnabled) {
        return false;
    }

    switch (notificationType) {
        case 'timetable_change':
            return settings.timetableChangesEnabled ?? true;
        case 'cancelled_lesson':
            return settings.cancelledLessonsEnabled ?? true;
        case 'irregular_lesson':
            return settings.irregularLessonsEnabled ?? true;
        case 'access_request':
            return settings.accessRequestsEnabled ?? true;
        default:
            return true;
    }
}