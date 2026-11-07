import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: '🏆' },
    unlockedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const streakSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastLoggedDate: {
      type: String, // YYYY-MM-DD
      default: null,
    },
    loggedDates: {
      type: [String], // Mảng lưu các ngày YYYY-MM-DD
      default: [],
    },
    badges: {
      type: [badgeSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Streak = mongoose.model('Streak', streakSchema);
