import mongoose from 'mongoose';
import { HEALTH_METRIC_TYPES } from '../models/HealthRecord.js';

/**
 * Middleware kiểm tra tính hợp lệ của dữ liệu khi cập nhật chính sách chia sẻ (PUT /api/families/:familyId/policies)
 */
export const validateUpdatePolicy = (req, res, next) => {
  const familyId = req.params.familyId || req.params.id;
  const { viewerId, allowedMetrics, policies } = req.body;

  // 1. Kiểm tra format ObjectId của familyId
  if (!mongoose.Types.ObjectId.isValid(familyId)) {
    return res.status(400).json({
      success: false,
      message: 'ID nhóm gia đình không hợp lệ',
    });
  }

  // 2. Hỗ trợ cả 2 định dạng: cập nhật 1 policy hoặc mảng policies
  if (Array.isArray(policies)) {
    if (policies.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Danh sách chính sách (policies) không được để trống',
      });
    }

    for (let i = 0; i < policies.length; i++) {
      const item = policies[i];
      if (!item.viewerId || !mongoose.Types.ObjectId.isValid(item.viewerId)) {
        return res.status(400).json({
          success: false,
          message: `Viewer ID ở vị trí ${i} không hợp lệ`,
        });
      }

      if (!Array.isArray(item.allowedMetrics)) {
        return res.status(400).json({
          success: false,
          message: `allowedMetrics ở vị trí ${i} phải là một mảng`,
        });
      }

      // Kiểm tra từng loại metric
      for (const metric of item.allowedMetrics) {
        if (!HEALTH_METRIC_TYPES.includes(metric)) {
          return res.status(400).json({
            success: false,
            message: `Chỉ số '${metric}' không hợp lệ. Chỉ chấp nhận: ${HEALTH_METRIC_TYPES.join(', ')}`,
          });
        }
      }
    }
  } else {
    // Định dạng cập nhật cho 1 viewer
    if (!viewerId || !mongoose.Types.ObjectId.isValid(viewerId)) {
      return res.status(400).json({
        success: false,
        message: 'Viewer ID là bắt buộc và phải là ObjectId hợp lệ',
      });
    }

    if (!Array.isArray(allowedMetrics)) {
      return res.status(400).json({
        success: false,
        message: 'allowedMetrics phải là một mảng các chỉ số sức khỏe',
      });
    }

    for (const metric of allowedMetrics) {
      if (!HEALTH_METRIC_TYPES.includes(metric)) {
        return res.status(400).json({
          success: false,
          message: `Chỉ số '${metric}' không hợp lệ. Chỉ chấp nhận: ${HEALTH_METRIC_TYPES.join(', ')}`,
        });
      }
    }
  }

  next();
};
