import express from 'express';
import {
  createDoctorShareLink,
  getMyDoctorShareLinks,
  revokeDoctorShareLink,
  verifyDoctorPinAndGetReport,
} from '../controllers/share.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public route cho bác sĩ xác thực PIN không cần đăng nhập
router.post('/:token/verify-pin', verifyDoctorPinAndGetReport);

// Protected routes cho người dùng quản lý link của mình
router.use(protect);
router.post('/create-doctor-link', createDoctorShareLink);
router.get('/my-links', getMyDoctorShareLinks);
router.delete('/:token', revokeDoctorShareLink);

export default router;
