import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID là bắt buộc'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Tiêu đề lịch nhắc là bắt buộc'],
      trim: true,
      maxlength: [100, 'Tiêu đề tối đa 100 ký tự'],
    },
    type: {
      type: String,
      enum: ['MEDICATION', 'MEASUREMENT'],
      required: [true, 'Loại lịch nhắc là bắt buộc'],
      default: 'MEDICATION',
    },
    metricType: {
      type: String,
      default: null,
    },
    time: {
      type: String,
      required: [true, 'Giờ nhắc là bắt buộc (ví dụ: 08:00)'],
      trim: true,
    },
    frequency: {
      type: String,
      enum: ['DAILY', 'WEEKDAYS', 'WEEKENDS', 'CUSTOM'],
      default: 'DAILY',
    },
    daysOfWeek: {
      type: [Number],
      default: [0, 1, 2, 3, 4, 5, 6], // 0: Chủ nhật, 1: Thứ 2, ... 6: Thứ 7
    },
    dosage: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    completedDates: {
      type: [String], // Danh sách ngày hoàn thành định dạng 'YYYY-MM-DD'
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reminderSchema.index({ userId: 1, isActive: 1 });

export const Reminder = mongoose.model('Reminder', reminderSchema);
