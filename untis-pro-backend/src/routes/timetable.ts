import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../server/authMiddleware.js';
import { getOrFetchTimetableRange } from '../services/untisService.js';

const router = Router();

const rangeSchema = z.object({
    userId: z.string().uuid().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const start = req.query.start as string | undefined;
        const end = req.query.end as string | undefined;
        const data = await getOrFetchTimetableRange({
            requesterId: req.user!.id,
            targetUserId: req.user!.id,
            start,
            end,
        });
        res.json(data);
    } catch (e: any) {
        const status = e?.status || 500;
        console.error('[timetable/me] error', {
            status,
            message: e?.message,
            code: e?.code,
        });
        res.status(status).json({
            error: e?.message || 'Failed',
            code: e?.code,
        });
    }
});

router.get('/user/:userId', authMiddleware, async (req, res) => {
    const params = rangeSchema.safeParse({
        ...req.query,
        userId: req.params.userId,
    });
    if (!params.success)
        return res.status(400).json({ error: params.error.flatten() });
    try {
        const { userId, start, end } = params.data;
        const data = await getOrFetchTimetableRange({
            requesterId: req.user!.id,
            targetUserId: userId!,
            start,
            end,
        });
        res.json(data);
    } catch (e: any) {
        const status = e?.status || 500;
        console.error('[timetable/user] error', {
            status,
            message: e?.message,
            code: e?.code,
        });
        res.status(status).json({
            error: e?.message || 'Failed',
            code: e?.code,
        });
    }
});

export default router;
