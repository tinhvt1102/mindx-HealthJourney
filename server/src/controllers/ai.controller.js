import mongoose from 'mongoose';
import { HealthRecord, HEALTH_METRIC_TYPES } from '../models/HealthRecord.js';
import { Family } from '../models/Family.js';
import { SharingPolicy } from '../models/SharingPolicy.js';
import { AISummaryCache } from '../models/AISummaryCache.js';
import { User } from '../models/User.js';
import { generateHealthSummary, computeMetricsHash } from '../services/ai.service.js';

/**
 * Lấy ngày hôm nay theo UTC, định dạng YYYY-MM-DD
 * @returns {string}
 */
const getTodayUTC = () => new Date().toISOString().slice(0, 10);

/**
 * @desc    Tóm tắt xu hướng sức khỏe sử dụng Gemini AI (SCRUM-55/56)
 * @route   POST /api/ai/summarize-trends
 * @access  Private (yêu cầu đăng nhập)
 *
 * Body: { targetUserId?: string, familyId?: string }
 *
 * Logic:
 * 1. Nếu không truyền targetUserId -> mặc định phân tích cho chính req.user
 * 2. Nếu targetUserId != req.user._id -> phải cung cấp familyId và kiểm tra SharingPolicy
 * 3. Kiểm tra tối thiểu 3 bản ghi (AC4)
 * 4. Kiểm tra cache trong DB trước khi gọi Gemini API
 * 5. Gọi AI Service -> lưu cache -> trả về kết quả
 */
export const summarizeTrends = async (req, res) => {
  try {
    const requesterId = req.user._id.toString();
    const { targetUserId: rawTargetId, familyId: rawFamilyId } = req.body;

    // ================================================================
    // 1. Xác định targetUserId (mặc định là chính req.user)
    // ================================================================
    const targetUserId = rawTargetId ? rawTargetId.toString() : requesterId;
    const isSelfView = targetUserId === requesterId;

    // Kiểm tra định dạng ObjectId của targetUserId
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'targetUserId không hợp lệ',
      });
    }

    // ================================================================
    // 2. Kiểm tra quyền truy cập dữ liệu người thân
    // ================================================================
    let allowedMetrics = HEALTH_METRIC_TYPES; // self-view: xem tất cả

    if (!isSelfView) {
      // Phải cung cấp familyId khi xem dữ liệu người khác
      if (!rawFamilyId || !mongoose.Types.ObjectId.isValid(rawFamilyId)) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp familyId hợp lệ khi yêu cầu phân tích dữ liệu người thân',
        });
      }

      const familyId = rawFamilyId.toString();

      // Tìm nhóm gia đình
      const family = await Family.findById(familyId);
      if (!family) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy nhóm gia đình',
        });
      }

      // Kiểm tra caller có trong nhóm không
      const isCallerMember = family.members.some(
        (m) => m.userId?.toString() === requesterId || m.userId?._id?.toString() === requesterId
      );
      if (!isCallerMember) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không phải là thành viên của nhóm gia đình này',
        });
      }

      // Kiểm tra targetUser có trong nhóm không
      const isTargetMember = family.members.some(
        (m) => m.userId?.toString() === targetUserId || m.userId?._id?.toString() === targetUserId
      );
      if (!isTargetMember) {
        return res.status(403).json({
          success: false,
          message: 'Thành viên mục tiêu không thuộc nhóm gia đình này',
        });
      }

      // Tra cứu SharingPolicy (AC2 Enforce: Admin cũng không bypass)
      const policy = await SharingPolicy.findOne({
        ownerId: targetUserId,
        viewerId: requesterId,
        familyId: familyId,
      });

      allowedMetrics = policy && Array.isArray(policy.allowedMetrics) && policy.allowedMetrics.length > 0
        ? policy.allowedMetrics
        : [];

      // Nếu chưa được cấp quyền xem bất kỳ chỉ số nào
      if (allowedMetrics.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chưa được cấp quyền xem bất kỳ chỉ số sức khỏe nào của thành viên này để có thể phân tích xu hướng',
        });
      }
    }

    // ================================================================
    // 3. Lấy dữ liệu sức khỏe (lọc theo allowedMetrics)
    // ================================================================
    const records = await HealthRecord.find({
      userId: targetUserId,
      type: { $in: allowedMetrics },
    }).sort({ recordedAt: 1 });

    // AC4: Tối thiểu 3 bản ghi
    if (records.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Cần tối thiểu 3 bản ghi chỉ số sức khỏe để AI có thể phân tích xu hướng.',
        currentCount: records.length,
      });
    }

    // ================================================================
    // 4. Kiểm tra cache trong DB (cache theo ngày UTC)
    // ================================================================
    const cacheDate = getTodayUTC();
    const metricsHash = computeMetricsHash(allowedMetrics);

    const existingCache = await AISummaryCache.findOne({
      targetUserId: new mongoose.Types.ObjectId(targetUserId),
      requesterId: new mongoose.Types.ObjectId(requesterId),
      cacheDate,
    });

    if (existingCache) {
      return res.status(200).json({
        success: true,
        fromCache: true,
        cacheDate: existingCache.cacheDate,
        isFallback: existingCache.isFallback,
        recordCount: existingCache.recordCount,
        allowedMetrics,
        isSelfView,
        summary: existingCache.summary,
      });
    }

    // ================================================================
    // 5. Lấy thông tin người sở hữu dữ liệu
    // ================================================================
    const ownerUser = isSelfView
      ? req.user
      : await User.findById(targetUserId).select('name fullName');

    if (!ownerUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng mục tiêu',
      });
    }

    // ================================================================
    // 6. Gọi AI Service để tạo tóm tắt (có timeout & fallback)
    // ================================================================
    const { summary, isFallback } = await generateHealthSummary(records, ownerUser, isSelfView);

    // ================================================================
    // 7. Lưu kết quả vào Cache DB
    // ================================================================
    try {
      await AISummaryCache.create({
        targetUserId: new mongoose.Types.ObjectId(targetUserId),
        requesterId: new mongoose.Types.ObjectId(requesterId),
        cacheDate,
        metricsHash,
        summary,
        recordCount: records.length,
        isFallback,
        createdAt: new Date(),
      });
    } catch (cacheErr) {
      // Không thể lưu cache (ví dụ: duplicate key do race condition) -> tiếp tục trả về kết quả
      console.warn('[AI Controller] Không thể lưu cache AI Summary:', cacheErr.message);
    }

    // ================================================================
    // 8. Trả về kết quả
    // ================================================================
    return res.status(200).json({
      success: true,
      fromCache: false,
      cacheDate,
      isFallback,
      recordCount: records.length,
      allowedMetrics,
      isSelfView,
      summary,
    });
  } catch (error) {
    console.error('[AI Controller] Lỗi khi tóm tắt xu hướng sức khỏe:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi phân tích xu hướng sức khỏe',
      error: error.message,
    });
  }
};
