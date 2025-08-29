import express from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import timetableRoutes from './routes/timetable.js';
import adminRoutes from './routes/admin.js';
import usersRoutes from './routes/users.js';
import lessonColorsRoutes from './routes/lessonColors.js';
import sharingRoutes from './routes/sharing.js';

dotenv.config();

const app = express();

const corsOriginEnv = process.env.CORS_ORIGIN;
// Basic security headers
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: false, // can be enabled/tuned later
    })
);
// If running behind a proxy (Docker, reverse proxy), enable to get correct client IPs
app.set('trust proxy', 1);

// CORS config
// If CORS_ORIGIN is provided (comma/space-separated), restrict to those origins (normalized).
// Values accept optional quotes and trailing slashes, e.g., "http://host:8080/".
// If unset, '*', or contains '*', reflect the request Origin dynamically.
function normalizeOrigin(input: string): string {
    return input
        .trim()
        .replace(/^['"]|['"]$/g, '') // strip wrapping quotes
        .replace(/\/$/, '') // drop single trailing slash
        .toLowerCase();
}

let corsOptions: CorsOptions;
if (!corsOriginEnv || corsOriginEnv === '*' || corsOriginEnv.includes('*')) {
    corsOptions = { credentials: true, origin: true };
} else {
    const allowed = corsOriginEnv
        .split(/[\s,]+/)
        .map(normalizeOrigin)
        .filter(Boolean);
    corsOptions = {
        credentials: true,
        origin: (origin, callback) => {
            if (!origin) return callback(null, true); // non-browser tools
            const norm = normalizeOrigin(origin);
            if (allowed.includes(norm)) return callback(null, true);
            return callback(new Error(`CORS: Origin ${origin} not allowed`));
        },
    };
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'untis-pro-backend', time: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/lesson-colors', lessonColorsRoutes);
app.use('/api/sharing', sharingRoutes);

export default app;
