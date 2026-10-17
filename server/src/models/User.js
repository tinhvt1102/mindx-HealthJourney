import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Schema chuẩn 100% theo ticket Jira SCRUM-17:
// (email, passwordHash, name, avatar, bio, timestamps) kèm index unique email
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
    // Trường password dự phòng cho các tài khoản cũ đã tạo
    password: {
      type: String,
      select: false,
    },
    // Tên người dùng theo Jira (name)
    name: {
      type: String,
      trim: true,
      maxlength: [60, 'Tên tối đa 60 ký tự'],
    },
    // Dự phòng fullName nếu user cũ có
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
      min: [50, 'Chiều cao tối thiểu là 50cm'],
      max: [250, 'Chiều cao tối đa là 250cm'],
    },
    weightKg: {
      type: Number,
      min: [10, 'Cân nặng tối thiểu là 10kg'],
      max: [300, 'Cân nặng tối đa là 300kg'],
    },
    birthDate: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      default: 'OTHER',
    },
    bloodType: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
  },
  {
    timestamps: true, // Tự động tạo createdAt và updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual tính chỉ số thể trạng BMI tự động từ heightCm và weightKg
userSchema.virtual('bmi').get(function () {
  if (this.heightCm && this.weightKg) {
    const heightInMeters = this.heightCm / 100;
    return Number((this.weightKg / (heightInMeters * heightInMeters)).toFixed(1));
  }
  return null;
});


// So khớp mật khẩu đăng nhập (hỗ trợ cả passwordHash và password cũ)
userSchema.methods.comparePassword = async function (candidatePassword) {
  const hash = this.passwordHash || this.password;
  if (!hash) return false;
  return bcrypt.compare(candidatePassword, hash);
};

export const User = mongoose.model('User', userSchema);