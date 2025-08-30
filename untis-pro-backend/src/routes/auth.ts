import { Router } from 'express';
import { z } from 'zod';
import {
    createUserIfNotExists,
    findUserByCredentials,
} from '../services/userService.js';
import {
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    WHITELIST_ENABLED,
} from '../server/config.js';
import { verifyUntisCredentials } from '../services/untisService.js';
import { signToken, authMiddleware } from '../server/authMiddleware.js';
import { untisUserLimiter } from '../server/untisRateLimiter.js';
import { prisma } from '../store/prisma.js';

const router = Router();

const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

router.post('/login', untisUserLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    // Admin login via env credentials
    if (
        ADMIN_USERNAME &&
        ADMIN_PASSWORD &&
        parsed.data.username === ADMIN_USERNAME &&
        parsed.data.password === ADMIN_PASSWORD
    ) {
        const token = signToken({ userId: 'admin', isAdmin: true });
        return res.json({
            token,
            user: {
                id: 'admin',
                username: ADMIN_USERNAME,
                displayName: 'Administrator',
                isAdmin: true,
            },
        });
    }

    // Try to find existing user first
    const existingUser = await findUserByCredentials({ ...parsed.data });
    if (existingUser) {
        const token = signToken({ userId: existingUser.id });
        return res.json({
            token,
            user: {
                id: existingUser.id,
                username: existingUser.username,
                displayName: existingUser.displayName,
                isAdmin: false,
                isUserManager: existingUser.isUserManager || false,
            },
        });
    }

    // User not found in database - verify with Untis and auto-register
    try {
        await verifyUntisCredentials(
            parsed.data.username,
            parsed.data.password
        );
    } catch (e: any) {
        const status = e?.status || 401;
        return res.status(status).json({
            error: e?.message || 'Invalid credentials',
            code: e?.code,
        });
    }

    // Check whitelist (DB-backed) if enabled — username-only
    if (WHITELIST_ENABLED) {
        const username = parsed.data.username.toLowerCase();

        // Check direct username rule
        const usernameRule = await (prisma as any).whitelistRule.findFirst({
            where: { value: username },
            select: { id: true },
        });

        const isWhitelisted = Boolean(usernameRule);
        if (!isWhitelisted) {
            return res.status(403).json({
                error: 'Access denied. Your account is not authorized for this beta.',
                code: 'NOT_WHITELISTED',
            });
        }
    }

    // Create user with Untis credentials
    const user = await createUserIfNotExists({ ...parsed.data });
    const token = signToken({ userId: user.id });
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            isAdmin: false,
            isUserManager: user.isUserManager || false,
        },
    });
});

router.get('/me', authMiddleware, async (req, res) => {
    res.json({ userId: req.user!.id });
});

export default router;
