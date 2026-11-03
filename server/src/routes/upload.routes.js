import express from 'express';
import { uploadAvatar } from '../controllers/upload.controller.js';
import { upload } from '../middlewares/upload.middleware.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Route upload ảnh đại diện (cần đăng nhập)
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

export default router;
