import { GoogleGenerativeAI } from '@google/generative-ai';
import { evaluateMedicalThreshold } from '../utils/healthThresholds.js';

// ============================================================
// Hằng số & cấu hình ngưỡng tham chiếu y tế
// ============================================================

export const MANDATORY_DISCLAIMER = 'Bản tóm tắt chỉ mang tính chất tham khảo, không thay thế cho chẩn đoán của bác sĩ chuyên khoa.';

/** Ngưỡng tham chiếu sinh lý cho từng loại chỉ số (WHO & JNC8) */
export const METRIC_THRESHOLDS = {
  BLOOD_PRESSURE: {
    label: 'Huyết áp',
    unit: 'mmHg',
    systolicNormal: { min: 90, max: 120 },
    diastolicNormal: { min: 60, max: 80 },
    systolicWarning: { min: 80, max: 140 },
    diastolicWarning: { min: 50, max: 90 },
  },
  HEART_RATE: {
    label: 'Nhịp tim',
    unit: 'bpm',
    normal: { min: 60, max: 100 },
    warning: { min: 50, max: 110 },
  },
  BLOOD_SUGAR: {
    label: 'Đường huyết lúc đói',
    unit: 'mg/dL',
    normal: { min: 70, max: 99 },
    warning: { min: 60, max: 125 },
  },
  WEIGHT: {
    label: 'Cân nặng',
    unit: 'kg',
  },
  TEMPERATURE: {
    label: 'Thân nhiệt',
    unit: '°C',
    normal: { min: 36.1, max: 37.2 },
    warning: { min: 35.5, max: 38.0 },
  },
  SPO2: {
    label: 'Nồng độ oxy máu (SpO₂)',
    unit: '%',
    normal: { min: 95, max: 100 },
    warning: { min: 90, max: 100 },
  },
};

/** Disclaimer bắt buộc, in nghiêng, gắn ở cuối mọi bản tóm tắt */
export const SAFETY_DISCLAIMER = `\n\n---\n*⚠️ Lưu ý y tế: ${MANDATORY_DISCLAIMER}*`;

/** Timeout gọi Gemini API (ms) */
const GEMINI_TIMEOUT_MS = 10_000;

// ============================================================
// Helper: Tính thống kê cơ bản từ mảng số
// ============================================================

const calcStats = (values) => {
  if (!values || values.length === 0) return { min: 0, max: 0, avg: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1));
  return { min, max, avg };
};

// ============================================================
// Helper: Chuẩn bị dữ liệu tóm tắt cho Prompt
// ============================================================

const organizeRecordsForPrompt = (records) => {
  const grouped = {};

  for (const record of records) {
    if (!grouped[record.type]) {
      grouped[record.type] = {
        label: METRIC_THRESHOLDS[record.type]?.label || record.type,
        unit: record.unit || METRIC_THRESHOLDS[record.type]?.unit || '',
        readings: [],
      };
    }

    const entry = {
      recordedAt: record.recordedAt,
      note: record.note || '',
    };

    if (record.type === 'BLOOD_PRESSURE') {
      entry.systolic = record.systolic;
      entry.diastolic = record.diastolic;
    } else {
      entry.value = record.value;
      if (record.type === 'WEIGHT' && record.bmi) {
        entry.bmi = record.bmi;
      }
    }

    grouped[record.type].readings.push(entry);
  }

  return grouped;
};

// ============================================================
// Prompt Builder chuẩn cấu trúc 3 phần (SCRUM-56)
// ============================================================

export const buildGeminiPrompt = (grouped, ownerName, isSelfView) => {
  const targetLabel = isSelfView ? `người dùng "${ownerName}"` : `thành viên gia đình "${ownerName}"`;

  let prompt = `Bạn là Trợ lý Sức khỏe AI của ứng dụng HealthJourney.
Nhiệm vụ của bạn là phân tích dữ liệu chỉ số sức khỏe của ${targetLabel} và tạo một bản tóm tắt xu hướng sức khỏe định kỳ.

HƯỚNG DẪN ĐỊNH DẠNG:
- Trả về BẮT BUỘC bằng tiếng Việt có dấu, văn phong y tế ân cần, súc tích và dễ hiểu.
- KHÔNG sử dụng xưng hô ngôi thứ nhất ("tôi", "chúng tôi").
- Cấu trúc kết quả CHÍNH XÁC theo 3 đề mục Markdown sau (không thêm/bớt đề mục):

### 📊 Xu hướng chính
(Mô tả diễn biến theo thời gian của từng loại chỉ số: tăng, giảm hay duy trì ổn định; so sánh các lần đo gần nhất với trung bình)

### 🌟 Điểm tích cực
(Liệt kê các chỉ số đang nằm trong ngưỡng sinh lý an toàn, hoặc có cải thiện tích cực so với trước)

### 💡 Lưu ý sinh hoạt & khuyến nghị theo dõi
(Đưa ra các lời khuyên thiết thực về lối sống, dinh dưỡng, vận động nhẹ nhàng dựa trên dữ liệu cụ thể; gợi ý các mốc cần theo dõi thêm)

DỮ LIỆU ĐO LƯỜNG:
`;

  for (const [type, data] of Object.entries(grouped)) {
    prompt += `\n[${data.label}] (${data.unit}):\n`;
    for (const r of data.readings) {
      const date = new Date(r.recordedAt).toLocaleDateString('vi-VN');
      if (type === 'BLOOD_PRESSURE') {
        prompt += `- ${date}: ${r.systolic}/${r.diastolic} mmHg${r.note ? ` (${r.note})` : ''}\n`;
      } else if (type === 'WEIGHT') {
        prompt += `- ${date}: ${r.value} kg${r.bmi ? ` (BMI: ${r.bmi})` : ''}${r.note ? ` (${r.note})` : ''}\n`;
      } else {
        prompt += `- ${date}: ${r.value} ${data.unit}${r.note ? ` (${r.note})` : ''}\n`;
      }
    }
  }

  prompt += `
CHỈ THỊ AN TOÀN Y TẾ NGHIÊM NGẶT:
1. KHÔNG BAO GIỜ đưa ra chẩn đoán xác định bệnh lý (ví dụ: "Bạn bị cao huyết áp", "Bạn mắc bệnh tiểu đường").
2. CHỈ ĐƯỢC nhận xét về "xu hướng chỉ số", "ngưỡng an toàn sinh lý" và "lưu ý theo dõi".
3. Luôn khuyến khích tham khảo ý kiến bác sĩ chuyên khoa khi chỉ số vượt ngưỡng cảnh báo.
`;

  return prompt;
};

// ============================================================
// Fallback Rule-based Engine khi Gemini API lỗi hoặc chưa cấu hình
// ============================================================

export const buildFallbackSummary = (grouped, ownerName) => {
  let md = `### 📊 Xu hướng chính\n`;
  md += `Dữ liệu đo lường sức khỏe của **${ownerName}** trong các lần ghi gần đây:\n\n`;

  for (const [type, data] of Object.entries(grouped)) {
    md += `**${data.label}**:\n`;

    if (type === 'BLOOD_PRESSURE') {
      const systolicValues = data.readings.map((r) => r.systolic).filter(Boolean);
      const diastolicValues = data.readings.map((r) => r.diastolic).filter(Boolean);
      const sStat = calcStats(systolicValues);
      const dStat = calcStats(diastolicValues);

      md += `- Tâm thu: min **${sStat.min}**, max **${sStat.max}**, trung bình **${sStat.avg}** mmHg\n`;
      md += `- Tâm trương: min **${dStat.min}**, max **${dStat.max}**, trung bình **${dStat.avg}** mmHg\n`;

      const lastReading = data.readings[data.readings.length - 1];
      if (lastReading) {
        const date = new Date(lastReading.recordedAt).toLocaleDateString('vi-VN');
        md += `- Lần đo gần nhất (${date}): **${lastReading.systolic}/${lastReading.diastolic}** mmHg\n`;
      }
    } else {
      const values = data.readings.map((r) => r.value).filter((v) => v != null);
      const stat = calcStats(values);

      md += `- Thống kê: min **${stat.min}**, max **${stat.max}**, trung bình **${stat.avg}** ${data.unit}\n`;

      const lastReading = data.readings[data.readings.length - 1];
      if (lastReading) {
        const date = new Date(lastReading.recordedAt).toLocaleDateString('vi-VN');
        md += `- Lần đo gần nhất (${date}): **${lastReading.value}** ${data.unit}\n`;
      }
    }
    md += '\n';
  }

  md += `### 🌟 Điểm tích cực\n`;
  md += `- Bạn đang duy trì thói quen theo dõi và ghi nhật ký các chỉ số sức khỏe định kỳ rất tốt.\n\n`;

  md += `### 💡 Lưu ý sinh hoạt & khuyến nghị theo dõi\n`;
  md += `- Tiếp tục duy trì chế độ sinh hoạt điều độ, uống đủ nước và vận động nhẹ nhàng.\n`;
  md += `- Hãy tham khảo ý kiến bác sĩ chuyên khoa nếu các chỉ số có dấu hiệu bất thường kéo dài.\n`;

  md += SAFETY_DISCLAIMER;
  return md;
};

/** Client factory phục vụ việc mock trong test (SCRUM-59) */
export const geminiClientFactory = {
  createClient: (apiKey) => new GoogleGenerativeAI(apiKey),
};

/**
 * Gọi Gemini API để tóm tắt xu hướng sức khỏe.
 * Có cơ chế timeout 10s và fallback thống kê cơ bản nếu API lỗi.
 */
export const generateHealthSummary = async (records, ownerUser, isSelfView = true) => {
  const ownerName = ownerUser?.name || ownerUser?.fullName || 'người dùng';
  const grouped = organizeRecordsForPrompt(records);

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY chưa được cấu hình, trả về fallback summary.');
    return {
      summary: buildFallbackSummary(grouped, ownerName),
      isFallback: true,
    };
  }

  try {
    const prompt = buildGeminiPrompt(grouped, ownerName, isSelfView);

    const genAI = geminiClientFactory.createClient(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.4,
        topP: 0.8,
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Gemini API timeout sau 10 giây')),
        GEMINI_TIMEOUT_MS
      )
    );

    const generatePromise = model.generateContent(prompt);
    const result = await Promise.race([generatePromise, timeoutPromise]);

    const response = result.response;
    let summaryText = response.text();

    if (!summaryText.includes('⚠️ Lưu ý')) {
      summaryText += SAFETY_DISCLAIMER;
    }

    return { summary: summaryText, isFallback: false };
  } catch (error) {
    console.error('[AI Service] Lỗi khi gọi Gemini API:', error.message);
    return {
      summary: buildFallbackSummary(grouped, ownerName),
      isFallback: true,
    };
  }
};

/**
 * Tính metricsHash từ danh sách các metric types
 */
export const computeMetricsHash = (metricTypes) => {
  return [...metricTypes].sort().join(',');
};

// Hàm tương thích cho Quan's controllers
export const generateFallbackSummary = (records, memberName = 'bạn') => {
  const grouped = organizeRecordsForPrompt(records);
  return buildFallbackSummary(grouped, memberName);
};

export const generateAiSummaryWithGemini = async (records, memberName = 'bạn') => {
  const result = await generateHealthSummary(records, { name: memberName }, true);
  return result.summary;
};
