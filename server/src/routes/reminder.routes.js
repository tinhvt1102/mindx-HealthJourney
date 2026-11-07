import express from 'express';
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  toggleReminder,
  getReminderStats,
} from '../controllers/reminder.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getReminders);
router.post('/', createReminder);
router.get('/stats', getReminderStats);
router.put('/:id', updateReminder);
router.delete('/:id', deleteReminder);
router.post('/:id/toggle', toggleReminder);

export default router;
