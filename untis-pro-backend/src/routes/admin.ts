import { Router } from 'express';
import { z } from 'zod';
import { adminOnly } from '../server/authMiddleware.js';
import { prisma } from '../store/prisma.js';

const router = Router();

const updateUserSchema = z.object({
    displayName: z.string().trim().max(100).nullable(),
});

// List users (basic fields only)
router.get('/users', adminOnly, async (_req, res) => {
    const users = await prisma.user.findMany({
        select: { id: true, username: true, displayName: true },
        orderBy: { username: 'asc' },
    });
    res.json({ users });
});

// Delete user by id
router.delete('/users/:id', adminOnly, async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
        const result = await prisma.user.deleteMany({ where: { id } });
        if (result.count === 0)
            return res.status(404).json({ error: 'User not found' });
        res.json({ ok: true, count: result.count });
    } catch (e: any) {
        const msg = e?.message || 'Failed to delete user';
        res.status(400).json({ error: msg });
    }
});

// Update user display name
router.patch('/users/:id', adminOnly, async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    try {
        const user = await prisma.user.update({
            where: { id },
            data: { displayName: parsed.data.displayName },
            select: { id: true, username: true, displayName: true },
        });
        res.json({ user });
    } catch (e: any) {
        const msg = e?.message || 'Failed to update user';
        res.status(400).json({ error: msg });
    }
});

export default router;
