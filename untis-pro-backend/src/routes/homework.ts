import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../server/authMiddleware.js';
import { prisma } from '../store/prisma.js';
import { getOrFetchHomeworkRange } from '../services/untisService.js';
import { AppError } from '../server/errors.js';

const router = Router();

const homeworkRangeSchema = z.object({
    start: z.string().optional(),
    end: z.string().optional(),
});

// Get homework for the authenticated user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const validation = homeworkRangeSchema.safeParse(req.query);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.flatten() });
        }

        const { start, end } = validation.data;
        const userId = req.user!.id;

        // First try to get cached homework from database
        let cachedHomework = [];
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            
            cachedHomework = await prisma.homework.findMany({
                where: {
                    ownerId: userId,
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                orderBy: {
                    date: 'asc',
                },
            });
        }

        // If we have recent cached data, return it
        if (cachedHomework.length > 0) {
            const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
            const hasRecentData = cachedHomework.some((hw: any) => hw.updatedAt > recentCutoff);
            
            if (hasRecentData) {
                console.debug('[homework] returning cached data');
                return res.json({
                    userId,
                    rangeStart: start || null,
                    rangeEnd: end || null,
                    cached: true,
                    homework: cachedHomework,
                });
            }
        }

        // Fetch fresh data from WebUntis
        console.debug('[homework] fetching fresh data from WebUntis');
        const result = await getOrFetchHomeworkRange({
            requesterId: userId,
            targetUserId: userId,
            start,
            end,
        });

        // Get updated homework from database
        const homework = await prisma.homework.findMany({
            where: {
                ownerId: userId,
                ...(start && end && {
                    date: {
                        gte: new Date(start),
                        lte: new Date(end),
                    },
                }),
            },
            orderBy: {
                date: 'asc',
            },
        });

        res.json({
            userId: result.userId,
            rangeStart: result.rangeStart,
            rangeEnd: result.rangeEnd,
            cached: false,
            homework,
        });
    } catch (error) {
        console.error('[homework/me] error', error);
        if (error instanceof AppError) {
            return res.status(error.status).json({
                error: error.message,
                code: error.code,
            });
        }
        res.status(500).json({ error: 'Failed to fetch homework' });
    }
});

// Get homework for a specific user (admin only)
router.get('/user/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId parameter' });
        }
        
        const validation = homeworkRangeSchema.safeParse(req.query);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.flatten() });
        }

        const { start, end } = validation.data;
        const requesterId = req.user!.id;

        // Check if user has permission (admin or same user)
        // For admin check, decode the token to see if it's an admin token
        const auth = req.headers.authorization;
        const token = auth!.slice('Bearer '.length);
        const secret = process.env.JWT_SECRET || 'dev-secret';
        let isAdmin = false;
        try {
            const decoded = jwt.verify(token, secret) as any;
            isAdmin = decoded.isAdmin || false;
        } catch {
            // Token validation already handled by authMiddleware
        }
        
        if (!isAdmin && requesterId !== userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Get homework from database first
        const homework = await prisma.homework.findMany({
            where: {
                ownerId: userId,
                ...(start && end && {
                    date: {
                        gte: new Date(start),
                        lte: new Date(end),
                    },
                }),
            },
            orderBy: {
                date: 'asc',
            },
        });

        // Check if we need fresh data
        const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
        const hasRecentData = homework.some((hw: any) => hw.updatedAt > recentCutoff);

        if (!hasRecentData && (start && end)) {
            // Fetch fresh data from WebUntis
            console.debug('[homework/user] fetching fresh data from WebUntis');
            await getOrFetchHomeworkRange({
                requesterId,
                targetUserId: userId,
                start,
                end,
            });

            // Get updated homework from database
            const updatedHomework = await prisma.homework.findMany({
                where: {
                    ownerId: userId,
                    date: {
                        gte: new Date(start),
                        lte: new Date(end),
                    },
                },
                orderBy: {
                    date: 'asc',
                },
            });

            return res.json({
                userId,
                rangeStart: start,
                rangeEnd: end,
                cached: false,
                homework: updatedHomework,
            });
        }

        res.json({
            userId,
            rangeStart: start || null,
            rangeEnd: end || null,
            cached: true,
            homework,
        });
    } catch (error) {
        console.error('[homework/user] error', error);
        if (error instanceof AppError) {
            return res.status(error.status).json({
                error: error.message,
                code: error.code,
            });
        }
        res.status(500).json({ error: 'Failed to fetch homework' });
    }
});

// Update homework completion status
router.patch('/:homeworkId/completion', authMiddleware, async (req, res) => {
    try {
        const { homeworkId } = req.params;
        const { completed } = req.body;
        
        if (typeof completed !== 'boolean') {
            return res.status(400).json({ error: 'completed must be a boolean' });
        }

        const userId = req.user!.id;

        // Check if homework belongs to user
        const homework = await prisma.homework.findFirst({
            where: {
                id: homeworkId,
                ownerId: userId,
            },
        });

        if (!homework) {
            return res.status(404).json({ error: 'Homework not found' });
        }

        // Update completion status
        const updatedHomework = await prisma.homework.update({
            where: { id: homeworkId },
            data: { completed },
        });

        res.json(updatedHomework);
    } catch (error) {
        console.error('[homework/completion] error', error);
        res.status(500).json({ error: 'Failed to update homework completion' });
    }
});

export default router;