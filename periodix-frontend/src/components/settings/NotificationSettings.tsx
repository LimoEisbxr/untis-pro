import { useState, useEffect } from 'react';
import type {
    User,
    NotificationSettings as NotificationSettingsType,
} from '../../types';
import {
    getNotificationSettings,
    updateNotificationSettings,
    subscribeToPushNotifications as apiSubscribeToPush,
    unsubscribeFromPushNotifications as apiUnsubscribeFromPush,
    getVapidPublicKey,
} from '../../api';
import {
    requestNotificationPermission,
    getNotificationPermission,
    isNotificationSupported,
    isStandalonePWA,
    isIOS,
    getiOSVersion,
    subscribeToPushNotifications as utilsSubscribeToPush,
    unsubscribeFromPushNotifications as utilsUnsubscribeFromPush,
    getDeviceType,
} from '../../utils/notifications';

interface NotificationSettingsProps {
    token: string;
    user: User;
    isVisible: boolean;
}

export default function NotificationSettings({
    token,
    user,
    isVisible,
}: NotificationSettingsProps) {
    // Notification settings state
    const [notificationSettings, setNotificationSettings] =
        useState<NotificationSettingsType | null>(null);
    const [notificationLoading, setNotificationLoading] = useState(false);
    const [notificationError, setNotificationError] = useState<string | null>(
        null
    );
    const [notificationPermission, setNotificationPermission] = useState(
        getNotificationPermission()
    );
    // Prevent rapid double toggles / race conditions when enabling/disabling
    const [toggleInFlight, setToggleInFlight] = useState(false);

    // Derived notification gating (iOS / PWA constraints)
    const iosVersion = getiOSVersion();
    const iosNeedsInstall = isIOS() && !isStandalonePWA();
    // iOS < 16 can't do web push (we use 16 baseline though push really 16.4+; keep messaging simple)
    const iosTooOld = isIOS() && !!iosVersion && iosVersion < 16;

    // Track if we've attempted to request permission (persisted) to distinguish true denial vs never asked
    const [permissionAttempted, setPermissionAttempted] = useState<boolean>(
        () => {
            try {
                return (
                    localStorage.getItem('notificationPermissionAttempted') ===
                    '1'
                );
            } catch {
                return false;
            }
        }
    );

    // Whether we should show the Enable button (allow retry if we believe never actually prompted)
    const canShowPermissionButton =
        (notificationPermission === 'default' ||
            (notificationPermission === 'denied' && !permissionAttempted)) &&
        !iosNeedsInstall &&
        !iosTooOld;

    // Check if user can toggle notifications (has permission and setting is enabled)
    const canToggleNotifications =
        notificationPermission === 'granted' &&
        notificationSettings?.browserNotificationsEnabled !== undefined;

    const notificationPermissionMessage = () => {
        if (!isNotificationSupported())
            return 'Notifications not supported in this browser.';
        if (notificationPermission === 'granted')
            return 'Notifications enabled.';
        if (notificationPermission === 'denied') {
            if (isIOS()) {
                if (iosNeedsInstall) {
                    return 'Install first (Share > Add to Home Screen), then open the app and tap Enable.';
                }
                // Allow re-asking on mobile/iOS even if previously denied
                return 'Tap Enable to request notification permission again.';
            }
            // Allow re-asking on other platforms too
            return 'Click Enable to request notification permission.';
        }
        // permission === 'default'
        if (iosTooOld) return 'Update iOS (>=16) to enable push notifications.';
        if (iosNeedsInstall)
            return 'Install first (Share > Add to Home Screen), then open and tap Enable.';
        return 'Click Enable to allow notifications.';
    };

    // Load notification settings when component becomes visible
    useEffect(() => {
        if (!isVisible) return;
        loadNotificationSettings();
    }, [isVisible, token]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadNotificationSettings = async () => {
        setNotificationLoading(true);
        setNotificationError(null);
        try {
            const data = await getNotificationSettings(token);
            setNotificationSettings(data.settings);
        } catch (e) {
            setNotificationError(
                e instanceof Error
                    ? e.message
                    : 'Failed to load notification settings'
            );
        } finally {
            setNotificationLoading(false);
        }
    };

    const handleUpdateNotificationSettings = async (
        updates: Partial<NotificationSettingsType>
    ) => {
        if (!notificationSettings) return;
        try {
            // Optimistic functional update avoids stale closure issues
            setNotificationSettings((prev) =>
                prev
                    ? ({ ...prev, ...updates } as NotificationSettingsType)
                    : prev
            );

            const apiPayload: Partial<NotificationSettingsType> = {};
            Object.entries(updates).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    (apiPayload as Record<string, unknown>)[key] = value;
                }
            });

            const resp = await updateNotificationSettings(token, apiPayload);
            if (resp?.settings) {
                setNotificationSettings(resp.settings);
            }
        } catch (e) {
            await loadNotificationSettings();
            setNotificationError(
                e instanceof Error ? e.message : 'Failed to update settings'
            );
        }
    };

    const ensurePushSubscription = async (): Promise<boolean> => {
        try {
            // Get VAPID public key from backend
            const { publicKey } = await getVapidPublicKey();

            // Subscribe to push notifications using utility
            const subscription = await utilsSubscribeToPush(publicKey);

            if (subscription) {
                await apiSubscribeToPush(token, {
                    endpoint: subscription.endpoint,
                    p256dh: btoa(
                        String.fromCharCode(
                            ...new Uint8Array(subscription.getKey('p256dh')!)
                        )
                    ),
                    auth: btoa(
                        String.fromCharCode(
                            ...new Uint8Array(subscription.getKey('auth')!)
                        )
                    ),
                });
                return true;
            }
            return false;
        } catch {
            return false; // Non-fatal; we'll fall back to browser notifications only
        }
    };

    const handleRequestPermission = async () => {
        setNotificationLoading(true);
        setNotificationError(null);

        try {
            // For mobile PWA, we need to be more persistent about permission requests
            const isMobilePWA =
                isStandalonePWA() && (getDeviceType() === 'mobile' || isIOS());

            // Reset permission attempted flag to allow re-asking
            setPermissionAttempted(false);
            try {
                localStorage.removeItem('notificationPermissionAttempted');
            } catch {
                // Ignore localStorage errors
            }

            // On mobile PWA, add a small delay to ensure the UI is ready
            if (isMobilePWA) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            const permission = await requestNotificationPermission();
            setNotificationPermission(permission);

            // Mark that we've attempted permission
            setPermissionAttempted(true);
            try {
                localStorage.setItem('notificationPermissionAttempted', '1');
            } catch {
                // Ignore localStorage errors
            }

            if (permission === 'granted') {
                // Enable browser notifications automatically when permission is granted
                await handleUpdateNotificationSettings({
                    browserNotificationsEnabled: true,
                });

                // For mobile PWA, also try to set up push notifications
                if (isMobilePWA) {
                    try {
                        await ensurePushSubscription();
                        await handleUpdateNotificationSettings({
                            pushNotificationsEnabled: true,
                        });
                    } catch (pushError) {
                        console.warn(
                            'Push notification setup failed on mobile PWA:',
                            pushError
                        );
                        // Don't throw here, browser notifications are still working
                    }
                }
            }
        } catch (e) {
            setNotificationError(
                e instanceof Error
                    ? e.message
                    : 'Failed to request notification permission'
            );
        } finally {
            setNotificationLoading(false);
        }
    };

    // Intelligent notification toggle - single API update to avoid flicker & race
    const handleToggleNotifications = async (enabled: boolean) => {
        if (!notificationSettings || toggleInFlight) return;
        setToggleInFlight(true);
        try {
            if (enabled) {
                // Ensure permission first
                let currentPermission = notificationPermission;
                if (currentPermission !== 'granted') {
                    currentPermission = await requestNotificationPermission();
                    setNotificationPermission(currentPermission);
                    if (currentPermission !== 'granted') {
                        throw new Error('Notification permission required');
                    }
                }

                // Attempt push subscription BEFORE settings update so we can send a single update call
                let pushOK = false;
                if (isStandalonePWA() && !iosTooOld && !iosNeedsInstall) {
                    pushOK = await ensurePushSubscription();
                }

                // Single merged update (optimistic inside handler)
                await handleUpdateNotificationSettings({
                    browserNotificationsEnabled: true,
                    pushNotificationsEnabled: pushOK,
                });
            } else {
                // Try to remove push subscription (best-effort)
                try {
                    if (isStandalonePWA()) {
                        const registration = await navigator.serviceWorker
                            .ready;
                        const existing =
                            await registration.pushManager.getSubscription();
                        if (existing) {
                            await apiUnsubscribeFromPush(
                                token,
                                existing.endpoint
                            ).catch(() => {});
                        }
                    }
                    await utilsUnsubscribeFromPush();
                } catch {
                    // Ignore unsubscribe errors
                }
                await handleUpdateNotificationSettings({
                    browserNotificationsEnabled: false,
                    pushNotificationsEnabled: false,
                });
            }
        } catch (e) {
            setNotificationError(
                e instanceof Error
                    ? e.message
                    : 'Failed to update notification settings'
            );
            await loadNotificationSettings();
        } finally {
            setToggleInFlight(false);
        }
    };

    if (!isNotificationSupported()) {
        return null; // Don't render anything if notifications aren't supported
    }

    // Remove conditional rendering since we handle visibility in parent

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">
                        Notifications
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {notificationPermission === 'granted'
                            ? isStandalonePWA()
                                ? 'Push notifications active'
                                : 'Browser notifications active'
                            : notificationPermissionMessage()}
                    </p>
                </div>

                {notificationLoading ? (
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : canShowPermissionButton ||
                  notificationPermission === 'denied' ? (
                    <button
                        onClick={handleRequestPermission}
                        className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md"
                    >
                        Enable
                    </button>
                ) : (
                    canToggleNotifications && (
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={
                                    notificationSettings?.browserNotificationsEnabled ||
                                    false
                                }
                                onChange={(e) =>
                                    handleToggleNotifications(e.target.checked)
                                }
                                disabled={toggleInFlight}
                                className="sr-only peer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    )
                )}
            </div>

            {notificationError && (
                <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {notificationError}
                </div>
            )}

            {/* Notification type preferences */}
            {notificationPermission === 'granted' &&
                notificationSettings?.browserNotificationsEnabled && (
                    <div className="space-y-3 ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700 mt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Cancelled lessons
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Get notified when lessons are cancelled
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={
                                        notificationSettings?.cancelledLessonsEnabled ||
                                        false
                                    }
                                    onChange={(e) =>
                                        handleUpdateNotificationSettings({
                                            cancelledLessonsEnabled:
                                                e.target.checked,
                                        })
                                    }
                                    className="sr-only peer"
                                />
                                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Irregular lessons
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Get notified when lesson locations or times
                                    change
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={
                                        notificationSettings?.irregularLessonsEnabled ||
                                        false
                                    }
                                    onChange={(e) =>
                                        handleUpdateNotificationSettings({
                                            irregularLessonsEnabled:
                                                e.target.checked,
                                        })
                                    }
                                    className="sr-only peer"
                                />
                                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    Timetable changes
                                </h5>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Get notified about general timetable updates
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={
                                        notificationSettings?.timetableChangesEnabled ||
                                        false
                                    }
                                    onChange={(e) =>
                                        handleUpdateNotificationSettings({
                                            timetableChangesEnabled:
                                                e.target.checked,
                                        })
                                    }
                                    className="sr-only peer"
                                />
                                <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {(user.isUserManager || user.isAdmin) && (
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                        Access requests
                                    </h5>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Get notified when users request access
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={
                                            notificationSettings?.accessRequestsEnabled ||
                                            false
                                        }
                                        onChange={(e) =>
                                            handleUpdateNotificationSettings({
                                                accessRequestsEnabled:
                                                    e.target.checked,
                                            })
                                        }
                                        className="sr-only peer"
                                    />
                                    <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        )}
                    </div>
                )}
        </div>
    );
}
