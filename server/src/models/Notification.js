import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID là bắt buộc'],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: ['CRITICAL_ALERT', 'REMINDER', 'INVITATION', 'SYSTEM'],
      default: 'CRITICAL_ALERT',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Tiêu đề thông báo là bắt buộc'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Nội dung thông báo là bắt buộc'],
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
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

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
