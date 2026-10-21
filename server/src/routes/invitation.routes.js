import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import {
  acceptInvitation,
  declineInvitation,
  getInvitationDetails,
} from '../controllers/invitation.controller.js';

const router = express.Router();

// Yêu cầu đăng nhập để xem và thao tác lời mời
router.use(protect);

router.get('/:token', getInvitationDetails);
router.post('/:token/accept', acceptInvitation);
router.post('/:token/decline', declineInvitation);

export default router;
