import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================
// Hằng số & cấu hình ngưỡng tham chiếu y tế
// ============================================================

/** Ngưỡng tham chiếu sinh lý cho từng loại chỉ số (WHO & JNC8) */
const METRIC_THRESHOLDS = {
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
const SAFETY_DISCLAIMER = `\n\n---\n*⚠️ Lưu ý: Tóm tắt này được tạo bởi AI nhằm mục đích tham khảo và theo dõi xu hướng, không có giá trị thay thế chẩn đoán hoặc chỉ định từ bác sĩ chuyên khoa.*`;

/** Timeout gọi Gemini API (ms) */
const GEMINI_TIMEOUT_MS = 10_000;

// ============================================================
// Helper: Tính thống kê cơ bản từ mảng số
// ============================================================

/**
 * Tính min, max, avg từ mảng số
 * @param {number[]} values
 * @returns {{ min: number, max: number, avg: number }}
 */
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

/**
 * Tổ chức dữ liệu HealthRecord thành cấu trúc thống kê theo từng loại chỉ số.
 * @param {Array} records - Mảng HealthRecord documents
 * @returns {Object} - Dữ liệu đã tổ chức
 */
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
    }

    grouped[record.type].readings.push(entry);
  }

  // Sắp xếp readings theo thời gian tăng dần
  for (const type of Object.keys(grouped)) {
    grouped[type].readings.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  }

  return grouped;
};

/**
 * Tạo phần mô tả dữ liệu ngắn gọn để đưa vào Prompt
 * @param {Object} grouped - Kết quả từ organizeRecordsForPrompt
 * @returns {string}
 */
const buildDataSummaryText = (grouped) => {
  let text = '';

  for (const [type, data] of Object.entries(grouped)) {
    text += `\n### ${data.label} (${data.unit})\n`;
    text += `- Số lần đo: ${data.readings.length}\n`;

    if (type === 'BLOOD_PRESSURE') {
      const systolicValues = data.readings.map((r) => r.systolic).filter(Boolean);
      const diastolicValues = data.readings.map((r) => r.diastolic).filter(Boolean);
      const sStat = calcStats(systolicValues);
      const dStat = calcStats(diastolicValues);

      text += `- Huyết áp tâm thu (mmHg): min=${sStat.min}, max=${sStat.max}, trung bình=${sStat.avg}\n`;
      text += `- Huyết áp tâm trương (mmHg): min=${dStat.min}, max=${dStat.max}, trung bình=${dStat.avg}\n`;
      text += `- Dữ liệu theo thời gian:\n`;
      for (const r of data.readings) {
        const date = new Date(r.recordedAt).toLocaleDateString('vi-VN');
        text += `  + ${date}: ${r.systolic}/${r.diastolic} mmHg${r.note ? ` (${r.note})` : ''}\n`;
      }
    } else {
      const values = data.readings.map((r) => r.value).filter((v) => v != null);
      const stat = calcStats(values);

      text += `- Thống kê: min=${stat.min}, max=${stat.max}, trung bình=${stat.avg}\n`;
      text += `- Dữ liệu theo thời gian:\n`;
      for (const r of data.readings) {
        const date = new Date(r.recordedAt).toLocaleDateString('vi-VN');
        text += `  + ${date}: ${r.value} ${data.unit}${r.note ? ` (${r.note})` : ''}\n`;
      }
    }

    // Hiển thị ngưỡng tham chiếu nếu có
    const threshold = METRIC_THRESHOLDS[type];
    if (threshold) {
      if (type === 'BLOOD_PRESSURE') {
        text += `- Ngưỡng bình thường: Tâm thu ${threshold.systolicNormal.min}-${threshold.systolicNormal.max} mmHg, Tâm trương ${threshold.diastolicNormal.min}-${threshold.diastolicNormal.max} mmHg\n`;
      } else if (threshold.normal) {
        text += `- Ngưỡng bình thường: ${threshold.normal.min}-${threshold.normal.max} ${data.unit}\n`;
      }
    }
  }

  return text;
};

// ============================================================
// Core: Tạo Prompt chuyên sâu
// ============================================================

/**
 * Tạo nội dung Prompt gửi đến Gemini.
 * @param {Object} grouped - Dữ liệu đã tổ chức
 * @param {string} ownerName - Tên người sở hữu dữ liệu
 * @param {boolean} isSelfView - Người yêu cầu có phải chính chủ không
 * @returns {string} - Prompt hoàn chỉnh
 */
const buildGeminiPrompt = (grouped, ownerName, isSelfView) => {
  const dataSummary = buildDataSummaryText(grouped);
  const perspective = isSelfView
    ? `Người đọc bản tóm tắt này là chính ${ownerName} (người sở hữu dữ liệu).`
    : `Người đọc bản tóm tắt này là người thân được phép xem dữ liệu của ${ownerName}.`;

  return `Bạn là trợ lý AI chuyên phân tích xu hướng sức khỏe cá nhân. Nhiệm vụ của bạn là giúp người dùng hiểu rõ hơn về xu hướng các chỉ số sức khỏe qua thời gian, KHÔNG đưa ra chẩn đoán bệnh hoặc kê đơn thuốc.

## Hướng dẫn an toàn y tế (BẮT BUỘC):
- KHÔNG chẩn đoán bệnh cụ thể
- KHÔNG kê tên thuốc hoặc liều dùng
- KHÔNG sử dụng ngôn ngữ gây hoảng loạn ("nguy hiểm tính mạng", "cần nhập viện gấp")
- Luôn khuyến nghị tham khảo bác sĩ cho các thay đổi bất thường
- Sử dụng ngôn ngữ nhẹ nhàng, tích cực, mang tính khích lệ

## Đối tượng:
${perspective}

## Dữ liệu sức khỏe cần phân tích của ${ownerName}:
${dataSummary}

## Yêu cầu định dạng đầu ra (Markdown tiếng Việt, ngắn gọn súc tích):

### 📊 Xu hướng chính
[Mô tả xu hướng biến thiên của từng chỉ số theo thời gian. So sánh giai đoạn đầu và cuối chuỗi dữ liệu. Đánh giá tính ổn định hay biến động.]

### 🌟 Điểm tích cực
[Liệt kê những chỉ số nằm trong ngưỡng bình thường, cải thiện tốt, hoặc duy trì ổn định. Viết theo kiểu động viên.]

### 💡 Lưu ý sinh hoạt & khuyến nghị theo dõi
[Gợi ý thói quen sinh hoạt lành mạnh phù hợp với xu hướng chỉ số (không phải chỉ định y tế). Nêu rõ nên theo dõi thêm chỉ số nào và tần suất ra sao. Nếu có chỉ số bất thường, khuyến nghị trao đổi với bác sĩ.]

Hãy viết theo giọng văn thân thiện, dễ đọc, sử dụng Markdown. Không lặp lại dữ liệu thô quá nhiều, tập trung vào nhận xét và xu hướng.`;
};

// ============================================================
// Core: Tạo Fallback Summary (thống kê cơ bản khi Gemini lỗi)
// ============================================================

/**
 * Tạo bản tóm tắt thống kê cơ bản khi Gemini API không khả dụng.
 * @param {Object} grouped - Dữ liệu đã tổ chức
 * @param {string} ownerName - Tên người sở hữu dữ liệu
 * @returns {string} - Nội dung Markdown fallback
 */
const buildFallbackSummary = (grouped, ownerName) => {
  let md = `## 📊 Báo cáo thống kê sức khỏe của ${ownerName}\n`;
  md += `*(Chú thích: Tóm tắt AI tạm thời không khả dụng. Dưới đây là thống kê cơ bản từ dữ liệu đã ghi nhận.)*\n\n`;

  for (const [type, data] of Object.entries(grouped)) {
    md += `### ${data.label}\n`;
    md += `- Tổng số lần đo: **${data.readings.length}** lần\n`;

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

  md += `> Để được phân tích xu hướng chuyên sâu hơn, vui lòng thử lại sau ít phút khi dịch vụ AI phục hồi.`;
  md += SAFETY_DISCLAIMER;

  return md;
};

// ============================================================
// Export: Hàm chính generateHealthSummary
// ============================================================

/**
 * Gọi Gemini API để tóm tắt xu hướng sức khỏe.
 * Có cơ chế timeout 10s và fallback thống kê cơ bản nếu API lỗi.
 *
 * @param {Array} records - Mảng HealthRecord documents (đã qua filter quyền)
 * @param {Object} ownerUser - User document của người sở hữu dữ liệu
 * @param {boolean} isSelfView - Người yêu cầu có phải chính chủ không
 * @returns {{ summary: string, isFallback: boolean }}
 */
export const generateHealthSummary = async (records, ownerUser, isSelfView = true) => {
  const ownerName = ownerUser.name || ownerUser.fullName || 'người dùng';
  const grouped = organizeRecordsForPrompt(records);

  // Kiểm tra GEMINI_API_KEY có tồn tại không
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[AI Service] GEMINI_API_KEY chưa được cấu hình, trả về fallback summary.');
    return {
      summary: buildFallbackSummary(grouped, ownerName),
      isFallback: true,
    };
  }

  try {
    const prompt = buildGeminiPrompt(grouped, ownerName, isSelfView);

    // Khởi tạo Gemini client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.4, // Cân bằng giữa sáng tạo và chính xác
        topP: 0.8,
      },
    });

    // Gọi API với timeout 10s
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

    // Đảm bảo luôn có disclaimer an toàn y tế ở cuối
    if (!summaryText.includes('⚠️ Lưu ý:')) {
      summaryText += SAFETY_DISCLAIMER;
    }

    return { summary: summaryText, isFallback: false };
  } catch (error) {
    console.error('[AI Service] Lỗi khi gọi Gemini API:', error.message);

    // Fallback: trả về thống kê cơ bản
    return {
      summary: buildFallbackSummary(grouped, ownerName),
      isFallback: true,
    };
  }
};

/**
 * Tính metricsHash từ danh sách các metric types (để detect khi quyền thay đổi)
 * @param {string[]} metricTypes
 * @returns {string}
 */
export const computeMetricsHash = (metricTypes) => {
  return [...metricTypes].sort().join(',');
};
