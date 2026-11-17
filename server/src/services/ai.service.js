import { GoogleGenerativeAI } from '@google/generative-ai';
import { evaluateMedicalThreshold } from '../utils/healthThresholds.js';

// ============================================================
// Hằng số & cấu hình ngưỡng tham chiếu y tế
// ============================================================

export const MANDATORY_DISCLAIMER =
  'Bản tóm tắt chỉ mang tính chất tham khảo, không thay thế cho chẩn đoán của bác sĩ chuyên khoa.';

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
// Prompt Builder chuẩn cấu trúc 5 phần (bao gồm Ăn uống & Tập luyện)
// Lưu ý bảo mật: KHÔNG viết cứng tên chỉ số không có trong grouped vào phần hướng dẫn tĩnh
// ============================================================

export const buildGeminiPrompt = (grouped, ownerName, isSelfView) => {
  const targetLabel = isSelfView ? `người dùng "${ownerName}"` : `thành viên gia đình "${ownerName}"`;

  let prompt = `Bạn là Trợ lý Sức khỏe AI của ứng dụng HealthJourney.
Nhiệm vụ của bạn là phân tích dữ liệu đo lường của ${targetLabel} và tạo bản tổng hợp xu hướng kết hợp gợi ý quy trình ăn uống, tập luyện phù hợp trực tiếp với các số liệu đã ghi nhận.

HƯỚNG DẪN ĐỊNH DẠNG:
- Trả về BẮT BUỘC bằng tiếng Việt có dấu, văn phong y tế súc tích, thực tế và dễ áp dụng.
- KHÔNG sử dụng xưng hô ngôi thứ nhất ("tôi", "chúng tôi").
- CHỈ phân tích và đề xuất dựa trên đúng các nhóm dữ liệu có mặt ở phần DỮ LIỆU ĐO LƯỜNG bên dưới.
- Với 2 mục "Quy trình ăn uống phù hợp" và "Quy trình tập luyện phù hợp":
  + Mỗi mục PHẢI viết dạng gạch đầu dòng ngắn gọn: - **[Tên hành động ngắn gọn 3-6 từ]**: [Hướng dẫn cụ thể 1 câu ngắn, chuẩn khoa học].
  + Tránh hoàn toàn các đoạn văn dài, nhiều chữ để người dùng dễ đọc và chuyển thành checklist tick theo dõi hàng ngày.
- Cấu trúc kết quả CHÍNH XÁC theo 5 đề mục Markdown sau (không thêm/bớt đề mục):

### 📊 Xu hướng chính
(Mô tả diễn biến theo thời gian của từng loại dữ liệu đo được: tăng, giảm hay ổn định; so sánh lần đo gần nhất với mức trung bình)

### 🌟 Điểm tích cực
(Ghi nhận những chỉ số nằm trong vùng sinh lý an toàn hoặc có dấu hiệu cải thiện, duy trì đều đặn)

### 🥗 Quy trình ăn uống phù hợp
(Đưa ra nguyên tắc dinh dưỡng, nhóm thực phẩm nên ưu tiên, món/gia vị cần hạn chế, cách phân bổ bữa ăn và lượng nước mỗi ngày phù hợp trực tiếp với các số liệu đo được; nếu cần thận trọng khi số liệu cao/thấp thì nêu rõ mức khuyến nghị an toàn)

### 🏃 Quy trình tập luyện phù hợp
(Đề xuất lịch vận động cụ thể phù hợp với mức độ ổn định của các số liệu đo được: tên bài tập gợi ý, thời lượng mỗi buổi, số buổi/tuần, mức cường độ và nguyên tắc khởi động/an toàn; nếu có chỉ số đang cảnh báo hoặc bất thường cấp tính thì ưu tiên nghỉ ngơi hoặc bài tập nhẹ nhàng thay thế)

### 💡 Lưu ý sinh hoạt & khuyến nghị theo dõi
(Tổng hợp thói quen giấc ngủ, kiểm soát căng thẳng và lịch đo kiểm tra lại phù hợp)

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
1. KHÔNG BAO GIỜ đưa ra chẩn đoán xác định bệnh lý.
2. CHỈ ĐƯỢC nhận xét về xu hướng số liệu, ngưỡng an toàn sinh lý, và quy trình ăn uống/vận động mang tính tham khảo hỗ trợ lối sống lành mạnh.
3. Luôn khuyến khích tham khảo ý kiến bác sĩ chuyên khoa trước khi tập luyện cường độ cao hoặc thay đổi chế độ ăn nếu chỉ số vượt ngưỡng cảnh báo.
`;

  return prompt;
};

// ============================================================
// Helper: Sinh quy trình Ăn uống & Tập luyện rule-based theo đúng chỉ số có trong grouped
// ============================================================

const buildMetricCarePlans = (grouped) => {
  const dietTips = [];
  const workoutTips = [];
  let hasAcuteRestNeeded = false;

  if (grouped.BLOOD_PRESSURE) {
    const readings = grouped.BLOOD_PRESSURE.readings;
    const last = readings[readings.length - 1];
    const sysStat = calcStats(readings.map((r) => r.systolic).filter(Boolean));
    const diaStat = calcStats(readings.map((r) => r.diastolic).filter(Boolean));
    const sys = last?.systolic ?? sysStat.avg;
    const dia = last?.diastolic ?? diaStat.avg;

    if (sys >= 140 || dia >= 90) {
      dietTips.push(
        `**Ăn nhạt theo chuẩn DASH**: Giảm muối dưới 5g/ngày (< 1 thìa cà phê), tăng rau xanh, chuối và các loại đậu giàu Kali.`
      );
      if (sys >= 160 || dia >= 100) {
        hasAcuteRestNeeded = true;
        workoutTips.push(
          `**Nghỉ ngơi & Thở sâu**: Tạm ngưng bài tập nặng; tập thở sâu (4s hít - 6s thở) 10 phút và đo lại sau 15-30 phút.`
        );
      } else {
        workoutTips.push(
          `**Đi bộ nhanh vừa sức 30 phút**: Đi bộ hoặc đạp xe nhẹ 150 phút/tuần theo chuẩn WHO, tránh nín thở nâng tạ nặng.`
        );
      }
    } else if (sys > 0 && sys < 90) {
      dietTips.push(
        `**Bổ sung nước & Khoáng chất**: Uống đủ 2 - 2.5L nước ấm/ngày, chia nhỏ bữa ăn trong ngày giúp huyết áp ổn định.`
      );
      workoutTips.push(
        `**Tập thể dục nhẹ nhàng 20 phút**: Tập yoga cơ bản hoặc đi bộ nhẹ, tránh thay đổi tư thế đứng/nằm đột ngột.`
      );
    } else {
      dietTips.push(
        `**Ăn nhạt & Dinh dưỡng tim mạch**: Duy trì khẩu phần ít mỡ bão hòa, bổ sung 400g rau củ và trái cây tươi mỗi ngày.`
      );
      workoutTips.push(
        `**Duy trì Cardio 30 phút**: Đi bộ nhanh, bơi lội hoặc đạp xe (chuẩn 150 phút/tuần của WHO) ở cường độ vừa phải.`
      );
    }
  }

  if (grouped.HEART_RATE) {
    const readings = grouped.HEART_RATE.readings;
    const lastHr = readings[readings.length - 1]?.value ?? calcStats(readings.map((r) => r.value)).avg;
    const evalHr = evaluateMedicalThreshold('HEART_RATE', { value: lastHr });

    if (lastHr > 100 || evalHr.level === 'DANGER') {
      dietTips.push(
        `**Hạn chế chất kích thích**: Giảm cà phê đặc, trà đậm, nước tăng lực và rượu bia; ăn thêm chuối, hạt giàu Magie.`
      );
      workoutTips.push(
        `**Tập thở & Yoga phục hồi 15 phút**: Thư giãn làm dịu nhịp tim; tránh các bài tập gắng sức nhanh (HIIT).`
      );
    } else {
      dietTips.push(
        `**Dinh dưỡng trợ tim**: Bổ sung đạm nạc (cá béo, đậu), rau xanh và uống đủ nước trước và sau khi vận động.`
      );
      workoutTips.push(
        `**Rèn luyện hiếu khí Zone 2**: Đi bộ nhanh hoặc đạp xe nhẹ 30-40 phút giúp tăng cường sức bền cơ tim.`
      );
    }
  }

  if (grouped.BLOOD_SUGAR) {
    const readings = grouped.BLOOD_SUGAR.readings;
    const lastBs = readings[readings.length - 1]?.value ?? calcStats(readings.map((r) => r.value)).avg;

    if (lastBs >= 126) {
      dietTips.push(
        `**Chế độ Low-GI giảm đường**: Ăn gạo lứt/yến mạch, ăn rau trước tinh bột, hạn chế đường ngọt dưới 25g/ngày.`
      );
      workoutTips.push(
        `**Đi bộ 15-20 phút sau bữa ăn**: Giúp cơ bắp tiêu thụ glucose, hạ đường huyết tự nhiên sau bữa ăn chính.`
      );
    } else if (lastBs > 0 && lastBs < 70) {
      dietTips.push(
        `**Ổn định đường huyết**: Không bỏ bữa, chia 3 bữa chính kèm 2 bữa phụ nhẹ giàu đạm và tinh bột phức hợp.`
      );
      workoutTips.push(
        `**Vận động an toàn**: Ăn nhẹ 1 quả chuối trước khi tập 20 phút, tuyệt đối không tập khi bụng đói.`
      );
    } else {
      dietTips.push(
        `**Cân bằng đường tự nhiên**: Ưu tiên chất xơ hòa tan từ rau củ, hạn chế đồ uống ngọt có ga và bánh kẹo.`
      );
      workoutTips.push(
        `**Vận động chuyển hóa**: Duy trì đi bộ nhanh hoặc thể dục toàn thân 30 phút/ngày, 5 ngày/tuần.`
      );
    }
  }

  if (grouped.WEIGHT) {
    const readings = grouped.WEIGHT.readings;
    const last = readings[readings.length - 1];
    const lastW = last?.value;
    const bmi = last?.bmi;

    if (bmi && bmi >= 23) {
      dietTips.push(
        `**Thâm hụt calo lành mạnh**: Giảm 300-400 kcal/ngày, đĩa ăn 1/2 rau xanh, 1/4 đạm nạc, 1/4 tinh bột chậm.`
      );
      workoutTips.push(
        `**Cardio bảo vệ khớp 30-40 phút**: Đi bộ nhanh, đạp xe hoặc bơi lội để giảm áp lực lên khớp gối.`
      );
    } else if (bmi && bmi < 18.5) {
      dietTips.push(
        `**Dinh dưỡng tăng cân lành mạnh**: Thêm 2 bữa phụ dinh dưỡng (sữa chua, hạt, bơ chuối), nạp đủ 1.2-1.5g đạm/kg.`
      );
      workoutTips.push(
        `**Tập kháng lực tăng cơ**: Tập sức mạnh (chống đẩy, squat, tạ nhẹ) 30-40 phút/buổi, 3 buổi/tuần.`
      );
    } else {
      dietTips.push(
        `**Dinh dưỡng 4 nhóm chất**: Ăn đủ đạm, chất xơ, tinh bột tốt và chất béo lành mạnh, không ăn khuya sau 20h.`
      );
      workoutTips.push(
        `**Thể lực toàn diện**: Kết hợp 3 buổi Cardio (30 phút) và 2 buổi tập sức mạnh / giãn cơ mỗi tuần.`
      );
    }
  }

  if (grouped.TEMPERATURE) {
    const lastTemp = grouped.TEMPERATURE.readings[grouped.TEMPERATURE.readings.length - 1]?.value;
    if (lastTemp >= 37.5) {
      hasAcuteRestNeeded = true;
      dietTips.push(
        `**Bù nước & Điện giải**: Uống nhiều nước ấm, oresol hoặc nước quả giàu Vitamin C; ăn cháo loãng, súp gà.`
      );
      workoutTips.push(
        `**Nghỉ ngơi hồi phục**: Tạm ngưng hoàn toàn các bài tập thể lực cho tới khi hết sốt ít nhất 24 giờ.`
      );
    }
  }

  if (grouped.SPO2) {
    const lastSpo2 = grouped.SPO2.readings[grouped.SPO2.readings.length - 1]?.value;
    if (lastSpo2 && lastSpo2 < 94) {
      hasAcuteRestNeeded = true;
      dietTips.push(
        `**Thực phẩm hỗ trợ tạo máu**: Ăn rau bina, thịt bò nạc, đậu lăng và uống đủ nước ấm giúp tăng oxy máu.`
      );
      workoutTips.push(
        `**Tập thở cơ hoành 10 phút**: Thở mím môi và thở bụng nhẹ nhàng, nghỉ ngơi khi SpO2 dưới 95%.`
      );
    } else if (lastSpo2) {
      workoutTips.push(
        `**Hít thở sâu ngoài trời**: Đi bộ ngoài trời kết hợp thở sâu vào sáng sớm 20-30 phút giúp tăng dung tích phổi.`
      );
    }
  }

  if (dietTips.length === 0) {
    dietTips.push(
      `**Chế độ ăn cân bằng**: Ăn nhiều rau xanh, trái cây tươi, đạm nạc và uống đủ 2 lít nước mỗi ngày.`
    );
  }

  if (workoutTips.length === 0) {
    workoutTips.push(
      hasAcuteRestNeeded
        ? `**Nghỉ ngơi theo dõi**: Ưu tiên nghỉ ngơi theo dõi chỉ số trước khi quay lại vận động nhẹ.`
        : `**Vận động đều đặn**: Duy trì đi bộ, đạp xe hoặc yoga 30 phút/ngày, tối thiểu 5 ngày/tuần.`
    );
  }

  return { dietTips, workoutTips };
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

  const { dietTips, workoutTips } = buildMetricCarePlans(grouped);

  md += `### 🥗 Quy trình ăn uống phù hợp\n`;
  for (const tip of dietTips) {
    md += `- ${tip}\n`;
  }
  md += '\n';

  md += `### 🏃 Quy trình tập luyện phù hợp\n`;
  for (const tip of workoutTips) {
    md += `- ${tip}\n`;
  }
  md += '\n';

  md += `### 💡 Lưu ý sinh hoạt & khuyến nghị theo dõi\n`;
  md += `- Ngủ đủ 7–8 tiếng mỗi đêm, giữ tinh thần thư thái và tiếp tục đo các chỉ số vào khung giờ cố định mỗi ngày.\n`;
  md += `- Hãy tham khảo ý kiến bác sĩ chuyên khoa nếu các chỉ số có dấu hiệu bất thường kéo dài hoặc trước khi bắt đầu bài tập cường độ cao.\n`;

  md += SAFETY_DISCLAIMER;
  return md;
};

/** Client factory phục vụ việc mock trong test (SCRUM-59) */
export const geminiClientFactory = {
  createClient: (apiKey) => new GoogleGenerativeAI(apiKey),
};

/**
 * Gọi Gemini API để tóm tắt xu hướng sức khỏe kèm gợi ý quy trình ăn uống & tập luyện.
 * Có cơ chế timeout 10s và fallback rule-based engine nếu API lỗi.
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
        maxOutputTokens: 1800,
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
 * Tính metricsHash từ danh sách các metric types (gắn phiên bản prompt v2)
 */
export const computeMetricsHash = (metricTypes) => {
  return `${[...metricTypes].sort().join(',')}|v2`;
};

// Hàm tương thích cho controllers
export const generateFallbackSummary = (records, memberName = 'bạn') => {
  const grouped = organizeRecordsForPrompt(records);
  return buildFallbackSummary(grouped, memberName);
};

export const generateAiSummaryWithGemini = async (records, memberName = 'bạn') => {
  const result = await generateHealthSummary(records, { name: memberName }, true);
  return result.summary;
};
