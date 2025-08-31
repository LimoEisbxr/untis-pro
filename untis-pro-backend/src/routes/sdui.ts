import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../server/authMiddleware.js';
import { getSduiClient } from '../services/sduiService.js';
import { prisma } from '../store/prisma.js';
import { decryptSecret } from '../server/crypto.js';
import { AppError } from '../server/errors.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

const getNewsSchema = z.object({
    page: z.coerce.number().min(1).default(1),
});

const getNewsByIdSchema = z.object({
    newsId: z.coerce.number().min(1),
});

// Initialize Sdui client for user if not already done
async function initializeSduiClient(userId: string) {
    if (userId === 'admin') {
        throw new AppError('Admin cannot access Sdui news', 403, 'ADMIN_NO_SDUI');
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            username: true,
            untisSecretCiphertext: true,
            untisSecretNonce: true,
            untisSecretKeyVersion: true,
            school: true,
        },
    });

    if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.untisSecretCiphertext || !user.untisSecretNonce) {
        throw new AppError(
            'User missing encrypted credentials',
            400,
            'MISSING_CREDENTIALS'
        );
    }

    // Decrypt Untis password (same credentials used for Sdui)
    let password: string;
    try {
        password = decryptSecret({
            ciphertext: user.untisSecretCiphertext as any,
            nonce: user.untisSecretNonce as any,
            keyVersion: user.untisSecretKeyVersion || 1,
        });
    } catch (e) {
        console.error('[sdui] decrypt secret failed', e);
        throw new AppError(
            'Credential decryption failed',
            500,
            'DECRYPT_FAILED'
        );
    }

    const sduiClient = getSduiClient(userId);
    
    // Use school as slink (this might need adjustment based on actual school format)
    const slink = user.school || 'default';
    
    try {
        await sduiClient.login({
            slink,
            identifier: user.username,
            password,
        });
    } catch (error: any) {
        console.error('[sdui] login failed:', error.message);
        throw new AppError(
            'Sdui authentication failed',
            401,
            'SDUI_AUTH_FAILED'
        );
    }

    return sduiClient;
}

// GET /api/sdui/news - Get news by page
router.get('/news', async (req, res) => {
    try {
        const parsed = getNewsSchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() });
        }

        const { page } = parsed.data;
        const userId = req.user!.id;

        const sduiClient = await initializeSduiClient(userId);
        const response = await sduiClient.getNewsByPage({ page });

        res.json(response.data);
    } catch (error: any) {
        console.error('[sdui] get news error:', error);
        if (error instanceof AppError) {
            return res.status(error.status).json({ 
                error: error.message,
                code: error.code 
            });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/sdui/news/:newsId - Get specific news item
router.get('/news/:newsId', async (req, res) => {
    try {
        const parsed = getNewsByIdSchema.safeParse(req.params);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() });
        }

        const { newsId } = parsed.data;
        const userId = req.user!.id;

        const sduiClient = await initializeSduiClient(userId);
        const response = await sduiClient.getNewsById({ newsId });

        res.json(response.data);
    } catch (error: any) {
        console.error('[sdui] get news by id error:', error);
        if (error instanceof AppError) {
            return res.status(error.status).json({ 
                error: error.message,
                code: error.code 
            });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;