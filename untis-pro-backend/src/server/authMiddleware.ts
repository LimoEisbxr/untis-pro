import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../store/prisma.js';

export interface AuthPayload {
    userId: string;
    isAdmin?: boolean;
}

declare global {
    namespace Express {
        interface Request {
            user?: { id: string };
        }
    }
}

export function signToken(payload: AuthPayload) {
    const secret = process.env.JWT_SECRET || 'dev-secret';
    return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Missing auth token' });
    const token = auth.slice('Bearer '.length);
    try {
        const secret = process.env.JWT_SECRET || 'dev-secret';
        const decoded = jwt.verify(token, secret) as AuthPayload;
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });
        if (!user) return res.status(401).json({ error: 'Invalid token' });
        req.user = { id: user.id };
        return next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Missing auth token' });
    const token = auth.slice('Bearer '.length);
    const secret = process.env.JWT_SECRET || 'dev-secret';
    try {
        const decoded = jwt.verify(token, secret) as AuthPayload;
        if (!decoded.isAdmin)
            return res.status(403).json({ error: 'Admin required' });
        return next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
