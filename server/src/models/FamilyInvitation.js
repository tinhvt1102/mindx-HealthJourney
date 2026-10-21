import mongoose from 'mongoose';

// Schema Lời mời gia đình (Jira SCRUM-37: familyId, inviterId, invitedEmail, token, status, expiresAt)
const familyInvitationSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Family',
      required: [true, 'Family ID là bắt buộc'],
      index: true,
    },
    inviterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Inviter ID là bắt buộc'],
    },
    invitedEmail: {
      type: String,
      required: [true, 'Email người nhận lời mời là bắt buộc'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
      index: true,
    },
    token: {
      type: String,
      required: [true, 'Token lời mời là bắt buộc'],
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'ACCEPTED', 'DECLINED'],
        message: 'Trạng thái chỉ có thể là PENDING, ACCEPTED hoặc DECLINED',
      },
      default: 'PENDING',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Thời hạn lời mời là bắt buộc'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// TTL Index: Tự động xóa các bản ghi lời mời đã hết hạn sau 7 ngày lưu trữ
familyInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const FamilyInvitation = mongoose.model('FamilyInvitation', familyInvitationSchema);
