import { prisma } from '../store/prisma.js';
import webpush from 'web-push';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@periodix.de';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log('Web Push configured with VAPID keys');
} else {
    console.warn(
        'VAPID keys not configured - push notifications will not work'
    );
}

export interface NotificationData {
    type: string;
    title: string;
    message: string;
    data?: any;
    userId: string;
    expiresAt?: Date;
    notificationId?: string;
}

export class NotificationService {
    private static instance: NotificationService;
    private intervalId: NodeJS.Timeout | null = null;

    private constructor() {}

    static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    // Create a notification
    async createNotification(data: NotificationData): Promise<void> {
        try {
            const created = await (prisma as any).notification.create({
                data: {
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    data: data.data || null,
                    expiresAt: data.expiresAt,
                },
                select: { id: true },
            });

            // Try to send push notification if user has subscriptions
            await this.sendPushNotification({
                ...data,
                notificationId: created.id,
            });
        } catch (error) {
            console.error('Failed to create notification:', error);
        }
    }

    // Send push notification to user's devices
    async sendPushNotification(data: NotificationData): Promise<void> {
        try {
            const user = await (prisma as any).user.findUnique({
                where: { id: data.userId },
                include: {
                    notificationSettings: true,
                    notificationSubscriptions: {
                        where: { active: true },
                    },
                },
            });

            if (!user?.notificationSettings?.pushNotificationsEnabled) {
                return;
            }

            // Check if notification type is enabled
            if (
                !this.isNotificationTypeEnabled(
                    data.type,
                    user.notificationSettings
                )
            ) {
                return;
            }

            const subscriptions = user.notificationSubscriptions || [];
            if (subscriptions.length === 0) {
                return;
            }

            // Only send push notifications if VAPID keys are configured
            if (!vapidPublicKey || !vapidPrivateKey) {
                console.warn(
                    'VAPID keys not configured - skipping push notification'
                );
                return;
            }

            const payload = JSON.stringify({
                title: data.title,
                body: data.message,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: data.notificationId
                    ? `periodix-${data.notificationId}`
                    : `periodix-${data.type}`,
                data: {
                    type: data.type,
                    notificationId: data.notificationId,
                    ...data.data,
                },
                actions: [
                    {
                        action: 'view',
                        title: 'View',
                        icon: '/icon-192.png',
                    },
                    {
                        action: 'dismiss',
                        title: 'Dismiss',
                    },
                ],
            });

            // Send push notification to all user's devices
            const pushPromises = subscriptions.map(async (sub: any) => {
                try {
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth,
                        },
                    };

                    await webpush.sendNotification(pushSubscription, payload);
                    console.log(
                        `Push notification sent to device: ${sub.endpoint.substring(
                            0,
                            50
                        )}...`
                    );
                } catch (error: any) {
                    console.error('Failed to send push to device:', error);

                    // If subscription is invalid, mark it as inactive
                    if (error.statusCode === 410 || error.statusCode === 413) {
                        await (prisma as any).notificationSubscription.update({
                            where: { id: sub.id },
                            data: { active: false },
                        });
                        console.log(
                            `Marked subscription as inactive: ${sub.endpoint.substring(
                                0,
                                50
                            )}...`
                        );
                    }
                }
            });

            await Promise.allSettled(pushPromises);

            // Mark notification as sent
            await (prisma as any).notification.updateMany({
                where: {
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    sent: false,
                },
                data: { sent: true },
            });

            console.log(
                `Push notification sent to ${subscriptions.length} devices for user ${data.userId}`
            );
        } catch (error) {
            console.error('Failed to send push notification:', error);
        }
    }

    // Check if notification type is enabled for user
    private isNotificationTypeEnabled(type: string, settings: any): boolean {
        switch (type) {
            case 'timetable_change':
                return settings.timetableChangesEnabled;
            case 'cancelled_lesson':
                return settings.cancelledLessonsEnabled;
            case 'irregular_lesson':
                return settings.irregularLessonsEnabled;
            case 'access_request':
                return settings.accessRequestsEnabled;
            default:
                return true;
        }
    }

    // Notify user managers about new access requests
    async notifyAccessRequest(
        username: string,
        message?: string
    ): Promise<void> {
        try {
            const userManagers = await (prisma as any).user.findMany({
                where: { isUserManager: true },
                include: { notificationSettings: true },
            });

            for (const manager of userManagers) {
                if (
                    manager.notificationSettings?.accessRequestsEnabled !==
                    false
                ) {
                    await this.createNotification({
                        type: 'access_request',
                        title: 'New Access Request',
                        message: `${username} has requested access${
                            message ? `: ${message}` : ''
                        }`,
                        userId: manager.id,
                        data: { username, message },
                        expiresAt: new Date(
                            Date.now() + 7 * 24 * 60 * 60 * 1000
                        ), // 7 days
                    });
                }
            }
        } catch (error) {
            console.error('Failed to notify access request:', error);
        }
    }

    // Check for timetable changes and notify users
    async checkTimetableChanges(): Promise<void> {
        try {
            const adminSettings = await (
                prisma as any
            ).adminNotificationSettings.findFirst();
            if (!adminSettings?.enableTimetableNotifications) {
                return;
            }

            // Get all users who have timetable notifications enabled
            const users = await (prisma as any).user.findMany({
                where: {
                    notificationSettings: {
                        timetableChangesEnabled: true,
                    },
                },
                include: {
                    notificationSettings: true,
                    timetables: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                    },
                },
            });

            for (const user of users) {
                await this.checkUserTimetableChanges(user);
            }
        } catch (error) {
            console.error('Failed to check timetable changes:', error);
        }
    }

    // Check for changes in a specific user's timetable
    private async checkUserTimetableChanges(user: any): Promise<void> {
        try {
            // This is a simplified version - in a real implementation you would:
            // 1. Fetch the latest timetable from WebUntis
            // 2. Compare with the stored timetable
            // 3. Detect changes (cancelled lessons, irregular lessons, etc.)
            // 4. Send notifications for changes

            const latestTimetable = user.timetables?.[0];
            if (!latestTimetable?.payload) {
                return;
            }

            // Extract lessons from the timetable payload
            const lessons = latestTimetable.payload as any[];
            if (!Array.isArray(lessons)) {
                return;
            }

            // Get current date info
            const today = new Date();
            const todayString =
                today.getFullYear() * 10000 +
                (today.getMonth() + 1) * 100 +
                today.getDate();

            // Calculate week boundaries (assuming week starts on Monday)
            const startOfWeek = new Date(today);
            const dayOfWeek = startOfWeek.getDay();
            const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Handle Sunday (0) as 6 days from Monday
            startOfWeek.setDate(today.getDate() - daysFromMonday);
            const startOfWeekString =
                startOfWeek.getFullYear() * 10000 +
                (startOfWeek.getMonth() + 1) * 100 +
                startOfWeek.getDate();

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            const endOfWeekString =
                endOfWeek.getFullYear() * 10000 +
                (endOfWeek.getMonth() + 1) * 100 +
                endOfWeek.getDate();

            for (const lesson of lessons) {
                // Check cancelled lessons based on user's time scope preference
                if (
                    lesson.code === 'cancelled' &&
                    user.notificationSettings?.cancelledLessonsEnabled
                ) {
                    const scope =
                        user.notificationSettings?.cancelledLessonsTimeScope ||
                        'day';
                    let shouldNotify = false;

                    if (scope === 'day') {
                        shouldNotify = lesson.date === todayString;
                    } else if (scope === 'week') {
                        shouldNotify =
                            lesson.date >= startOfWeekString &&
                            lesson.date <= endOfWeekString;
                    }

                    if (shouldNotify) {
                        await this.createNotification({
                            type: 'cancelled_lesson',
                            title: 'Lesson Cancelled',
                            message: `${
                                lesson.su?.[0]?.name || 'Lesson'
                            } has been cancelled`,
                            userId: user.id,
                            data: lesson,
                        });
                    }
                }

                // Check irregular lessons based on user's time scope preference
                if (
                    lesson.code === 'irregular' &&
                    user.notificationSettings?.irregularLessonsEnabled
                ) {
                    const scope =
                        user.notificationSettings?.irregularLessonsTimeScope ||
                        'day';
                    let shouldNotify = false;

                    if (scope === 'day') {
                        shouldNotify = lesson.date === todayString;
                    } else if (scope === 'week') {
                        shouldNotify =
                            lesson.date >= startOfWeekString &&
                            lesson.date <= endOfWeekString;
                    }

                    if (shouldNotify) {
                        await this.createNotification({
                            type: 'irregular_lesson',
                            title: 'Irregular Lesson',
                            message: `${
                                lesson.su?.[0]?.name || 'Lesson'
                            } has irregular scheduling`,
                            userId: user.id,
                            data: lesson,
                        });
                    }
                }

                // Check for room/teacher changes (also count as irregular)
                const hasTeacherChanges =
                    lesson.te?.some((t: any) => t.orgname) || false;
                const hasRoomChanges =
                    lesson.ro?.some((r: any) => r.orgname) || false;

                if (
                    (hasTeacherChanges || hasRoomChanges) &&
                    user.notificationSettings?.irregularLessonsEnabled
                ) {
                    const scope =
                        user.notificationSettings?.irregularLessonsTimeScope ||
                        'day';
                    let shouldNotify = false;

                    if (scope === 'day') {
                        shouldNotify = lesson.date === todayString;
                    } else if (scope === 'week') {
                        shouldNotify =
                            lesson.date >= startOfWeekString &&
                            lesson.date <= endOfWeekString;
                    }

                    if (shouldNotify) {
                        const changedItems = [];
                        if (hasTeacherChanges) {
                            const teacherChanges = lesson.te
                                ?.filter((t: any) => t.orgname)
                                .map((t: any) => `${t.orgname} → ${t.name}`);
                            changedItems.push(
                                `Teacher: ${teacherChanges?.join(', ')}`
                            );
                        }
                        if (hasRoomChanges) {
                            const roomChanges = lesson.ro
                                ?.filter((r: any) => r.orgname)
                                .map((r: any) => `${r.orgname} → ${r.name}`);
                            changedItems.push(
                                `Room: ${roomChanges?.join(', ')}`
                            );
                        }

                        await this.createNotification({
                            type: 'room_teacher_change',
                            title: 'Room/Teacher Change',
                            message: `${
                                lesson.su?.[0]?.name || 'Lesson'
                            }: ${changedItems.join(', ')}`,
                            userId: user.id,
                            data: lesson,
                        });
                    }
                }
            }
        } catch (error) {
            console.error(
                `Failed to check timetable changes for user ${user.id}:`,
                error
            );
        }
    }

    // Start the background notification service
    async startService(): Promise<void> {
        if (this.intervalId) {
            return; // Already running
        }

        console.log('Starting notification service...');

        // Get fetch interval from admin settings
        const adminSettings = await (
            prisma as any
        ).adminNotificationSettings.findFirst();
        const intervalMinutes = adminSettings?.timetableFetchInterval || 30;

        this.intervalId = setInterval(async () => {
            await this.checkTimetableChanges();
        }, intervalMinutes * 60 * 1000); // Convert minutes to milliseconds

        console.log(
            `Notification service started with ${intervalMinutes} minute interval`
        );
    }

    // Stop the background notification service
    stopService(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Notification service stopped');
        }
    }

    // Clean up expired notifications
    async cleanupExpiredNotifications(): Promise<void> {
        try {
            const result = await (prisma as any).notification.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date(),
                    },
                },
            });

            if (result.count > 0) {
                console.log(`Cleaned up ${result.count} expired notifications`);
            }
        } catch (error) {
            console.error('Failed to cleanup expired notifications:', error);
        }
    }
}

export const notificationService = NotificationService.getInstance();
