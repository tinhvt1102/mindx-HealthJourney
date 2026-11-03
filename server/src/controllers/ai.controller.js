import mongoose from 'mongoose';
import { HealthRecord, HEALTH_METRIC_TYPES } from '../models/HealthRecord.js';
import { Family } from '../models/Family.js';
import { SharingPolicy } from '../models/SharingPolicy.js';
import { AISummaryCache } from '../models/AISummaryCache.js';
import { User } from '../models/User.js';
import { generateHealthSummary, computeMetricsHash, MANDATORY_DISCLAIMER } from '../services/ai.service.js';

/**
 * Lấy ngày hôm nay theo UTC, định dạng YYYY-MM-DD
 * @returns {string}
 */
const getTodayUTC = () => new Date().toISOString().slice(0, 10);

/**
 * @desc    Tóm tắt xu hướng sức khỏe sử dụng Gemini AI (SCRUM-54/55/56/57)
 * @route   POST /api/ai/summarize-trends
 * @access  Private (yêu cầu đăng nhập)
 *
 * Body: { targetUserId?: string, memberId?: string, familyId?: string, forceRefresh?: boolean }
 */
export const summarizeTrends = async (req, res) => {
  try {
    const requesterId = (req.user._id || req.user.id).toString();
    const { targetUserId: rawTargetId, memberId: rawMemberId, familyId: rawFamilyId, forceRefresh } = req.body;

    // 1. Xác định targetUserId (mặc định là chính req.user)
    const targetUserId = (rawTargetId || rawMemberId || requesterId).toString();
    const isSelfView = targetUserId === requesterId;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'targetUserId không hợp lệ',
      });
    }

    const targetUser = await User.findById(targetUserId).select('name fullName email heightCm');
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    // 2. Kiểm tra quyền truy cập dữ liệu người thân (SCRUM-49 / SCRUM-54 / Default Deny)
    let allowedMetrics = HEALTH_METRIC_TYPES;

    if (!isSelfView) {
      if (!rawFamilyId || !mongoose.Types.ObjectId.isValid(rawFamilyId)) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp familyId hợp lệ khi yêu cầu phân tích dữ liệu người thân',
        });
      }

      const familyId = rawFamilyId.toString();
      const family = await Family.findById(familyId);
      if (!family) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy nhóm gia đình',
        });
      }

      const isCallerMember = family.members.some(
        (m) => m.userId?.toString() === requesterId || m.userId?._id?.toString() === requesterId
      );
      if (!isCallerMember) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không phải là thành viên của nhóm gia đình này',
        });
      }

      const isTargetMember = family.members.some(
        (m) => m.userId?.toString() === targetUserId || m.userId?._id?.toString() === targetUserId
      );
      if (!isTargetMember) {
        return res.status(403).json({
          success: false,
          message: 'Thành viên mục tiêu không thuộc nhóm gia đình này',
        });
      }

      // Tra cứu SharingPolicy (Default Deny: Admin cũng không bypass nếu chưa cấp)
      const policy = await SharingPolicy.findOne({
        ownerId: targetUserId,
        viewerId: requesterId,
        familyId: familyId,
      });

      allowedMetrics = policy && Array.isArray(policy.allowedMetrics) && policy.allowedMetrics.length > 0
        ? policy.allowedMetrics
        : [];

      if (allowedMetrics.length === 0) {
        return res.status(403).json({
          success: false,
          code: 'ACCESS_DENIED',
          message: 'Chính sách bảo vệ quyền riêng tư (Default Deny): Bạn chưa được cấp quyền xem bất kỳ chỉ số sức khỏe nào của thành viên này để có thể phân tích xu hướng',
        });
      }
    }

    // 3. Lấy dữ liệu sức khỏe (lọc theo allowedMetrics)
    const records = await HealthRecord.find({
      userId: targetUserId,
      type: { $in: allowedMetrics },
    }).sort({ recordedAt: 1 });

    // AC4: Tối thiểu 3 bản ghi
    if (records.length < 3) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_DATA',
        message: `Cần tối thiểu 3 bản ghi chỉ số sức khỏe để AI có thể phân tích xu hướng (Hiện tại có ${records.length} bản ghi).`,
        recordCount: records.length,
        currentCount: records.length,
        minRequired: 3,
      });
    }

    // 4. Kiểm tra cache trong DB (cache theo ngày UTC - SCRUM-57)
    const cacheDate = getTodayUTC();
    const metricsHash = computeMetricsHash(allowedMetrics);

    if (!forceRefresh) {
      const existingCache = await AISummaryCache.findOne({
        targetUserId: new mongoose.Types.ObjectId(targetUserId),
        requesterId: new mongoose.Types.ObjectId(requesterId),
        cacheDate,
      });

      if (existingCache && existingCache.metricsHash === metricsHash) {
        return res.status(200).json({
          success: true,
          fromCache: true,
          cacheDate: existingCache.cacheDate,
          isFallback: existingCache.isFallback,
          recordCount: existingCache.recordCount,
          allowedMetrics,
          isSelfView,
          summary: existingCache.summary,
          disclaimer: MANDATORY_DISCLAIMER,
        });
      }
    }

    // 5. Gọi AI Service tạo tóm tắt xu hướng (Gemini API + Fallback)
    const aiResult = await generateHealthSummary(records, targetUser, isSelfView);

    // 6. Lưu / Cập nhật cache
    await AISummaryCache.findOneAndUpdate(
      {
        targetUserId: new mongoose.Types.ObjectId(targetUserId),
        requesterId: new mongoose.Types.ObjectId(requesterId),
        cacheDate,
      },
      {
        targetUserId: new mongoose.Types.ObjectId(targetUserId),
        requesterId: new mongoose.Types.ObjectId(requesterId),
        familyId: rawFamilyId && mongoose.Types.ObjectId.isValid(rawFamilyId) ? new mongoose.Types.ObjectId(rawFamilyId) : null,
        cacheDate,
        metricsHash,
        summary: aiResult.summary,
        recordCount: records.length,
        isFallback: aiResult.isFallback,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      fromCache: false,
      cacheDate,
      isFallback: aiResult.isFallback,
      recordCount: records.length,
      allowedMetrics,
      isSelfView,
      summary: aiResult.summary,
      disclaimer: MANDATORY_DISCLAIMER,
    });
  } catch (error) {
    console.error('[AI Controller] Lỗi khi tóm tắt xu hướng AI:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi phân tích xu hướng sức khỏe bằng AI',
      error: error.message,
    });
  }
};
