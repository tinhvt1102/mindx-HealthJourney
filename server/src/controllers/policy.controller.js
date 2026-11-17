import mongoose from 'mongoose';
import { Family } from '../models/Family.js';
import { SharingPolicy } from '../models/SharingPolicy.js';
import { User } from '../models/User.js';

/**
 * Helper: Xác định ownerId thực tế của chính sách chia sẻ (chính user hiện tại hoặc hồ sơ phụ thuộc do user quản lý)
 */
const resolvePolicyOwnerId = async (requestedOwnerId, currentUserId, family) => {
  if (!requestedOwnerId || requestedOwnerId.toString() === currentUserId.toString()) {
    return { ownerId: currentUserId };
  }

  if (!mongoose.Types.ObjectId.isValid(requestedOwnerId)) {
    return { errorStatus: 400, errorMessage: 'ownerId không hợp lệ' };
  }

  const targetOwnerId = requestedOwnerId.toString();
  const isOwnerMember = family.members.some(
    (m) => m.userId?._id?.toString() === targetOwnerId || m.userId?.toString() === targetOwnerId
  );
  if (!isOwnerMember) {
    return { errorStatus: 404, errorMessage: 'Hồ sơ mục tiêu không thuộc nhóm gia đình này' };
  }

  const ownerDoc = await User.findById(targetOwnerId).select('isDependent managedBy');
  if (!ownerDoc || !ownerDoc.isDependent || ownerDoc.managedBy?.toString() !== currentUserId.toString()) {
    return {
      errorStatus: 403,
      errorMessage: 'Bạn chỉ được phép cấu hình quyền riêng tư cho hồ sơ của bản thân hoặc hồ sơ phụ thuộc do bạn quản lý',
    };
  }

  return { ownerId: targetOwnerId };
};

/**
 * @desc    Lấy chính sách chia sẻ dữ liệu sức khỏe đối với các thành viên khác trong nhóm
 *          Áp dụng tiêu chí AC1 Jira SCRUM-41: Default Deny (mặc định mảng allowedMetrics: [])
 * @route   GET /api/families/:familyId/policies, GET /api/v1/families/:familyId/policies
 * @access  Private (Yêu cầu đăng nhập & là thành viên trong nhóm)
 */
export const getFamilySharingPolicies = async (req, res) => {
  try {
    const familyId = req.params.familyId || req.params.id;
    const requestedOwnerId = req.query.ownerId;

    if (!mongoose.Types.ObjectId.isValid(familyId)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình không hợp lệ',
      });
    }

    const family = await Family.findById(familyId).populate(
      'members.userId',
      'name fullName email avatar avatarUrl isDependent managedBy relationship'
    );

    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    const currentUserId = req.user._id.toString();

    // 1. Kiểm tra quyền truy cập: Người gọi bắt buộc phải là thành viên của nhóm
    const isMember = family.members.some(
      (m) =>
        m.userId?._id?.toString() === currentUserId ||
        m.userId?.toString() === currentUserId
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem chính sách chia sẻ trong nhóm gia đình này',
      });
    }

    const resolved = await resolvePolicyOwnerId(requestedOwnerId, currentUserId, family);
    if (resolved.errorStatus) {
      return res.status(resolved.errorStatus).json({
        success: false,
        message: resolved.errorMessage,
      });
    }
    const targetOwnerId = resolved.ownerId.toString();

    // 2. Lấy toàn bộ các policies đã được lưu trong DB của owner mục tiêu trong nhóm này
    const existingPolicies = await SharingPolicy.find({
      ownerId: targetOwnerId,
      familyId: family._id,
    });

    const policyMap = new Map();
    existingPolicies.forEach((p) => {
      policyMap.set(p.viewerId.toString(), p.allowedMetrics);
    });

    // 3. Xây dựng ma trận quyền đối với các thành viên có tài khoản thật trong nhóm (ngoại trừ targetOwnerId và hồ sơ phụ thuộc)
    const policies = [];
    const managedDependents = [];

    for (const member of family.members) {
      const userObj = member.userId;
      if (!userObj) continue;

      const memberUserId = (userObj._id || userObj).toString();

      // Thu thập danh sách hồ sơ phụ thuộc do currentUser quản lý để hiển thị bộ chuyển đổi
      if (userObj.isDependent && userObj.managedBy?.toString() === currentUserId) {
        managedDependents.push({
          id: memberUserId,
          name: userObj.fullName || userObj.name || 'Hồ sơ phụ thuộc',
          relationship: userObj.relationship || 'Người thân',
        });
      }

      // Bỏ qua hồ sơ chủ sở hữu đang cấu hình và các hồ sơ phụ thuộc (không có tài khoản đăng nhập)
      if (memberUserId === targetOwnerId || userObj.isDependent) continue;

      const viewerName =
        userObj.name || userObj.fullName || userObj.email || 'Thành viên';
      const viewerEmail = userObj.email || '';
      const viewerAvatar = userObj.avatarUrl || userObj.avatar || '';

      // AC1: Mặc định là Default Deny (allowedMetrics: []) nếu chưa từng được cấu hình
      const allowedMetrics = policyMap.has(memberUserId)
        ? policyMap.get(memberUserId)
        : [];

      policies.push({
        viewerId: memberUserId,
        viewerName,
        viewerEmail,
        viewerAvatar,
        role: member.role || 'MEMBER',
        allowedMetrics,
      });
    }

    return res.status(200).json({
      success: true,
      familyId: family._id,
      familyName: family.name,
      ownerId: targetOwnerId,
      managedDependents,
      count: policies.length,
      policies,
    });
  } catch (error) {
    console.error('Lỗi khi lấy chính sách chia sẻ gia đình:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chính sách chia sẻ',
      error: error.message,
    });
  }
};

/**
 * @desc    Cập nhật chính sách chia sẻ dữ liệu sức khỏe (bật/tắt quyền xem chỉ số độc lập - AC2 SCRUM-41)
 *          Hỗ trợ cập nhật cho 1 viewer hoặc danh sách nhiều viewers cùng lúc (Batch Upsert)
 * @route   PUT /api/families/:familyId/policies, PUT /api/v1/families/:familyId/policies
 * @access  Private (Yêu cầu đăng nhập & là thành viên trong nhóm)
 */
export const updateFamilySharingPolicies = async (req, res) => {
  try {
    const familyId = req.params.familyId || req.params.id;
    const { viewerId, allowedMetrics, policies, ownerId: requestedOwnerId } = req.body;

    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    const currentUserId = req.user._id.toString();

    // 1. Kiểm tra người gọi có thuộc nhóm không
    const isMember = family.members.some(
      (m) =>
        m.userId?.toString() === currentUserId ||
        m.userId?._id?.toString() === currentUserId
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa chính sách chia sẻ trong nhóm gia đình này',
      });
    }

    const resolved = await resolvePolicyOwnerId(requestedOwnerId, currentUserId, family);
    if (resolved.errorStatus) {
      return res.status(resolved.errorStatus).json({
        success: false,
        message: resolved.errorMessage,
      });
    }
    const targetOwnerId = resolved.ownerId.toString();

    // Chuẩn bị danh sách các bản ghi cần cập nhật
    const updateList = [];

    if (Array.isArray(policies)) {
      updateList.push(...policies);
    } else {
      updateList.push({ viewerId, allowedMetrics });
    }

    // 2. Validate từng viewer trong danh sách
    for (const item of updateList) {
      const targetViewerId = item.viewerId.toString();

      // Không thể tự cấp quyền chia sẻ cho chính chủ sở hữu dữ liệu
      if (targetViewerId === targetOwnerId) {
        return res.status(400).json({
          success: false,
          message: 'Không thể thiết lập chính sách chia sẻ cho chính bản thân mình',
        });
      }

      // Viewer bắt buộc phải là thành viên trong nhóm gia đình
      const viewerIsMember = family.members.some(
        (m) =>
          m.userId?.toString() === targetViewerId ||
          m.userId?._id?.toString() === targetViewerId
      );

      if (!viewerIsMember) {
        return res.status(400).json({
          success: false,
          message: `Người dùng có ID ${targetViewerId} không phải là thành viên trong nhóm gia đình này`,
        });
      }
    }

    // 3. Thực hiện Upsert chính sách (Update hoặc Insert nếu chưa tồn tại)
    const updatedPolicies = [];

    for (const item of updateList) {
      const targetViewerId = item.viewerId;
      // Loại bỏ các metric trùng lặp nếu có
      const uniqueMetrics = Array.from(new Set(item.allowedMetrics || []));

      const savedPolicy = await SharingPolicy.findOneAndUpdate(
        {
          ownerId: targetOwnerId,
          viewerId: targetViewerId,
          familyId: family._id,
        },
        {
          allowedMetrics: uniqueMetrics,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      updatedPolicies.push({
        id: savedPolicy._id,
        viewerId: savedPolicy.viewerId,
        allowedMetrics: savedPolicy.allowedMetrics,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật chính sách chia sẻ dữ liệu thành công',
      familyId: family._id,
      ownerId: targetOwnerId,
      updatedCount: updatedPolicies.length,
      policies: updatedPolicies,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật chính sách chia sẻ gia đình:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật chính sách chia sẻ',
      error: error.message,
    });
  }
};
