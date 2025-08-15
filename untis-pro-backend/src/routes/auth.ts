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
} from '../server/config.js';
import { verifyUntisCredentials } from '../services/untisService.js';
import { signToken, authMiddleware } from '../server/authMiddleware.js';

const router = Router();

const registerSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    displayName: z.string().optional(),
});

router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    // Validate Untis credentials at registration time (backend authoritative)
    try {
        await verifyUntisCredentials(
            parsed.data.username,
            parsed.data.password
        );
    } catch (e: any) {
        const status = e?.status || 400;
        return res.status(status).json({
            error: e?.message || 'Invalid credentials',
            code: e?.code,
        });
    }
    const user = await createUserIfNotExists({ ...parsed.data });
    const token = signToken({ userId: user.id });
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
        },
    });
});

const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

router.post('/login', async (req, res) => {
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
    const user = await findUserByCredentials({ ...parsed.data });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
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
