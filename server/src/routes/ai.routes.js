import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { summarizeTrends } from '../controllers/ai.controller.js';

const router = express.Router();

/**
 * @route   POST /api/ai/summarize-trends
 * @desc    Tóm tắt xu hướng sức khỏe bằng Gemini AI (Jira SCRUM-55, SCRUM-56)
 * @access  Private (yêu cầu Bearer token)
 * @body    { targetUserId?: string, familyId?: string }
 *
 * Logic:
 *  - Không truyền targetUserId -> phân tích cho chính người đăng nhập
 *  - Truyền targetUserId khác -> phải có familyId và quyền SharingPolicy
 *  - Tối thiểu 3 bản ghi (AC4)
 *  - Cache theo ngày, không gọi Gemini API lặp lại trong cùng ngày (SCRUM-57)
 */
router.post('/summarize-trends', protect, summarizeTrends);

export default router;
