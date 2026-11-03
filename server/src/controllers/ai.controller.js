import mongoose from 'mongoose';
import { HealthRecord } from '../models/HealthRecord.js';
import { User } from '../models/User.js';
import { Family } from '../models/Family.js';
import { SharingPolicy } from '../models/SharingPolicy.js';
import { AiTrendSummary } from '../models/AiTrendSummary.js';
import { generateAiSummaryWithGemini, MANDATORY_DISCLAIMER } from '../services/ai.service.js';

export const summarizeTrends = async (req, res) => {
  try {
    const requesterId = req.user.id || req.user._id;
    const { memberId, familyId, forceRefresh } = req.body;

    const targetUserId = memberId && mongoose.Types.ObjectId.isValid(memberId) ? memberId : requesterId;
    const isSelfView = targetUserId.toString() === requesterId.toString();

    const targetUser = await User.findById(targetUserId).select('name fullName');
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    let allowedMetrics = null; // null nghĩa là được xem toàn bộ (khi xem chính mình)

    if (!isSelfView) {
      if (!familyId || !mongoose.Types.ObjectId.isValid(familyId)) {
        return res.status(400).json({ success: false, message: 'Cần cung cấp familyId khi xem dữ liệu người thân' });
      }

      // Kiểm tra cả hai người có thuộc gia đình không
      const family = await Family.findById(familyId);
      if (!family) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy nhóm gia đình' });
      }

      const isRequesterInFamily = family.members.some(m => m.userId.toString() === requesterId.toString());
      const isMemberInFamily = family.members.some(m => m.userId.toString() === targetUserId.toString());
      if (!isRequesterInFamily || !isMemberInFamily) {
        return res.status(403).json({ success: false, message: 'Bạn hoặc người thân không thuộc nhóm gia đình này' });
      }

      // Kiểm tra SharingPolicy (Default Deny - Jira SCRUM-49 / SCRUM-54)
      const policy = await SharingPolicy.findOne({
        ownerId: targetUserId,
        viewerId: requesterId,
        familyId,
      });

      if (!policy || !policy.allowedMetrics || policy.allowedMetrics.length === 0) {
        return res.status(403).json({
          success: false,
          code: 'ACCESS_DENIED',
          message: 'Chính sách bảo vệ quyền riêng tư (Default Deny): Thành viên này chưa cấp quyền xem bất kỳ chỉ số nào cho bạn.',
        });
      }

      allowedMetrics = policy.allowedMetrics;
    }

    // Truy vấn dữ liệu chỉ lấy các metric được phép xem
    const recordQuery = { userId: targetUserId };
    if (allowedMetrics) {
      recordQuery.type = { $in: allowedMetrics };
    }

    const records = await HealthRecord.find(recordQuery).sort({ recordedAt: 1 });

    // AC4 SCRUM-54: Cần tối thiểu 3 bản ghi dữ liệu mới cho phép tóm tắt
    if (records.length < 3) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_DATA',
        recordCount: records.length,
        minRequired: 3,
        message: `Cần tối thiểu 3 bản ghi dữ liệu đo lường để AI có thể phân tích xu hướng sức khỏe (Hiện tại có ${records.length} bản ghi).`,
      });
    }

    // AC SCRUM-54 Sub-task 44: Cache kết quả theo ngày tránh spam quota
    const today = new Date().toISOString().split('T')[0];
    if (!forceRefresh) {
      const cached = await AiTrendSummary.findOne({
        memberId: targetUserId,
        userId: requesterId,
        dateKey: today,
      }).sort({ createdAt: -1 });

      if (cached && cached.recordCount === records.length) {
        return res.status(200).json({
          success: true,
          summary: cached.summaryMarkdown,
          disclaimer: cached.disclaimer || MANDATORY_DISCLAIMER,
          recordCount: cached.recordCount,
          fromCache: true,
          generatedAt: cached.createdAt,
        });
      }
    }

    // Sinh nội dung qua Gemini API hoặc Rule-based fallback
    const memberName = targetUser.fullName || targetUser.name || (isSelfView ? 'bạn' : 'thành viên');
    const summaryMarkdown = await generateAiSummaryWithGemini(records, memberName);

    // Lưu cache mới
    const savedCache = await AiTrendSummary.create({
      userId: requesterId,
      memberId: targetUserId,
      familyId: familyId || null,
      recordCount: records.length,
      summaryMarkdown,
      disclaimer: MANDATORY_DISCLAIMER,
      dateKey: today,
    });

    return res.status(200).json({
      success: true,
      summary: summaryMarkdown,
      disclaimer: MANDATORY_DISCLAIMER,
      recordCount: records.length,
      fromCache: false,
      generatedAt: savedCache.createdAt,
    });
  } catch (error) {
    console.error('Lỗi khi tóm tắt xu hướng AI:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi phân tích xu hướng sức khỏe bằng AI',
      error: error.message,
    });
  }
};
