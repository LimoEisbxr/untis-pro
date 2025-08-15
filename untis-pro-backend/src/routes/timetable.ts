import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../server/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { getOrFetchTimetableRange } from '../services/untisService.js';

const router = Router();

// Rate limit Untis API calls to protect remote service and our app
const untisLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 20, // 20 requests per minute per IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
});

const rangeSchema = z.object({
    userId: z.string().uuid().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
});

router.get('/me', authMiddleware, untisLimiter, async (req, res) => {
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

router.get('/user/:userId', authMiddleware, untisLimiter, async (req, res) => {
    const params = rangeSchema.safeParse({
        ...req.query,
        userId: req.params.userId,
    });
    if (!params.success)
        return res.status(400).json({ error: params.error.flatten() });
    try {
        const { userId, start, end } = params.data;
        // Admins can view any user's timetable
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        let requesterId = req.user!.id;
        try {
            const decoded: any = jwt.verify(
                token,
                process.env.JWT_SECRET || 'dev-secret'
            );
            if (decoded?.isAdmin) requesterId = userId!;
        } catch {}
        const data = await getOrFetchTimetableRange({
            requesterId,
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
