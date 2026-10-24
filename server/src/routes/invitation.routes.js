import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import {
  acceptInvitation,
  declineInvitation,
  getInvitationDetails,
  getMyPendingInvitations,
} from '../controllers/invitation.controller.js';

const router = express.Router();

// Yêu cầu đăng nhập để xem và thao tác lời mời
router.use(protect);

// Endpoint lấy danh sách lời mời đang chờ cho user hiện tại (SCRUM-39 FE Banner/Modal)
router.get('/pending', getMyPendingInvitations);

router.get('/:token', getInvitationDetails);
router.post('/:token/accept', acceptInvitation);
router.post('/:token/decline', declineInvitation);

export default router;
