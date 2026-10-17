import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
    },
    // Lưu mật khẩu băm với tên trường passwordHash theo Jira
    passwordHash: {
      type: String,
      select: false, // Ẩn khi query thông thường
    },
    // Trường password dự phòng cho các tài khoản cũ
    password: {
      type: String,
      select: false,
    },
    name: {
      type: String,
      trim: true,
      maxlength: [60, 'Tên tối đa 60 ký tự'],
    },
    fullName: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
      maxlength: [250, 'Tiểu sử tối đa 250 ký tự'],
    },
    heightCm: {
      type: Number,
      default: 170,
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      uppercase: true,
      default: 'OTHER',
    },
    // Trạng thái xác thực email OTP
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Lưu mã OTP và thời gian hết hạn
    otp: {
      code: { type: String, select: false },
      expiresAt: { type: Date, select: false },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Tạo Index Unique cho email
userSchema.index({ email: 1 }, { unique: true });

// So khớp mật khẩu đăng nhập
userSchema.methods.comparePassword = async function (candidatePassword) {
  const hash = this.passwordHash || this.password;
  if (!hash) return false;
  return bcrypt.compare(candidatePassword, hash);
};

export const User = mongoose.model('User', userSchema);