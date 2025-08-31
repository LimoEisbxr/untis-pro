import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../store/prisma.js';
import { WHITELIST_ENABLED } from '../server/config.js';
import { notificationService } from '../services/notificationService.js';

const router = Router();

const createAccessRequestSchema = z.object({
    username: z.string().trim().min(1).max(100),
    message: z.string().trim().max(500).optional(),
});

// Create an access request
router.post('/', async (req, res) => {
    // Only allow access requests when whitelist is enabled
    if (!WHITELIST_ENABLED) {
        return res.status(400).json({ error: 'Access requests are not available' });
    }

    const parsed = createAccessRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { username, message } = parsed.data;
    const normalizedUsername = username.toLowerCase();

    try {
        // Check if user is already whitelisted
        const existingRule = await (prisma as any).whitelistRule.findFirst({
            where: { value: normalizedUsername },
        });
        
        if (existingRule) {
            return res.status(400).json({ error: 'User is already authorized' });
        }

        // Check if request already exists
        const existingRequest = await (prisma as any).accessRequest.findFirst({
            where: { username: normalizedUsername },
        });

        if (existingRequest) {
            return res.status(400).json({ error: 'Access request already exists' });
        }

        // Create the access request
        const request = await (prisma as any).accessRequest.create({
            data: {
                username: normalizedUsername,
                message: message || null,
            },
            select: { id: true, username: true, message: true, createdAt: true },
        });

        // Notify user managers about the new access request
        await notificationService.notifyAccessRequest(normalizedUsername, message);

        res.json({ request, success: true });
    } catch (e: any) {
        const msg = e?.message || 'Failed to create access request';
        res.status(400).json({ error: msg });
    }
});

export default router;