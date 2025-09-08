import { useState, useEffect } from 'react';
import type { User, AdminNotificationSettings } from '../../types';
import {
    getSharingSettings,
    updateGlobalSharing,
    getAdminNotificationSettings,
    updateAdminNotificationSettings,
    type SharingSettings,
} from '../../api';

interface AdminUserManagementProps {
    token: string;
    user: User;
    isVisible: boolean;
}

export default function AdminUserManagement({
    token,
    user,
    isVisible,
}: AdminUserManagementProps) {
    const [settings, setSettings] = useState<SharingSettings | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Admin notification settings state
    const [adminNotificationSettings, setAdminNotificationSettings] =
        useState<AdminNotificationSettings | null>(null);

    // Load data when component becomes visible
    useEffect(() => {
        if (!isVisible) return;
        loadSettings();
        loadAdminNotificationSettings();
    }, [isVisible, token]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadSettings = async () => {
        try {
            const data = await getSharingSettings(token);
            setSettings(data);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'Failed to load settings'
            );
        }
    };

    const loadAdminNotificationSettings = async () => {
        try {
            const data = await getAdminNotificationSettings(token);
            setAdminNotificationSettings(data.settings);
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : 'Failed to load admin notification settings'
            );
        }
    };

    const handleUpdateGlobalSharing = async (enabled: boolean) => {
        try {
            await updateGlobalSharing(token, enabled);
            if (settings) {
                setSettings({ ...settings, globalSharingEnabled: enabled });
            }
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : 'Failed to update global sharing'
            );
        }
    };

    const handleUpdateAdminNotificationSettings = async (
        updates: Partial<AdminNotificationSettings>
    ) => {
        if (!adminNotificationSettings) return;

        try {
            const newSettings = { ...adminNotificationSettings, ...updates };
            await updateAdminNotificationSettings(token, newSettings);
            setAdminNotificationSettings(newSettings);
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : 'Failed to update admin notification settings'
            );
        }
    };

    if (!user.isAdmin) {
        return null;
    }

    // Remove conditional rendering since we handle visibility in parent

    return (
        <div className="space-y-6">
            {/* Global settings - sharing and notifications */}
            {settings && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-red-800 dark:text-red-200">
                                Global Settings
                            </h4>
                            <p className="text-sm text-red-600 dark:text-red-300">
                                Disable all timetable sharing for everyone
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.globalSharingEnabled}
                                onChange={(e) =>
                                    handleUpdateGlobalSharing(e.target.checked)
                                }
                                className="sr-only peer"
                            />
                            <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-red-600"></div>
                        </label>
                    </div>
                </div>
            )}

            {/* Admin notification settings */}
            {adminNotificationSettings && (
                <div className="space-y-4">
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">
                        Notification System Settings
                    </h4>

                    <div className="flex items-center justify-between">
                        <div>
                            <h5 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                Timetable notifications
                            </h5>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Enable automatic notifications for timetable
                                changes
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={
                                    adminNotificationSettings.enableTimetableNotifications ||
                                    false
                                }
                                onChange={(e) =>
                                    handleUpdateAdminNotificationSettings({
                                        enableTimetableNotifications:
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
                                Access requests
                            </h5>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Get notified about whitelist access requests
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={
                                    adminNotificationSettings.enableAccessRequestNotifications ||
                                    false
                                }
                                onChange={(e) =>
                                    handleUpdateAdminNotificationSettings({
                                        enableAccessRequestNotifications:
                                            e.target.checked,
                                    })
                                }
                                className="sr-only peer"
                            />
                            <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {/* Timetable refresh interval (minutes) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                            Timetable check interval (minutes)
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            How often to poll Untis for changes that trigger
                            notifications (5-1440 minutes)
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={5}
                                max={1440}
                                value={
                                    adminNotificationSettings.timetableFetchInterval
                                }
                                onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    if (
                                        Number.isFinite(v) &&
                                        v >= 5 &&
                                        v <= 1440
                                    ) {
                                        handleUpdateAdminNotificationSettings({
                                            timetableFetchInterval: v,
                                        });
                                    }
                                }}
                                className="w-24 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                minutes
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Rest of the admin interface content would continue here... */}
            {/* This is a simplified version - the full component would include all the admin tables and forms */}

            {error && (
                <div className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}
        </div>
    );
}
