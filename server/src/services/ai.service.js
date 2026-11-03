import { evaluateMedicalThreshold } from '../utils/healthThresholds.js';

export const MANDATORY_DISCLAIMER = 'Bản tóm tắt chỉ mang tính chất tham khảo, không thay thế cho chẩn đoán của bác sĩ chuyên khoa.';

/**
 * Xây dựng báo cáo phân tích xu hướng dạng Rule-based thông minh
 * Dùng làm fallback khi Gemini API gặp sự cố hoặc chưa cấu hình API key
 */
export function generateFallbackSummary(records, memberName = 'bạn') {
  const metricsByType = {};
  for (const r of records) {
    if (!metricsByType[r.type]) metricsByType[r.type] = [];
    metricsByType[r.type].push(r);
  }

  const trends = [];
  const positives = [];
  const suggestions = [];

  // 1. Phân tích Huyết áp
  if (metricsByType['BLOOD_PRESSURE'] && metricsByType['BLOOD_PRESSURE'].length > 0) {
    const bpList = metricsByType['BLOOD_PRESSURE'];
    const latestBp = bpList[bpList.length - 1];
    const evalBp = evaluateMedicalThreshold('BLOOD_PRESSURE', latestBp);

    if (evalBp.level === 'DANGER') {
      trends.push(`Huyết áp đo gần nhất ở mức **${latestBp.systolic}/${latestBp.diastolic} mmHg** (${evalBp.label} - Nguy cơ cao).`);
      suggestions.push('Chỉ số huyết áp tâm thu/tâm trương đang cao hơn ngưỡng an toàn. Cần hạn chế thức ăn mặn, giảm căng thẳng và tham khảo ý kiến bác sĩ.');
    } else if (evalBp.level === 'WARNING') {
      trends.push(`Huyết áp ghi nhận **${latestBp.systolic}/${latestBp.diastolic} mmHg** (${evalBp.label}).`);
      suggestions.push('Cần theo dõi huyết áp định kỳ hàng ngày vào cùng một khung giờ để nhận biết sự dao động.');
    } else {
      trends.push(`Huyết áp tâm thu và tâm trương duy trì ổn định ở mức **${latestBp.systolic}/${latestBp.diastolic} mmHg**.`);
      positives.push('Chỉ số huyết áp kiểm soát rất tốt trong ngưỡng tối ưu y khoa (<120/80 mmHg).');
    }
  }

  // 2. Phân tích Nhịp tim
  if (metricsByType['HEART_RATE'] && metricsByType['HEART_RATE'].length > 0) {
    const hrList = metricsByType['HEART_RATE'];
    const avgHr = Math.round(hrList.reduce((acc, cur) => acc + (cur.value || 0), 0) / hrList.length);
    const latestHr = hrList[hrList.length - 1];
    const evalHr = evaluateMedicalThreshold('HEART_RATE', latestHr);

    trends.push(`Nhịp tim trung bình trong các lần đo gần đây đạt **${avgHr} bpm** (Lần đo mới nhất: ${latestHr.value} bpm).`);
    if (evalHr.level === 'NORMAL') {
      positives.push(`Nhịp tim đều đặn (${latestHr.value} bpm), phản ánh thể trạng tim mạch khi nghỉ ngơi đang hồi phục tốt.`);
    } else {
      suggestions.push(`Nhịp tim ${latestHr.value} bpm (${evalHr.label}). Tránh dùng nhiều caffein, ngủ đủ 7-8 tiếng mỗi đêm.`);
    }
  }

  // 3. Phân tích Đường huyết
  if (metricsByType['BLOOD_SUGAR'] && metricsByType['BLOOD_SUGAR'].length > 0) {
    const bsList = metricsByType['BLOOD_SUGAR'];
    const latestBs = bsList[bsList.length - 1];
    const evalBs = evaluateMedicalThreshold('BLOOD_SUGAR', latestBs);

    trends.push(`Chỉ số đường huyết gần nhất đo được là **${latestBs.value} mg/dL**.`);
    if (evalBs.level === 'NORMAL') {
      positives.push('Mức đường huyết lúc đói được kiểm soát ổn định trong giới hạn an toàn (70 - 99 mg/dL).');
    } else {
      suggestions.push(`Đường huyết ở mức cảnh báo (${latestBs.value} mg/dL). Nên duy trì chế độ ăn giàu chất xơ và hạn chế đồ ngọt.`);
    }
  }

  // 4. Phân tích Cân nặng & BMI
  if (metricsByType['WEIGHT'] && metricsByType['WEIGHT'].length > 0) {
    const wList = metricsByType['WEIGHT'];
    const latestW = wList[wList.length - 1];
    const evalW = evaluateMedicalThreshold('WEIGHT', latestW);

    trends.push(`Cân nặng hiện tại ghi nhận **${latestW.value} kg**${latestW.bmi ? ` (BMI: ${latestW.bmi})` : ''}.`);
    if (evalW.level === 'NORMAL') {
      positives.push('Chỉ số thể trọng và BMI ở mức cân đối lý tưởng.');
    } else {
      suggestions.push(`Thể trạng ${evalW.label}. Khuyến nghị tăng cường vận động vừa sức 30 phút mỗi ngày.`);
    }
  }

  // Đảm bảo luôn có nội dung tối thiểu
  if (positives.length === 0) {
    positives.push('Duy trì thói quen đo và ghi nhật ký sức khỏe liên tục giúp theo dõi sát sao tiến triển thể trạng.');
  }
  if (suggestions.length === 0) {
    suggestions.push('Tiếp tục duy trì chế độ sinh hoạt lành mạnh, uống đủ 2 lít nước mỗi ngày và ngủ đủ giấc.');
  }

  const markdown = `
### 1. Xu hướng chính
${trends.map((t) => `- ${t}`).join('\n')}

### 2. Điểm tích cực
${positives.map((p) => `- ${p}`).join('\n')}

### 3. Lưu ý sinh hoạt & Đề xuất
${suggestions.map((s) => `- ${s}`).join('\n')}

---
> ⚠️ **Lưu ý y tế:** ${MANDATORY_DISCLAIMER}
`.trim();

  return markdown;
}

/**
 * Gọi Gemini API nếu có GEMINI_API_KEY, ngược lại dùng fallback
 */
export async function generateAiSummaryWithGemini(records, memberName = 'bạn') {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return generateFallbackSummary(records, memberName);
  }

  try {
    const prompt = `
Bạn là Trợ lý Sức khỏe AI của ứng dụng y tế HealthJourney.
Nhiệm vụ của bạn là phân tích xu hướng dữ liệu đo sức khỏe của thành viên "${memberName}" dựa trên lịch sử đo lường sau:

Dữ liệu đo (${records.length} bản ghi gần nhất):
${records.map((r) => `- Ngày: ${new Date(r.recordedAt).toISOString().split('T')[0]}, Loại: ${r.type}, Giá trị: ${r.systolic ? `${r.systolic}/${r.diastolic} mmHg` : `${r.value} ${r.unit || ''}`}${r.bmi ? `, BMI: ${r.bmi}` : ''}`).join('\n')}

YÊU CẦU ĐỊNH DẠNG ĐẦU RA:
- Bằng tiếng Việt chuẩn mực, ân cần, súc tích.
- Bắt buộc tuân thủ đúng 3 đề mục Markdown:
### 1. Xu hướng chính
(Tóm tắt diễn biến tăng/giảm, ổn định của các chỉ số)

### 2. Điểm tích cực
(Những điểm khả quan, chỉ số đạt chuẩn hoặc cải thiện tốt)

### 3. Lưu ý sinh hoạt & Đề xuất
(Lời khuyên dinh dưỡng, nghỉ ngơi, vận động phù hợp)

- BẮT BUỘC kết thúc báo cáo bằng câu Disclaimer sau nguyên văn:
> ⚠️ **Lưu ý y tế:** ${MANDATORY_DISCLAIMER}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      console.warn(`Gemini API returned status ${response.status}, fallback to rule engine.`);
      return generateFallbackSummary(records, memberName);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || text.trim().length === 0) {
      return generateFallbackSummary(records, memberName);
    }

    // Đảm bảo luôn có disclaimer ngay cả khi LLM lược bớt
    let finalizedText = text.trim();
    if (!finalizedText.includes(MANDATORY_DISCLAIMER)) {
      finalizedText += `\n\n---\n> ⚠️ **Lưu ý y tế:** ${MANDATORY_DISCLAIMER}`;
    }

    return finalizedText;
  } catch (err) {
    console.error('Lỗi khi gọi Gemini API, chuyển sang fallback:', err.message);
    return generateFallbackSummary(records, memberName);
  }
}
