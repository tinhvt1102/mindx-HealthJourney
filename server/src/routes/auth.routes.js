import express from 'express';
import { 
  register, 
  login, 
  verifyOtp, 
  resendOtp, 
  getMe, 
  updateProfile 
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

// Routes yêu cầu đăng nhập
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

export default router;
