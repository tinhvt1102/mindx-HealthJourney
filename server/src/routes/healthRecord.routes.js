import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import {
  validateCreateHealthRecord,
  validateUpdateHealthRecord,
} from '../middlewares/healthRecordValidation.middleware.js';
import {
  createHealthRecord,
  getHealthRecords,
  getHealthRecordById,
  updateHealthRecord,
  deleteHealthRecord,
} from '../controllers/healthRecord.controller.js';

const router = express.Router();

// Tất cả các route đều yêu cầu xác thực Bearer Token
router.use(protect);

router
  .route('/')
  .post(validateCreateHealthRecord, createHealthRecord)
  .get(getHealthRecords);

router
  .route('/:id')
  .get(getHealthRecordById)
  .put(validateUpdateHealthRecord, updateHealthRecord)
  .delete(deleteHealthRecord);

export default router;
