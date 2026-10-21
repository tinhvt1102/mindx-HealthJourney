import mongoose from 'mongoose';

/**
 * Middleware validate đầu vào khi gửi lời mời tham gia nhóm gia đình
 */
export const validateInviteMember = (req, res, next) => {
  const { id } = req.params;
  const { email } = req.body;
  const errors = {};

  // 1. Kiểm tra ID gia đình
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    errors.familyId = 'ID nhóm gia đình không hợp lệ';
  }

  // 2. Kiểm tra email
  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.email = 'Email người nhận lời mời là bắt buộc';
  } else {
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      errors.email = 'Định dạng email không hợp lệ';
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu gửi lời mời không hợp lệ',
      errors,
    });
  }

  next();
};
