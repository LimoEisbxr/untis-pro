import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import timetableRoutes from './routes/timetable.js';
import adminRoutes from './routes/admin.js';
import usersRoutes from './routes/users.js';

dotenv.config();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || '*';
// Basic security headers
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: false, // can be enabled/tuned later
    })
);
// If running behind a proxy (Docker, reverse proxy), enable to get correct client IPs
app.set('trust proxy', 1);
app.use(
    cors({
        origin: corsOrigin,
        credentials: true,
    })
);
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'untis-pro-backend', time: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);

export default app;
