import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { summarizeTrends } from '../controllers/ai.controller.js';

const router = express.Router();

// [AI / BE] Tóm tắt xu hướng sức khỏe định kỳ bằng AI / Fallback engine (Jira SCRUM-54 / E6-S1)
router.post('/summarize-trends', protect, summarizeTrends);

export default router;
