import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { summarizeTrends } from '../controllers/ai.controller.js';

const router = express.Router();

/**
 * @route   POST /api/ai/summarize-trends
 * @desc    Tóm tắt xu hướng sức khỏe bằng Gemini AI (Jira SCRUM-54/55/56/57)
 * @access  Private (yêu cầu Bearer token)
 * @body    { targetUserId?: string, memberId?: string, familyId?: string, forceRefresh?: boolean }
 */
router.post('/summarize-trends', protect, summarizeTrends);

export default router;
