import mongoose from 'mongoose';
import { Family } from '../models/Family.js';
import { SharingPolicy } from '../models/SharingPolicy.js';
import { FamilyInvitation } from '../models/FamilyInvitation.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { HEALTH_METRIC_TYPES } from '../models/HealthRecord.js';

/**
 * @desc    Tạo nhóm gia đình mới (Jira SCRUM-32 / SCRUM-34: Người tạo nhóm tự động là Family Admin)
 * @route   POST /api/families, POST /api/v1/families
 * @access  Private
 */
export const createFamily = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Tên nhóm gia đình phải từ 3 đến 50 ký tự',
      });
    }

    const family = new Family({
      name: name.trim(),
      description: description ? description.trim() : '',
      createdBy: req.user._id,
      members: [
        {
          userId: req.user._id,
          role: 'ADMIN',
          joinedAt: new Date(),
        },
      ],
    });

    await family.save();

    return res.status(201).json({
      success: true,
      message: 'Tạo nhóm gia đình thành công',
      family,
    });
  } catch (error) {
    console.error('Error creating family:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo nhóm gia đình',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy chi tiết nhóm gia đình
 * @route   GET /api/families/:id, GET /api/v1/families/:id
 * @access  Private
 */
export const getFamilyById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình không hợp lệ',
      });
    }

    const family = await Family.findById(id)
      .populate('createdBy', 'name fullName email avatar avatarUrl')
      .populate('members.userId', 'name fullName email avatar avatarUrl isDependent managedBy relationship heightCm weightKg gender birthDate');

    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    // Kiểm tra quyền xem: phải là thành viên trong nhóm
    const currentUserId = req.user._id.toString();
    const isMember = family.members.some(
      (m) => m.userId?._id?.toString() === currentUserId || m.userId?.toString() === currentUserId
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là thành viên của nhóm gia đình này',
      });
    }

    return res.status(200).json({
      success: true,
      family,
    });
  } catch (error) {
    console.error('Error getting family by id:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết nhóm gia đình',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy danh sách các nhóm gia đình mà user tham gia
 * @route   GET /api/families, GET /api/v1/families
 * @access  Private
 */
export const getMyFamilies = async (req, res) => {
  try {
    const families = await Family.find({
      'members.userId': req.user._id,
    }).populate('createdBy', 'name fullName email');

    return res.status(200).json({
      success: true,
      count: families.length,
      families,
    });
  } catch (error) {
    console.error('Error getting my families:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách nhóm gia đình',
      error: error.message,
    });
  }
};

/**
 * @desc    Cập nhật thông tin nhóm gia đình (Jira SCRUM-34: Chỉ Admin nhóm)
 * @route   PUT /api/families/:id, PUT /api/v1/families/:id
 * @access  Private (Family Admin)
 */
export const updateFamily = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình không hợp lệ',
      });
    }

    const family = await Family.findById(id);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    const currentUserId = req.user._id.toString();
    const isAdmin = family.members.some(
      (m) =>
        (m.userId?.toString() === currentUserId || m.userId?._id?.toString() === currentUserId) &&
        m.role === 'ADMIN'
    );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Quản trị viên (Admin) của nhóm mới có quyền chỉnh sửa thông tin',
      });
    }

    if (name) {
      if (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Tên nhóm gia đình phải từ 3 đến 50 ký tự',
        });
      }
      family.name = name.trim();
    }

    if (description !== undefined) {
      family.description = typeof description === 'string' ? description.trim() : '';
    }

    await family.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin nhóm gia đình thành công',
      family,
    });
  } catch (error) {
    console.error('Error updating family:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật thông tin nhóm gia đình',
      error: error.message,
    });
  }
};

/**
 * @desc    Xóa nhóm gia đình (Jira SCRUM-34: Chỉ Creator hoặc Admin)
 * @route   DELETE /api/families/:id, DELETE /api/v1/families/:id
 * @access  Private (Family Admin / Creator)
 */
export const deleteFamily = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình không hợp lệ',
      });
    }

    const family = await Family.findById(id);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    const currentUserId = req.user._id.toString();
    const isCreator = family.createdBy?.toString() === currentUserId;
    const isAdmin = family.members.some(
      (m) =>
        (m.userId?.toString() === currentUserId || m.userId?._id?.toString() === currentUserId) &&
        m.role === 'ADMIN'
    );

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Quản trị viên của nhóm mới có quyền giải tán nhóm gia đình',
      });
    }

    // Xóa cascade các chính sách chia sẻ và lời mời liên quan
    await SharingPolicy.deleteMany({ familyId: id });
    await FamilyInvitation.deleteMany({ familyId: id });
    await Family.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Đã giải tán nhóm gia đình thành công',
    });
  } catch (error) {
    console.error('Error deleting family:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa nhóm gia đình',
      error: error.message,
    });
  }
};

/**
 * @desc    Xóa thành viên khỏi nhóm gia đình (Jira SCRUM-34)
 * @route   DELETE /api/families/:id/members/:memberId
 * @access  Private (Admin hoặc chính thành viên tự rời nhóm)
 */
export const removeMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm hoặc ID thành viên không hợp lệ',
      });
    }

    const family = await Family.findById(id);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    const currentUserId = req.user._id.toString();
    const isTargetSelf = currentUserId === memberId;
    const isAdmin = family.members.some(
      (m) =>
        (m.userId?.toString() === currentUserId || m.userId?._id?.toString() === currentUserId) &&
        m.role === 'ADMIN'
    );

    const targetUserDoc = await User.findById(memberId).select('isDependent managedBy');
    const isCaregiver =
      targetUserDoc?.isDependent && targetUserDoc?.managedBy?.toString() === currentUserId;

    if (!isAdmin && !isTargetSelf && !isCaregiver) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa thành viên này khỏi nhóm',
      });
    }

    const memberExists = family.members.some(
      (m) => m.userId?.toString() === memberId || m.userId?._id?.toString() === memberId
    );

    if (!memberExists) {
      return res.status(404).json({
        success: false,
        message: 'Thành viên này không tồn tại trong nhóm gia đình',
      });
    }

    // Không cho phép xóa creator trừ khi giải tán cả nhóm
    if (family.createdBy?.toString() === memberId && isTargetSelf) {
      const otherAdmins = family.members.filter(
        (m) =>
          (m.userId?.toString() !== memberId && m.userId?._id?.toString() !== memberId) &&
          m.role === 'ADMIN'
      );
      if (otherAdmins.length === 0 && family.members.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Bạn là người tạo nhóm duy nhất. Vui lòng chuyển giao quyền Admin trước hoặc giải tán nhóm.',
        });
      }
    }

    // Cập nhật danh sách members
    family.members = family.members.filter(
      (m) => m.userId?.toString() !== memberId && m.userId?._id?.toString() !== memberId
    );

    await family.save();

    // Dọn dẹp policies liên quan đến member này trong nhóm
    await SharingPolicy.deleteMany({
      familyId: id,
      $or: [{ ownerId: memberId }, { viewerId: memberId }],
    });

    return res.status(200).json({
      success: true,
      message: isTargetSelf
        ? 'Bạn đã rời khỏi nhóm gia đình thành công'
        : 'Đã xóa thành viên khỏi nhóm gia đình',
      family,
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa thành viên',
      error: error.message,
    });
  }
};


/**
 * @desc    Tạo hồ sơ phụ thuộc (Ông bà, trẻ nhỏ chưa có smartphone/email) vào nhóm gia đình
 * @route   POST /api/families/:id/dependents, POST /api/v1/families/:id/dependents
 * @access  Private (Thành viên trong nhóm gia đình)
 */
export const createDependentProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, relationship, birthDate, gender, heightCm, weightKg } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình không hợp lệ',
      });
    }

    if (req.user?.isDependent) {
      return res.status(403).json({
        success: false,
        message: 'Hồ sơ phụ thuộc không có quyền tạo thêm hồ sơ khác',
      });
    }

    const family = await Family.findById(id);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    const currentUserId = req.user._id.toString();
    const isMember = family.members.some(
      (m) => m.userId?.toString() === currentUserId || m.userId?._id?.toString() === currentUserId
    );
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn phải là thành viên của nhóm gia đình mới có thể thêm hồ sơ phụ thuộc',
      });
    }

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 60) {
      return res.status(400).json({
        success: false,
        message: 'Họ tên người phụ thuộc phải từ 2 đến 60 ký tự',
      });
    }

    const parsedHeight = heightCm !== undefined && heightCm !== '' ? Number(heightCm) : 165;
    if (isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 250) {
      return res.status(400).json({
        success: false,
        message: 'Chiều cao hợp lệ từ 50 đến 250 cm',
      });
    }

    let parsedWeight;
    if (weightKg !== undefined && weightKg !== '') {
      parsedWeight = Number(weightKg);
      if (isNaN(parsedWeight) || parsedWeight < 10 || parsedWeight > 300) {
        return res.status(400).json({
          success: false,
          message: 'Cân nặng hợp lệ từ 10 đến 300 kg',
        });
      }
    }

    const normalizedGender = ['MALE', 'FEMALE', 'OTHER'].includes((gender || '').toUpperCase())
      ? gender.toUpperCase()
      : 'OTHER';

    const syntheticEmail = `dep.${new mongoose.Types.ObjectId().toString()}@family.local`;

    const dependentUser = await User.create({
      email: syntheticEmail,
      fullName: fullName.trim(),
      name: fullName.trim(),
      isVerified: true,
      isDependent: true,
      managedBy: req.user._id,
      relationship: (relationship || 'Người thân').trim().slice(0, 40),
      birthDate: birthDate ? new Date(birthDate) : undefined,
      gender: normalizedGender,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
    });

    family.members.push({
      userId: dependentUser._id,
      role: 'DEPENDENT',
      joinedAt: new Date(),
    });
    await family.save();

    // Cấp quyền xem toàn bộ chỉ số của hồ sơ phụ thuộc cho chính Người chăm sóc tạo hồ sơ
    // (Các thành viên khác trong nhóm vẫn mặc định tuân thủ Default Deny cho tới khi được cấp)
    await SharingPolicy.findOneAndUpdate(
      {
        familyId: family._id,
        ownerId: dependentUser._id,
        viewerId: req.user._id,
      },
      { allowedMetrics: HEALTH_METRIC_TYPES },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      success: true,
      message: `Đã tạo hồ sơ phụ thuộc "${dependentUser.fullName}" thành công`,
      dependent: dependentUser,
      family,
    });
  } catch (error) {
    console.error('Error creating dependent profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo hồ sơ phụ thuộc',
      error: error.message,
    });
  }
};

/**
 * @desc    Gửi lời nhắc yêu thương (Care Nudge) cho người thân đo chỉ số hoặc uống thuốc
 * @route   POST /api/families/:familyId/members/:memberId/nudge
 * @access  Private (Thành viên trong nhóm gia đình)
 */
export const nudgeFamilyMember = async (req, res) => {
  try {
    const familyId = req.params.familyId || req.params.id;
    const { memberId } = req.params;
    const { category = 'MEASUREMENT', message } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(familyId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình hoặc ID thành viên không hợp lệ',
      });
    }

    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    const callerId = req.user._id.toString();
    const targetId = memberId.toString();

    const isCallerMember = family.members.some(
      (m) => m.userId?.toString() === callerId || m.userId?._id?.toString() === callerId
    );
    if (!isCallerMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là thành viên của nhóm gia đình này',
      });
    }

    const isTargetMember = family.members.some(
      (m) => m.userId?.toString() === targetId || m.userId?._id?.toString() === targetId
    );
    if (!isTargetMember) {
      return res.status(404).json({
        success: false,
        message: 'Thành viên mục tiêu không thuộc nhóm gia đình này',
      });
    }

    if (callerId === targetId) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tự gửi lời nhắc cho chính bản thân mình',
      });
    }

    const targetUser = await User.findById(targetId).select('name fullName email isDependent');
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    if (targetUser.isDependent) {
      return res.status(400).json({
        success: false,
        message: 'Hồ sơ phụ thuộc không có tài khoản riêng để nhận thông báo trực tiếp',
      });
    }

    const senderName = req.user.fullName || req.user.name || req.user.email || 'Người thân';
    const actionMap = {
      MEASUREMENT: 'đo chỉ số sức khỏe hôm nay',
      MEDICATION: 'uống thuốc đúng giờ hôm nay',
      CUSTOM: 'chăm sóc sức khỏe hôm nay',
    };
    const safeCategory = actionMap[category] ? category : 'MEASUREMENT';
    const actionText = actionMap[safeCategory];

    const customMsg = typeof message === 'string' && message.trim() ? message.trim().slice(0, 300) : '';
    const finalMessage =
      customMsg ||
      `${senderName} từ nhóm "${family.name}" gửi lời nhắc yêu thương: Đừng quên ${actionText} nhé!`;

    const notification = await Notification.create({
      recipientId: targetUser._id,
      senderId: req.user._id,
      type: 'CARE_NUDGE',
      title: `💚 ${senderName} nhắc bạn ${actionText}`,
      message: finalMessage,
      data: {
        familyId: family._id,
        familyName: family.name,
        category: safeCategory,
        senderName,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Đã gửi lời nhắc tới ${targetUser.fullName || targetUser.name || targetUser.email}`,
      notification,
    });
  } catch (error) {
    console.error('Error nudging family member:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi lời nhắc cho thành viên',
      error: error.message,
    });
  }
};
