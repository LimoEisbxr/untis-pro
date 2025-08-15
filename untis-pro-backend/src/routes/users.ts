import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../server/authMiddleware.js';
import { prisma } from '../store/prisma.js';

const router = Router();

const querySchema = z.object({ q: z.string().trim().min(1).max(100) });

// Authenticated user search (by username/displayName)
router.get('/search', authMiddleware, async (req, res) => {
    const parsed = querySchema.safeParse({ q: req.query.q ?? '' });
    if (!parsed.success) return res.json({ users: [] });
    const q = parsed.data.q;
    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: q, mode: 'insensitive' } },
                    { displayName: { contains: q, mode: 'insensitive' } },
                ],
            },
            select: { id: true, username: true, displayName: true },
            orderBy: [{ username: 'asc' }],
            take: 20,
        });
        res.json({ users });
    } catch (e: any) {
        const msg = e?.message || 'Search failed';
        res.status(500).json({ error: msg });
    }
});

export default router;
