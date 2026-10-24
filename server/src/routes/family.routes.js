import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { validateInviteMember } from '../middlewares/invitationValidation.middleware.js';
import { inviteMember } from '../controllers/invitation.controller.js';
import {
  createFamily,
  getFamilyById,
  getMyFamilies,
  updateFamily,
  deleteFamily,
  removeMember,
} from '../controllers/family.controller.js';
import {
  getFamilySharingPolicies,
  updateFamilySharingPolicies,
} from '../controllers/policy.controller.js';
import { validateUpdatePolicy } from '../middlewares/policyValidation.middleware.js';
import { healthAccessControl } from '../middlewares/healthAccessControl.js';
import { getFamilyMemberHealthRecords } from '../controllers/healthRecord.controller.js';

const router = express.Router();

// Yêu cầu đăng nhập cho toàn bộ routes family
router.use(protect);

router.route('/')
  .post(createFamily)
  .get(getMyFamilies);

router.route('/:id')
  .get(getFamilyById)
  .put(updateFamily)
  .delete(deleteFamily);

// Xóa thành viên hoặc thành viên tự rời nhóm (SCRUM-34)
router.delete('/:id/members/:memberId', removeMember);

// Endpoint gửi lời mời theo ticket SCRUM-38
router.post('/:id/invite', validateInviteMember, inviteMember);

// Endpoint lấy và cập nhật chính sách chia sẻ dữ liệu sức khỏe (Jira SCRUM-43)
router.route('/:familyId/policies')
  .get(getFamilySharingPolicies)
  .put(validateUpdatePolicy, updateFamilySharingPolicies);

// Endpoint lấy dữ liệu sức khỏe của thành viên có kiểm soát quyền SharingPolicy (Jira SCRUM-46)
router.get(
  '/:familyId/members/:memberId/health-records',
  healthAccessControl,
  getFamilyMemberHealthRecords
);

export default router;