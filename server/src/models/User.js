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
    passwordHash: {
      type: String,
      select: false,
    },
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
      uppercase: true,
      default: 'OTHER',
    },
    bloodType: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
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

userSchema.virtual('bmi').get(function () {
  if (this.heightCm && this.weightKg) {
    const heightInMeters = this.heightCm / 100;
    return Number((this.weightKg / (heightInMeters * heightInMeters)).toFixed(1));
  }
  return null;
});

userSchema.index({ email: 1 }, { unique: true });

userSchema.methods.comparePassword = async function (candidatePassword) {
  const hash = this.passwordHash || this.password;
  if (!hash) return false;
  return bcrypt.compare(candidatePassword, hash);
};

export const User = mongoose.model('User', userSchema);