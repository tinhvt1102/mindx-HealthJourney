import express from 'express';
import { getMyStreak } from '../controllers/streak.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.get('/', getMyStreak);

export default router;
