import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import {
  getWeekPlan,
  savePlan,
  toggleHabit,
  syncFromAi,
} from '../controllers/habit.controller.js';

const router = express.Router();

router.use(protect);

router.get('/week', getWeekPlan);
router.post('/plan', savePlan);
router.post('/log', toggleHabit);
router.post('/sync-ai', syncFromAi);

export default router;
