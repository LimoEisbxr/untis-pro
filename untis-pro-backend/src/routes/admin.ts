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
    const users = await (prisma as any).user.findMany({
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
        const result = await (prisma as any).user.deleteMany({ where: { id } });
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
        const user = await (prisma as any).user.update({
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

// Username whitelist management (DB-backed)
const whitelistCreateSchema = z.object({
    value: z.string().trim().min(1).max(100),
});

// List whitelist rules
router.get('/whitelist', adminOnly, async (_req, res) => {
    const rules = await (prisma as any).whitelistRule.findMany({
        orderBy: [{ value: 'asc' }],
        select: { id: true, value: true, createdAt: true },
    });
    res.json({ rules });
});

// Add a whitelist rule (idempotent)
router.post('/whitelist', adminOnly, async (req, res) => {
    const parsed = whitelistCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const value = parsed.data.value.toLowerCase();
    try {
        const existing = await (prisma as any).whitelistRule.findFirst({
            where: { value },
            select: { id: true, value: true, createdAt: true },
        });
        if (existing) return res.json({ rule: existing, created: false });

        const rule = await (prisma as any).whitelistRule.create({
            data: { value },
            select: { id: true, value: true, createdAt: true },
        });
        res.json({ rule, created: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to create rule';
        res.status(400).json({ error: msg });
    }
});

// Delete a whitelist rule
router.delete('/whitelist/:id', adminOnly, async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
        const result = await (prisma as any).whitelistRule.deleteMany({ where: { id } });
        if (result.count === 0)
            return res.status(404).json({ error: 'Rule not found' });
        res.json({ ok: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to delete rule';
        res.status(400).json({ error: msg });
    }
});

export default router;
