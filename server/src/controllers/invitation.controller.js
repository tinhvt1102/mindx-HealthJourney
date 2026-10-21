import crypto from 'crypto';
import mongoose from 'mongoose';
import { Family } from '../models/Family.js';
import { FamilyInvitation } from '../models/FamilyInvitation.js';
import { User } from '../models/User.js';

/**
 * @desc    Gửi lời mời tham gia nhóm gia đình qua email
 * @route   POST /api/families/:id/invite, POST /api/v1/families/:id/invite
 * @access  Private (Chỉ Family Admin)
 */
export const inviteMember = async (req, res) => {
  try {
    const { id: familyId } = req.params;
    const { email } = req.body;

    if (!mongoose.Types.ObjectId.isValid(familyId)) {
      return res.status(400).json({
        success: false,
        message: 'ID nhóm gia đình không hợp lệ',
      });
    }

    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm gia đình',
      });
    }

    // Kiểm tra quyền: Chỉ Family Admin mới có quyền gửi lời mời (AC1 Jira SCRUM-36)
    const currentUserId = req.user._id.toString();
    const isCreator = family.createdBy.toString() === currentUserId;
    const memberRecord = family.members.find(
      (m) => m.userId.toString() === currentUserId
    );
    const isAdmin = isCreator || (memberRecord && memberRecord.role === 'ADMIN');

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Family Admin mới có quyền gửi lời mời tham gia nhóm',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Không thể tự gửi lời mời cho chính mình
    if (normalizedEmail === req.user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể tự gửi lời mời tham gia nhóm cho chính mình',
      });
    }

    // Kiểm tra nếu người dùng sở hữu email đã là thành viên trong nhóm
    const invitedUser = await User.findOne({ email: normalizedEmail });
    if (invitedUser) {
      const alreadyMember = family.members.some(
        (m) => m.userId.toString() === invitedUser._id.toString()
      );
      if (alreadyMember) {
        return res.status(400).json({
          success: false,
          message: 'Người dùng này hiện đã là thành viên của nhóm gia đình',
        });
      }
    }

    // Vô hiệu hóa lời mời PENDING cũ nếu có để tạo lời mời mới
    await FamilyInvitation.updateMany(
      {
        familyId: family._id,
        invitedEmail: normalizedEmail,
        status: 'PENDING',
      },
      { status: 'DECLINED' }
    );

    // Sinh token ngẫu nhiên bảo mật (32 bytes hex)
    const token = crypto.randomBytes(32).toString('hex');

    // Hết hạn sau 48 giờ theo AC1 Jira SCRUM-36
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invitation = await FamilyInvitation.create({
      familyId: family._id,
      inviterId: req.user._id,
      invitedEmail: normalizedEmail,
      token,
      status: 'PENDING',
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      message: 'Gửi lời mời tham gia nhóm gia đình thành công',
      invitation: {
        id: invitation._id,
        familyId: family._id,
        familyName: family.name,
        inviterName: req.user.name || req.user.fullName || req.user.email,
        invitedEmail: invitation.invitedEmail,
        token: invitation.token,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        inviteUrl: `/invitations/${invitation.token}`,
      },
    });
  } catch (error) {
    console.error('Error inviting family member:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi lời mời tham gia nhóm',
      error: error.message,
    });
  }
};

/**
 * @desc    Chấp nhận lời mời tham gia nhóm gia đình (Accept)
 * @route   POST /api/invitations/:token/accept, POST /api/v1/invitations/:token/accept
 * @access  Private (Yêu cầu đăng nhập)
 */
export const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token lời mời là bắt buộc',
      });
    }

    const invitation = await FamilyInvitation.findOne({ token });
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Lời mời không tồn tại hoặc mã token không hợp lệ',
      });
    }

    // Kiểm tra trạng thái lời mời
    if (invitation.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Lời mời này đã được xử lý trước đó (Trạng thái: ${invitation.status})`,
      });
    }

    // Kiểm tra thời hạn 48 giờ
    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Lời mời đã hết hạn sau 48 giờ. Vui lòng yêu cầu Family Admin gửi lại lời mời mới',
      });
    }

    const family = await Family.findById(invitation.familyId);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: 'Nhóm gia đình liên quan không còn tồn tại',
      });
    }

    const currentUserId = req.user._id.toString();

    // Thêm người dùng vào danh sách members nếu chưa có
    const isAlreadyMember = family.members.some(
      (m) => m.userId.toString() === currentUserId
    );

    if (!isAlreadyMember) {
      family.members.push({
        userId: req.user._id,
        role: 'MEMBER',
        joinedAt: new Date(),
      });
      await family.save();
    }

    // Cập nhật trạng thái lời mời thành ACCEPTED theo AC2
    invitation.status = 'ACCEPTED';
    await invitation.save();

    return res.status(200).json({
      success: true,
      message: 'Bạn đã chấp nhận lời mời và gia nhập nhóm gia đình thành công!',
      family: {
        id: family._id,
        name: family.name,
        role: 'MEMBER',
        membersCount: family.members.length,
      },
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi chấp nhận lời mời',
      error: error.message,
    });
  }
};

/**
 * @desc    Từ chối lời mời tham gia nhóm gia đình (Decline)
 * @route   POST /api/invitations/:token/decline, POST /api/v1/invitations/:token/decline
 * @access  Private (Yêu cầu đăng nhập)
 */
export const declineInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token lời mời là bắt buộc',
      });
    }

    const invitation = await FamilyInvitation.findOne({ token });
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Lời mời không tồn tại hoặc mã token không hợp lệ',
      });
    }

    // Kiểm tra trạng thái
    if (invitation.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Lời mời này đã được xử lý trước đó (Trạng thái: ${invitation.status})`,
      });
    }

    // Kiểm tra thời hạn
    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Lời mời đã hết hạn',
      });
    }

    // Cập nhật trạng thái thành DECLINED theo AC2
    invitation.status = 'DECLINED';
    await invitation.save();

    return res.status(200).json({
      success: true,
      message: 'Bạn đã từ chối lời mời tham gia nhóm gia đình',
      status: 'DECLINED',
    });
  } catch (error) {
    console.error('Error declining invitation:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi từ chối lời mời',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy danh sách các lời mời đang chờ (PENDING) của người dùng hiện tại
 *          Phục vụ Banner / Modal thông báo lời mời cho Member (SCRUM-39)
 * @route   GET /api/invitations/pending, GET /api/v1/invitations/pending
 * @access  Private
 */
export const getMyPendingInvitations = async (req, res) => {
  try {
    const userEmail = req.user.email.toLowerCase();
    const invitations = await FamilyInvitation.find({
      invitedEmail: userEmail,
      status: 'PENDING',
      expiresAt: { $gt: new Date() },
    })
      .populate('familyId', 'name createdBy')
      .populate('inviterId', 'name fullName email avatar avatarUrl')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: invitations.length,
      invitations: invitations.map((inv) => ({
        id: inv._id,
        token: inv.token,
        familyId: inv.familyId?._id,
        familyName: inv.familyId?.name || 'Nhóm gia đình',
        inviterName:
          inv.inviterId?.name ||
          inv.inviterId?.fullName ||
          inv.inviterId?.email,
        inviterAvatar:
          inv.inviterId?.avatarUrl || inv.inviterId?.avatar || '',
        invitedEmail: inv.invitedEmail,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error getting my pending invitations:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách lời mời đang chờ',
      error: error.message,
    });
  }
};

/**
 * @desc    Xem thông tin chi tiết lời mời bằng token (Trước khi quyết định Accept/Decline)
 * @route   GET /api/invitations/:token, GET /api/v1/invitations/:token
 * @access  Private
 */
export const getInvitationDetails = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await FamilyInvitation.findOne({ token })
      .populate('familyId', 'name createdBy')
      .populate('inviterId', 'name fullName email avatar avatarUrl');

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Lời mời không tồn tại hoặc mã token không hợp lệ',
      });
    }

    const isExpired = new Date() > invitation.expiresAt;

    return res.status(200).json({
      success: true,
      invitation: {
        id: invitation._id,
        familyName: invitation.familyId?.name || 'Nhóm gia đình',
        inviterName:
          invitation.inviterId?.name ||
          invitation.inviterId?.fullName ||
          invitation.inviterId?.email,
        inviterAvatar:
          invitation.inviterId?.avatarUrl || invitation.inviterId?.avatar || '',
        invitedEmail: invitation.invitedEmail,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        isExpired,
      },
    });
  } catch (error) {
    console.error('Error fetching invitation details:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết lời mời',
      error: error.message,
    });
  }
};
