import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, adminOnly } from '../server/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../store/prisma.js';

const router = Router();

// Rate limit for color operations
const colorLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 30, // 30 requests per minute per IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many color requests, please slow down.' },
});

const colorSchema = z.object({
    lessonName: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
});

const colorWithContextSchema = z.object({
    lessonName: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format'),
    viewingUserId: z.string().optional(), // The user whose timetable is being viewed
});

const lessonNameSchema = z.object({
    lessonName: z.string().min(1).max(100),
});

const lessonNameWithContextSchema = z.object({
    lessonName: z.string().min(1).max(100),
    viewingUserId: z.string().optional(), // The user whose timetable is being viewed
});

// Helper function to determine if user is admin
function isAdminUser(req: any): boolean {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    try {
        const decoded: any = jwt.verify(
            token,
            process.env.JWT_SECRET || 'dev-secret'
        );
        return !!decoded?.isAdmin;
    } catch {
        return false;
    }
}

// Get user's lesson colors
router.get('/my-colors', authMiddleware, colorLimiter, async (req, res) => {
    try {
        const isAdmin = isAdminUser(req);
        
        // For admin users, return default colors since they don't have user-specific colors
        if (isAdmin) {
            const defaults = await prisma.defaultLessonColor.findMany({
                select: {
                    lessonName: true,
                    color: true,
                },
            });
            
            const colorMap = defaults.reduce((acc: Record<string, string>, { lessonName, color }: { lessonName: string; color: string }) => {
                acc[lessonName] = color;
                return acc;
            }, {} as Record<string, string>);
            
            res.json(colorMap);
            return;
        }
        
        // For regular users, return their user-specific colors
        const colors = await prisma.lessonColorSetting.findMany({
            where: { userId: req.user!.id },
            select: {
                lessonName: true,
                color: true,
            },
        });
        
        const colorMap = colors.reduce((acc: Record<string, string>, { lessonName, color }: { lessonName: string; color: string }) => {
            acc[lessonName] = color;
            return acc;
        }, {} as Record<string, string>);
        
        res.json(colorMap);
    } catch (error) {
        console.error('[lessonColors/my-colors] error', error);
        res.status(500).json({ error: 'Failed to fetch lesson colors' });
    }
});

// Set color for a lesson
router.post('/set-color', authMiddleware, colorLimiter, async (req, res) => {
    const validation = colorWithContextSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.flatten() });
    }
    
    const { lessonName, color, viewingUserId } = validation.data;
    const isAdmin = isAdminUser(req);
    const currentUserId = req.user!.id;
    
    try {
        // Scenario 1: Admin viewing another user's timetable -> modify global defaults
        if (isAdmin && viewingUserId && viewingUserId !== currentUserId) {
            await prisma.defaultLessonColor.upsert({
                where: { lessonName },
                update: { color },
                create: { lessonName, color },
            });
            res.json({ success: true, type: 'default' });
            return;
        }
        
        // Scenario 2: Admin viewing their own timetable (admin user doesn't exist in DB)
        if (isAdmin && (!viewingUserId || viewingUserId === currentUserId)) {
            // For admin users, also modify global defaults since they don't have a User record
            await prisma.defaultLessonColor.upsert({
                where: { lessonName },
                update: { color },
                create: { lessonName, color },
            });
            res.json({ success: true, type: 'default' });
            return;
        }
        
        // Scenario 3: Regular user (viewing their own or another user's timetable)
        // Always save to the current user's preferences
        await prisma.lessonColorSetting.upsert({
            where: {
                userId_lessonName: {
                    userId: currentUserId,
                    lessonName,
                },
            },
            update: { color },
            create: {
                userId: currentUserId,
                lessonName,
                color,
            },
        });
        
        res.json({ success: true, type: 'user' });
    } catch (error) {
        console.error('[lessonColors/set-color] error', error);
        res.status(500).json({ error: 'Failed to set lesson color' });
    }
});

// Remove color for a lesson (revert to default)
router.delete('/remove-color', authMiddleware, colorLimiter, async (req, res) => {
    const validation = lessonNameWithContextSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.flatten() });
    }
    
    const { lessonName, viewingUserId } = validation.data;
    const isAdmin = isAdminUser(req);
    const currentUserId = req.user!.id;
    
    try {
        // Scenario 1 & 2: Admin user -> remove global default
        if (isAdmin) {
            await prisma.defaultLessonColor.deleteMany({
                where: { lessonName },
            });
            res.json({ success: true, type: 'default' });
            return;
        }
        
        // Scenario 3: Regular user -> remove their user-specific color
        await prisma.lessonColorSetting.deleteMany({
            where: {
                userId: currentUserId,
                lessonName,
            },
        });
        
        res.json({ success: true, type: 'user' });
    } catch (error) {
        console.error('[lessonColors/remove-color] error', error);
        res.status(500).json({ error: 'Failed to remove lesson color' });
    }
});

// Admin routes for default colors
router.get('/defaults', authMiddleware, colorLimiter, async (req, res) => {
    try {
        const defaults = await prisma.defaultLessonColor.findMany({
            select: {
                lessonName: true,
                color: true,
            },
        });
        
        const colorMap = defaults.reduce((acc: Record<string, string>, { lessonName, color }: { lessonName: string; color: string }) => {
            acc[lessonName] = color;
            return acc;
        }, {} as Record<string, string>);
        
        res.json(colorMap);
    } catch (error) {
        console.error('[lessonColors/defaults] error', error);
        res.status(500).json({ error: 'Failed to fetch default lesson colors' });
    }
});

router.post('/set-default', authMiddleware, adminOnly, colorLimiter, async (req, res) => {
    const validation = colorSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.flatten() });
    }
    
    const { lessonName, color } = validation.data;
    
    try {
        await prisma.defaultLessonColor.upsert({
            where: { lessonName },
            update: { color },
            create: { lessonName, color },
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('[lessonColors/set-default] error', error);
        res.status(500).json({ error: 'Failed to set default lesson color' });
    }
});

export default router;