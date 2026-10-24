import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { validateUpdateProfile } from '../middlewares/userValidation.middleware.js';
import { updateUserProfile, getUserProfile } from '../controllers/user.controller.js';

const router = express.Router();

// Tất cả các endpoints user đều yêu cầu đăng nhập
router.use(protect);

// GET & PUT /api/users/profile
router.route('/profile')
  .get(getUserProfile)
  .put(validateUpdateProfile, updateUserProfile);

export default router;
