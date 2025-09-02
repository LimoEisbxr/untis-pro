import type { NextFunction, Request, Response } from 'express';

// In-memory per-user limiter: max 6 requests per 5s
// Applies to routes that hit WebUntis (timetable fetches, credential verification)

type Stamp = number; // milliseconds since epoch
type Entry = {
    stamps: Stamp[]; // recent allowed request times within 10s window
    lastAllowedAt: Stamp | null;
};

const WINDOW_MS = 5_000; // 5 seconds
const MAX_WITHIN_WINDOW = 6;

const store = new Map<string, Entry>();

function now(): number {
    return Date.now();
}

function getKey(req: Request): string {
    // Prefer authenticated user id, else use username from body for register, else IP
    if (req.user?.id) return `user:${req.user.id}`;
    const maybeUsername =
        typeof req.body?.username === 'string' && req.body.username.trim();
    if (maybeUsername) return `username:${maybeUsername}`;
    return `ip:${req.ip}`;
}

export function untisUserLimiter(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const key = getKey(req);
    const t = now();
    let entry = store.get(key);
    if (!entry) {
        entry = { stamps: [], lastAllowedAt: null };
        store.set(key, entry);
    }

    // Prune window
    entry.stamps = entry.stamps.filter((s) => t - s <= WINDOW_MS);

    // Enforce window max
    if (entry.stamps.length >= MAX_WITHIN_WINDOW) {
        const oldest = entry.stamps[0] ?? t;
        const until = WINDOW_MS - (t - oldest);
        const retryAfter = Math.max(1, Math.ceil(until / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
            error: 'Too many WebUntis requests. Please try again shortly.',
            retryAfter,
        });
    }

    // Allow
    entry.stamps.push(t);
    entry.lastAllowedAt = t;
    next();
}
