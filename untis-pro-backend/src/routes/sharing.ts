import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../server/authMiddleware.js';
import { prisma } from '../store/prisma.js';
import jwt from 'jsonwebtoken';

const router = Router();

// Schema for sharing operations
const shareUserSchema = z.object({
    userId: z.string().uuid(),
});

const updateSharingSchema = z.object({
    enabled: z.boolean(),
});

const globalSharingSchema = z.object({
    enabled: z.boolean(),
});

// Helper function to determine if user is admin
function isAdminUser(req: any): boolean {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        const decoded: any = jwt.verify(
            token,
            process.env.JWT_SECRET || 'dev-secret'
        );
        return Boolean(decoded?.isAdmin);
    } catch {
        return false;
    }
}

// Get current user's sharing settings and list
router.get('/settings', authMiddleware, async (req, res) => {
    try {
        const userId = req.user!.id;
        
        // Get user's sharing settings
        const user = await (prisma as any).user.findUnique({
            where: { id: userId },
            select: { sharingEnabled: true },
        });
        
        // Get list of users this user is sharing with
        const sharingWith = await (prisma as any).timetableShare.findMany({
            where: { ownerId: userId },
            include: {
                sharedWith: {
                    select: { id: true, username: true, displayName: true },
                },
            },
        });
        
        // Get global sharing setting (for admins)
        let globalSharingEnabled = true;
        if (isAdminUser(req)) {
            const appSettings = await (prisma as any).appSettings.findFirst();
            globalSharingEnabled = appSettings?.globalSharingEnabled ?? true;
        }
        
        res.json({
            sharingEnabled: user?.sharingEnabled ?? false,
            sharingWith: sharingWith.map((s: any) => s.sharedWith),
            globalSharingEnabled,
            isAdmin: isAdminUser(req),
        });
    } catch (error) {
        console.error('[sharing/settings] error', error);
        res.status(500).json({ error: 'Failed to get sharing settings' });
    }
});

// Update user's sharing enabled/disabled setting
router.put('/settings', authMiddleware, async (req, res) => {
    const parsed = updateSharingSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    try {
        const userId = req.user!.id;
        const { enabled } = parsed.data;
        
        await (prisma as any).user.update({
            where: { id: userId },
            data: { sharingEnabled: enabled },
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('[sharing/settings] error', error);
        res.status(500).json({ error: 'Failed to update sharing settings' });
    }
});

// Share timetable with another user
router.post('/share', authMiddleware, async (req, res) => {
    const parsed = shareUserSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    try {
        const ownerId = req.user!.id;
        const { userId: sharedWithId } = parsed.data;
        
        // Can't share with yourself
        if (ownerId === sharedWithId) {
            return res.status(400).json({ error: 'Cannot share with yourself' });
        }
        
        // Check if target user exists
        const targetUser = await (prisma as any).user.findUnique({
            where: { id: sharedWithId },
            select: { id: true, username: true, displayName: true },
        });
        
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Create or update share relationship
        await (prisma as any).timetableShare.upsert({
            where: {
                ownerId_sharedWithId: {
                    ownerId,
                    sharedWithId,
                },
            },
            update: {},
            create: {
                ownerId,
                sharedWithId,
            },
        });
        
        res.json({ success: true, user: targetUser });
    } catch (error) {
        console.error('[sharing/share] error', error);
        res.status(500).json({ error: 'Failed to share timetable' });
    }
});

// Stop sharing timetable with a user
router.delete('/share/:userId', authMiddleware, async (req, res) => {
    const parsed = shareUserSchema.safeParse({ userId: req.params.userId });
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    try {
        const ownerId = req.user!.id;
        const { userId: sharedWithId } = parsed.data;
        
        await (prisma as any).timetableShare.deleteMany({
            where: {
                ownerId,
                sharedWithId,
            },
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('[sharing/unshare] error', error);
        res.status(500).json({ error: 'Failed to stop sharing' });
    }
});

// Admin: Toggle global sharing
router.put('/global', authMiddleware, async (req, res) => {
    if (!isAdminUser(req)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const parsed = globalSharingSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    try {
        const { enabled } = parsed.data;
        
        // Upsert app settings
        await (prisma as any).appSettings.upsert({
            where: { id: 'singleton' },
            update: { globalSharingEnabled: enabled },
            create: { id: 'singleton', globalSharingEnabled: enabled },
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('[sharing/global] error', error);
        res.status(500).json({ error: 'Failed to update global sharing setting' });
    }
});

export default router;