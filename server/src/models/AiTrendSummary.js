import mongoose from 'mongoose';

const aiTrendSummarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Family',
      default: null,
    },
    recordCount: {
      type: Number,
      default: 0,
    },
    summaryMarkdown: {
      type: String,
      required: true,
    },
    disclaimer: {
      type: String,
      default: 'Bản tóm tắt chỉ mang tính chất tham khảo, không thay thế cho chẩn đoán của bác sĩ chuyên khoa.',
    },
    dateKey: {
      type: String, // Định dạng YYYY-MM-DD để cache theo ngày
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

aiTrendSummarySchema.index({ memberId: 1, dateKey: 1 }, { unique: false });

export const AiTrendSummary = mongoose.model('AiTrendSummary', aiTrendSummarySchema);
export default AiTrendSummary;
