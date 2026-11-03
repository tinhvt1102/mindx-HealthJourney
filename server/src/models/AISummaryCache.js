import mongoose from 'mongoose';

/**
 * Mongoose Schema lưu cache kết quả tóm tắt AI xu hướng sức khỏe (SCRUM-56)
 *
 * Cache theo ngày (cacheDate = YYYY-MM-DD UTC) cho mỗi cặp:
 *   - targetUserId: Người được tóm tắt dữ liệu sức khỏe
 *   - requesterId:  Người yêu cầu tóm tắt (có thể chính là targetUser hoặc người thân có quyền)
 *
 * Mục tiêu:
 *   - Tránh spam Gemini API quota (mỗi cặp target+requester chỉ gọi API tối đa 1 lần/ngày)
 *   - Tự động hết hạn sau 24h nhờ TTL index trên trường createdAt
 */
const aiSummaryCacheSchema = new mongoose.Schema(
  {
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Target User ID là bắt buộc'],
      index: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester ID là bắt buộc'],
      index: true,
    },
    // Ngày cache theo UTC, định dạng YYYY-MM-DD, dùng để kiểm tra cache còn hợp lệ trong ngày không
    cacheDate: {
      type: String,
      required: [true, 'Cache date là bắt buộc'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'cacheDate phải theo định dạng YYYY-MM-DD'],
    },
    // Hash/fingerprint của danh sách metric types được phân tích
    // (phục vụ phân biệt khi quyền thay đổi giữa các ngày)
    metricsHash: {
      type: String,
      default: '',
    },
    // Nội dung tóm tắt trả về từ Gemini, định dạng Markdown tiếng Việt
    summary: {
      type: String,
      required: [true, 'Nội dung tóm tắt không được để trống'],
    },
    // Số lượng bản ghi sức khỏe được phân tích
    recordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Đánh dấu nếu đây là bản phân tích fallback (thống kê cơ bản khi Gemini API lỗi)
    isFallback: {
      type: Boolean,
      default: false,
    },
    // Trường phục vụ TTL index - tự động xóa sau 24h
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Tắt timestamps tự động vì đã tự quản lý createdAt cho TTL
    timestamps: false,
  }
);

// TTL index: Tự động xóa document sau 86400 giây (24h) kể từ createdAt
aiSummaryCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

// Compound unique index: Mỗi cặp (target, requester, ngày) chỉ có 1 bản cache
aiSummaryCacheSchema.index(
  { targetUserId: 1, requesterId: 1, cacheDate: 1 },
  { unique: true }
);

export const AISummaryCache = mongoose.model('AISummaryCache', aiSummaryCacheSchema);
