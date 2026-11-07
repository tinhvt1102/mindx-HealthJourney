import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const doctorShareLinkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID là bắt buộc'],
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    pinHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    allowedMetrics: {
      type: [String],
      default: ['BLOOD_PRESSURE', 'HEART_RATE', 'BLOOD_SUGAR', 'WEIGHT', 'TEMPERATURE', 'SPO2'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    lastViewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

doctorShareLinkSchema.methods.comparePin = async function (candidatePin) {
  return bcrypt.compare(candidatePin, this.pinHash);
};

export const DoctorShareLink = mongoose.model('DoctorShareLink', doctorShareLinkSchema);
