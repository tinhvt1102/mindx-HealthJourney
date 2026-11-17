import mongoose from 'mongoose';

const habitItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    category: {
      type: String,
      enum: ['diet', 'workout', 'lifestyle'],
      required: true,
      default: 'diet',
    },
    title: { type: String, required: true, trim: true },
    detail: { type: String, trim: true, default: '' },
    // 0: Chủ nhật, 1: Thứ 2, ..., 6: Thứ 7. Nếu rỗng nghĩa là áp dụng tất cả các ngày
    targetDays: {
      type: [Number],
      default: [],
    },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const habitPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    weekStart: {
      type: String, // Định dạng chuẩn YYYY-MM-DD (ngày Thứ Hai đầu tuần)
      required: true,
      index: true,
    },
    items: [habitItemSchema],
    sourceHash: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

habitPlanSchema.index({ userId: 1, weekStart: -1 });

export const HabitPlan = mongoose.model('HabitPlan', habitPlanSchema);
