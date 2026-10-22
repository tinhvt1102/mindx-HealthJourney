import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { validateInviteMember } from '../middlewares/invitationValidation.middleware.js';
import { inviteMember } from '../controllers/invitation.controller.js';
import {
  createFamily,
  getFamilyById,
  getMyFamilies,
} from '../controllers/family.controller.js';
import {
  getFamilySharingPolicies,
  updateFamilySharingPolicies,
} from '../controllers/policy.controller.js';
import { validateUpdatePolicy } from '../middlewares/policyValidation.middleware.js';

const router = express.Router();

// Yêu cầu đăng nhập cho toàn bộ routes family
router.use(protect);

router.route('/')
  .post(createFamily)
  .get(getMyFamilies);

router.route('/:id')
  .get(getFamilyById);

// Endpoint gửi lời mời theo ticket SCRUM-38
router.post('/:id/invite', validateInviteMember, inviteMember);

// Endpoint lấy và cập nhật chính sách chia sẻ dữ liệu sức khỏe (Jira SCRUM-43)
router.route('/:familyId/policies')
  .get(getFamilySharingPolicies)
  .put(validateUpdatePolicy, updateFamilySharingPolicies);

export default router;
