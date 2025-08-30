import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../store/prisma.js';

export interface AuthPayload {
    userId: string;
    isAdmin?: boolean;
    isUserManager?: boolean;
}

declare global {
    namespace Express {
        interface Request {
            user?: { id: string; isUserManager?: boolean; isAdmin?: boolean };
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
        // Allow admin tokens (no DB row) and regular user tokens (validate in DB)
        if (decoded.isAdmin) {
            (req.user as any) = { id: decoded.userId, isAdmin: true };
            return next();
        }
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, isUserManager: true },
        });
        if (!user) return res.status(401).json({ error: 'Invalid token' });
        (req.user as any) = { id: user.id, isUserManager: user.isUserManager };
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

export async function adminOrUserManagerOnly(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Missing auth token' });
    const token = auth.slice('Bearer '.length);
    const secret = process.env.JWT_SECRET || 'dev-secret';
    try {
        const decoded = jwt.verify(token, secret) as AuthPayload;
        
        // Admin always has access
        if (decoded.isAdmin) {
            (req.user as any) = { id: decoded.userId, isAdmin: true };
            return next();
        }
        
        // Check if user is a user manager
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, isUserManager: true },
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        if (!user.isUserManager) {
            return res.status(403).json({ error: 'Admin or user manager required' });
        }
        
        (req.user as any) = { id: user.id, isUserManager: user.isUserManager };
        return next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
