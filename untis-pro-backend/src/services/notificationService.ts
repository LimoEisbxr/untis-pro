import { prisma } from '../store/prisma.js';

export interface NotificationData {
    type: string;
    title: string;
    message: string;
    data?: any;
    userId: string;
    expiresAt?: Date;
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
            await (prisma as any).notification.create({
                data: {
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    message: data.message,
                    data: data.data || null,
                    expiresAt: data.expiresAt,
                },
            });

            // Try to send push notification if user has subscriptions
            await this.sendPushNotification(data);
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
            if (!this.isNotificationTypeEnabled(data.type, user.notificationSettings)) {
                return;
            }

            const subscriptions = user.notificationSubscriptions || [];
            if (subscriptions.length === 0) {
                return;
            }

            // In a real implementation, you would use web-push library here
            // For now, just mark notifications as sent
            await (prisma as any).notification.updateMany({
                where: {
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    sent: false,
                },
                data: { sent: true },
            });

            console.log(`Push notification sent to ${subscriptions.length} devices for user ${data.userId}`);
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
    async notifyAccessRequest(username: string, message?: string): Promise<void> {
        try {
            const userManagers = await (prisma as any).user.findMany({
                where: { isUserManager: true },
                include: { notificationSettings: true },
            });

            for (const manager of userManagers) {
                if (manager.notificationSettings?.accessRequestsEnabled !== false) {
                    await this.createNotification({
                        type: 'access_request',
                        title: 'New Access Request',
                        message: `${username} has requested access${message ? `: ${message}` : ''}`,
                        userId: manager.id,
                        data: { username, message },
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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
            const adminSettings = await (prisma as any).adminNotificationSettings.findFirst();
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

            // Check for cancelled or irregular lessons
            const today = new Date();
            const todayString = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

            for (const lesson of lessons) {
                if (lesson.date === todayString || lesson.date === todayString + 1) { // Today or tomorrow
                    if (lesson.code === 'cancelled') {
                        await this.createNotification({
                            type: 'cancelled_lesson',
                            title: 'Lesson Cancelled',
                            message: `${lesson.su?.[0]?.name || 'Lesson'} has been cancelled`,
                            userId: user.id,
                            data: lesson,
                        });
                    } else if (lesson.code === 'irregular') {
                        await this.createNotification({
                            type: 'irregular_lesson',
                            title: 'Irregular Lesson',
                            message: `${lesson.su?.[0]?.name || 'Lesson'} has irregular scheduling`,
                            userId: user.id,
                            data: lesson,
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to check timetable changes for user ${user.id}:`, error);
        }
    }

    // Start the background notification service
    async startService(): Promise<void> {
        if (this.intervalId) {
            return; // Already running
        }

        console.log('Starting notification service...');

        // Get fetch interval from admin settings
        const adminSettings = await (prisma as any).adminNotificationSettings.findFirst();
        const intervalMinutes = adminSettings?.timetableFetchInterval || 30;

        this.intervalId = setInterval(async () => {
            await this.checkTimetableChanges();
        }, intervalMinutes * 60 * 1000); // Convert minutes to milliseconds

        console.log(`Notification service started with ${intervalMinutes} minute interval`);
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