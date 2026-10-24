import mongoose from 'mongoose';
import { Family } from '../models/Family.js';
import { SharingPolicy } from '../models/SharingPolicy.js';
import { HEALTH_METRIC_TYPES } from '../models/HealthRecord.js';

/**
 * Middleware kiểm soát quyền truy cập dữ liệu sức khỏe tại Backend Query Layer (SCRUM-46)
 * Đáp ứng các tiêu chí chấp nhận của Jira SCRUM-45:
 * - AC1: Viewer request dữ liệu người thân -> Chỉ cho phép query các metric trong allowedMetrics của SharingPolicy.
 * - AC2: Family Admin cũng KHÔNG được bypass chính sách chia sẻ nếu không được Owner cấp quyền.
 * - Self-view: Người dùng xem chỉ số của chính mình được toàn quyền xem tất cả chỉ số.
 */
export const healthAccessControl = async (req, res, next) => {
  try {
    const familyId = req.params.familyId || req.params.id;
    const memberId = req.params.memberId;

    // 1. Kiểm tra định dạng ObjectId
    if (!mongoose.Types.ObjectId.isValid(familyId)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình không hợp lệ',
      });
    }

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'ID thành viên mục tiêu không hợp lệ',
      });
    }

    // 2. Tìm nhóm gia đình
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    const currentUserId = req.user._id.toString();
    const targetMemberId = memberId.toString();

    // 3. Xác thực cả caller (người yêu cầu) lẫn target (người sở hữu dữ liệu) đều là thành viên trong nhóm
    const isCallerMember = family.members.some(
      (m) =>
        m.userId?.toString() === currentUserId ||
        m.userId?._id?.toString() === currentUserId
    );

    if (!isCallerMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là thành viên của nhóm gia đình này',
      });
    }

    const isTargetMember = family.members.some(
      (m) =>
        m.userId?.toString() === targetMemberId ||
        m.userId?._id?.toString() === targetMemberId
    );

    if (!isTargetMember) {
      return res.status(403).json({
        success: false,
        message: 'Thành viên mục tiêu không thuộc nhóm gia đình này',
      });
    }

    // 4. Trường hợp Self-view: Tự xem chỉ số của chính mình -> Toàn quyền xem mọi chỉ số
    if (currentUserId === targetMemberId) {
      req.allowedMetrics = HEALTH_METRIC_TYPES;
      req.isSelfView = true;
      req.targetMemberId = targetMemberId;
      req.family = family;
      return next();
    }

    // 5. Trường hợp Outbound Privacy: Xem chỉ số của người thân
    // Truy vấn SharingPolicy (Owner: targetMemberId, Viewer: currentUserId)
    const policy = await SharingPolicy.findOne({
      ownerId: targetMemberId,
      viewerId: currentUserId,
      familyId: family._id,
    });

    // AC2 Enforce: Dù caller là Family Admin (role === 'ADMIN'), TUYỆT ĐỐI KHÔNG bypass!
    // AC1 Default Deny: Nếu chưa thiết lập policy hoặc allowedMetrics rỗng -> allowedMetrics là []
    req.allowedMetrics = policy && Array.isArray(policy.allowedMetrics)
      ? policy.allowedMetrics
      : [];

    req.isSelfView = false;
    req.targetMemberId = targetMemberId;
    req.family = family;

    next();
  } catch (error) {
    console.error('Lỗi tại middleware healthAccessControl:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi kiểm soát quyền truy cập sức khỏe',
      error: error.message,
    });
  }
};
