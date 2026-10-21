import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import healthRecordRoutes from './routes/healthRecord.routes.js';
import familyRoutes from './routes/family.routes.js';
import invitationRoutes from './routes/invitation.routes.js';

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'HealthJourney Backend API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/health-records', healthRecordRoutes);
app.use('/api/health-records', healthRecordRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/v1/families', familyRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/v1/invitations', invitationRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy đường dẫn ${req.originalUrl}`,
  });
});

export default app;
