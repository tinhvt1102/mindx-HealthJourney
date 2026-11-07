import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import userRoutes from './routes/user.routes.js';
import healthRecordRoutes from './routes/healthRecord.routes.js';
import familyRoutes from './routes/family.routes.js';
import invitationRoutes from './routes/invitation.routes.js';
import aiRoutes from './routes/ai.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import reminderRoutes from './routes/reminder.routes.js';
import shareRoutes from './routes/share.routes.js';
import streakRoutes from './routes/streak.routes.js';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'HealthJourney Backend API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/health-records', healthRecordRoutes);
app.use('/api/health-records', healthRecordRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/v1/families', familyRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/v1/invitations', invitationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/v1/ai', aiRoutes);

// Sprint 5 & 6 new routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/v1/reminders', reminderRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/v1/shares', shareRoutes);
app.use('/api/streaks', streakRoutes);
app.use('/api/v1/streaks', streakRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy đường dẫn ${req.originalUrl}`,
  });
});

export default app;
