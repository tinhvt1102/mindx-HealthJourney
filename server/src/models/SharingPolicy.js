import mongoose from 'mongoose';
import { HEALTH_METRIC_TYPES } from './HealthRecord.js';

/**
 * Mongoose Schema cho Chính sách chia sẻ dữ liệu sức khỏe (SharingPolicy)
 * Đáp ứng yêu cầu ticket Jira SCRUM-42 và Acceptance Criteria của SCRUM-41:
 * - AC1: Mặc định khi vào nhóm là Default Deny (allowedMetrics: [])
 * - AC2: Quản lý bật/tắt từng loại chỉ số độc lập cho từng cặp owner - viewer trong gia đình
 * - Unique compound index trên (ownerId, viewerId, familyId)
 */
const sharingPolicySchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID (người sở hữu dữ liệu) là bắt buộc'],
    },
    viewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Viewer ID (người được cấp quyền xem) là bắt buộc'],
    },
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Family',
      required: [true, 'Family ID (nhóm gia đình) là bắt buộc'],
    },
    allowedMetrics: {
      type: [
        {
          type: String,
          enum: {
            values: HEALTH_METRIC_TYPES,
            message: 'Loại chỉ số không hợp lệ trong danh sách cho phép',
          },
        },
      ],
      // AC1: Mặc định Default Deny (mảng rỗng, không cho phép xem chỉ số nào)
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: Mỗi cặp owner - viewer chỉ có duy nhất 1 policy trong 1 family (SCRUM-42)
sharingPolicySchema.index(
  { ownerId: 1, viewerId: 1, familyId: 1 },
  { unique: true }
);

// Index hỗ trợ query lấy toàn bộ policies của owner trong một nhóm gia đình
sharingPolicySchema.index({ familyId: 1, ownerId: 1 });

export const SharingPolicy = mongoose.model('SharingPolicy', sharingPolicySchema);
