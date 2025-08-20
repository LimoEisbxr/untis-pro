import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, adminOnly } from '../server/authMiddleware.js';
import rateLimit from 'express-rate-limit';
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

const lessonNameSchema = z.object({
    lessonName: z.string().min(1).max(100),
});

// Get user's lesson colors
router.get('/my-colors', authMiddleware, colorLimiter, async (req, res) => {
    try {
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
    const validation = colorSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.flatten() });
    }
    
    const { lessonName, color } = validation.data;
    
    try {
        await prisma.lessonColorSetting.upsert({
            where: {
                userId_lessonName: {
                    userId: req.user!.id,
                    lessonName,
                },
            },
            update: { color },
            create: {
                userId: req.user!.id,
                lessonName,
                color,
            },
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('[lessonColors/set-color] error', error);
        res.status(500).json({ error: 'Failed to set lesson color' });
    }
});

// Remove color for a lesson (revert to default)
router.delete('/remove-color', authMiddleware, colorLimiter, async (req, res) => {
    const validation = lessonNameSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: validation.error.flatten() });
    }
    
    const { lessonName } = validation.data;
    
    try {
        await prisma.lessonColorSetting.deleteMany({
            where: {
                userId: req.user!.id,
                lessonName,
            },
        });
        
        res.json({ success: true });
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