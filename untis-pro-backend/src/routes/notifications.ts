import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../store/prisma.js';
import { authMiddleware } from '../server/authMiddleware.js';

const router = Router();

// Get user's notifications
router.get('/', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const notifications = await (prisma as any).notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50, // Limit to 50 most recent
        });

        res.json({ notifications });
    } catch (e: any) {
        const msg = e?.message || 'Failed to fetch notifications';
        res.status(500).json({ error: msg });
    }
});

// Mark notification as read
const markReadSchema = z.object({
    notificationId: z.string().uuid(),
});

router.patch('/:id/read', authMiddleware, async (req, res) => {
    const parsed = markReadSchema.safeParse({ notificationId: req.params.id });
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const notification = await (prisma as any).notification.findFirst({
            where: {
                id: parsed.data.notificationId,
                userId: req.user.id,
            },
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await (prisma as any).notification.update({
            where: { id: parsed.data.notificationId },
            data: { read: true },
        });

        res.json({ success: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to mark notification as read';
        res.status(500).json({ error: msg });
    }
});

// Mark all notifications as read
router.patch('/read-all', authMiddleware, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await (prisma as any).notification.updateMany({
            where: {
                userId: req.user.id,
                read: false,
            },
            data: { read: true },
        });

        res.json({ success: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to mark all notifications as read';
        res.status(500).json({ error: msg });
    }
});

// Delete notification
router.delete('/:id', authMiddleware, async (req, res) => {
    const parsed = markReadSchema.safeParse({ notificationId: req.params.id });
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const notification = await (prisma as any).notification.findFirst({
            where: {
                id: parsed.data.notificationId,
                userId: req.user.id,
            },
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await (prisma as any).notification.delete({
            where: { id: parsed.data.notificationId },
        });

        res.json({ success: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to delete notification';
        res.status(500).json({ error: msg });
    }
});

// Get notification settings
router.get('/settings', authMiddleware, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        let settings = await (prisma as any).notificationSettings.findUnique({
            where: { userId: req.user.id },
        });

        // Create default settings if they don't exist
        if (!settings) {
            settings = await (prisma as any).notificationSettings.create({
                data: {
                    userId: req.user.id,
                    // Start disabled until user explicitly grants permission
                    browserNotificationsEnabled: false,
                    pushNotificationsEnabled: false,
                    timetableChangesEnabled: true,
                    accessRequestsEnabled: (req.user as any).isUserManager || false,
                    irregularLessonsEnabled: true,
                    cancelledLessonsEnabled: true,
                    cancelledLessonsTimeScope: 'day',
                    irregularLessonsTimeScope: 'day',
                },
            });
        }

        res.json({ settings });
    } catch (e: any) {
        const msg = e?.message || 'Failed to fetch notification settings';
        res.status(500).json({ error: msg });
    }
});

// Update notification settings
const updateSettingsSchema = z.object({
    browserNotificationsEnabled: z.boolean().optional(),
    pushNotificationsEnabled: z.boolean().optional(),
    timetableChangesEnabled: z.boolean().optional(),
    accessRequestsEnabled: z.boolean().optional(),
    irregularLessonsEnabled: z.boolean().optional(),
    cancelledLessonsEnabled: z.boolean().optional(),
    cancelledLessonsTimeScope: z.enum(['day', 'week']).optional(),
    irregularLessonsTimeScope: z.enum(['day', 'week']).optional(),
    devicePreferences: z.record(z.any()).optional(),
});

router.put('/settings', authMiddleware, async (req, res) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const settings = await (prisma as any).notificationSettings.upsert({
            where: { userId: req.user.id },
            create: {
                userId: req.user.id,
                ...parsed.data,
            },
            update: parsed.data,
        });

        res.json({ settings, success: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to update notification settings';
        res.status(500).json({ error: msg });
    }
});

// Subscribe to push notifications
const subscribeSchema = z.object({
    endpoint: z.string().url(),
    p256dh: z.string(),
    auth: z.string(),
    userAgent: z.string().optional(),
    deviceType: z.enum(['mobile', 'desktop', 'tablet']).optional(),
});

router.post('/subscribe', authMiddleware, async (req, res) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Check if subscription already exists
        const existing = await (prisma as any).notificationSubscription.findUnique({
            where: { endpoint: parsed.data.endpoint },
        });

        if (existing) {
            // Update existing subscription
            const subscription = await (prisma as any).notificationSubscription.update({
                where: { endpoint: parsed.data.endpoint },
                data: {
                    userId: req.user.id,
                    p256dh: parsed.data.p256dh,
                    auth: parsed.data.auth,
                    userAgent: parsed.data.userAgent,
                    deviceType: parsed.data.deviceType,
                    active: true,
                },
            });
            return res.json({ subscription, success: true });
        }

        // Create new subscription
        const subscription = await (prisma as any).notificationSubscription.create({
            data: {
                userId: req.user.id,
                endpoint: parsed.data.endpoint,
                p256dh: parsed.data.p256dh,
                auth: parsed.data.auth,
                userAgent: parsed.data.userAgent,
                deviceType: parsed.data.deviceType,
            },
        });

        res.json({ subscription, success: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to create push subscription';
        res.status(500).json({ error: msg });
    }
});

// Unsubscribe from push notifications
router.delete('/subscribe/:endpoint', authMiddleware, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.params.endpoint) {
        return res.status(400).json({ error: 'Endpoint parameter is required' });
    }

    try {
        const endpoint = decodeURIComponent(req.params.endpoint);
        
        const subscription = await (prisma as any).notificationSubscription.findFirst({
            where: {
                endpoint,
                userId: req.user.id,
            },
        });

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        await (prisma as any).notificationSubscription.update({
            where: { id: subscription.id },
            data: { active: false },
        });

        res.json({ success: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to unsubscribe';
        res.status(500).json({ error: msg });
    }
});

// Get VAPID public key for push subscription
router.get('/vapid-public-key', (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
        return res.status(503).json({ error: 'Push notifications not configured' });
    }
    res.json({ publicKey });
});

export default router;