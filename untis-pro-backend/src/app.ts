import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import timetableRoutes from './routes/timetable.js';
import adminRoutes from './routes/admin.js';
import usersRoutes from './routes/users.js';

dotenv.config();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || '*';
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
