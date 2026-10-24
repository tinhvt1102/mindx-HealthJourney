import mongoose from 'mongoose';
import { Family } from '../models/Family.js';
import { SharingPolicy } from '../models/SharingPolicy.js';

/**
 * @desc    Lấy chính sách chia sẻ dữ liệu sức khỏe của người dùng hiện tại đối với các thành viên khác trong nhóm
 *          Áp dụng tiêu chí AC1 Jira SCRUM-41: Default Deny (mặc định mảng allowedMetrics: [])
 * @route   GET /api/families/:familyId/policies, GET /api/v1/families/:familyId/policies
 * @access  Private (Yêu cầu đăng nhập & là thành viên trong nhóm)
 */
export const getFamilySharingPolicies = async (req, res) => {
  try {
    const familyId = req.params.familyId || req.params.id;

    if (!mongoose.Types.ObjectId.isValid(familyId)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình không hợp lệ',
      });
    }

    const family = await Family.findById(familyId).populate(
      'members.userId',
      'name fullName email avatar avatarUrl'
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

    // 2. Lấy toàn bộ các policies đã được lưu trong DB của owner trong nhóm này
    const existingPolicies = await SharingPolicy.find({
      ownerId: req.user._id,
      familyId: family._id,
    });

    const policyMap = new Map();
    existingPolicies.forEach((p) => {
      policyMap.set(p.viewerId.toString(), p.allowedMetrics);
    });

    // 3. Xây dựng ma trận quyền đối với TẤT CẢ các thành viên khác trong nhóm (ngoại trừ chính mình)
    const policies = [];

    for (const member of family.members) {
      const userObj = member.userId;
      if (!userObj) continue;

      const memberUserId = (userObj._id || userObj).toString();

      // Bỏ qua chính bản thân owner
      if (memberUserId === currentUserId) continue;

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
    const { viewerId, allowedMetrics, policies } = req.body;

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

      // Không thể tự cấp quyền chia sẻ cho chính mình
      if (targetViewerId === currentUserId) {
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
          ownerId: req.user._id,
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
