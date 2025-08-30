import { Router } from 'express';
import { z } from 'zod';
import {
    createUserIfNotExists,
    findUserByCredentials,
} from '../services/userService.js';
import {
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    UNTIS_DEFAULT_SCHOOL,
    WHITELIST_ENABLED,
    WHITELIST_USERNAMES,
    WHITELIST_CLASSES,
} from '../server/config.js';
import { verifyUntisCredentials, getUserClassInfo } from '../services/untisService.js';
import { signToken, authMiddleware } from '../server/authMiddleware.js';
import { untisUserLimiter } from '../server/untisRateLimiter.js';

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

    // Check whitelist if enabled (only for new users, not existing ones)
    if (WHITELIST_ENABLED) {
        const username = parsed.data.username;
        let isWhitelisted = false;

        // Check if username is directly whitelisted
        if (WHITELIST_USERNAMES.includes(username)) {
            isWhitelisted = true;
        } else if (WHITELIST_CLASSES.length > 0) {
            // Check if user's class is whitelisted
            try {
                const userClasses = await getUserClassInfo(
                    parsed.data.username,
                    parsed.data.password
                );
                isWhitelisted = userClasses.some(userClass => 
                    WHITELIST_CLASSES.includes(userClass)
                );
            } catch (e: any) {
                console.warn('[whitelist] failed to get user class info for whitelist check', e?.message);
                // If we can't get class info, fall back to username whitelist only
                isWhitelisted = false;
            }
        }

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
        },
    });
});

router.get('/me', authMiddleware, async (req, res) => {
    res.json({ userId: req.user!.id });
});

export default router;
