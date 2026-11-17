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
- Trả về BẮT BUỘC bằng tiếng Việt có dấu, văn phong y tế ân cần, thực tế và dễ áp dụng.
- KHÔNG sử dụng xưng hô ngôi thứ nhất ("tôi", "chúng tôi").
- CHỈ phân tích và đề xuất dựa trên đúng các nhóm dữ liệu có mặt ở phần DỮ LIỆU ĐO LƯỜNG bên dưới.
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
        `**Kiểm soát muối theo chế độ DASH (Huyết áp ${sys}/${dia} mmHg)**: Giảm lượng muối dưới 5g/ngày (~1 thìa cà phê), hạn chế đồ muối chua, nước mắm mặn, thực phẩm đóng hộp; ưu tiên rau lá xanh, chuối, bơ, cá béo giàu Omega-3 và Kali.`
      );
      if (sys >= 160 || dia >= 100) {
        hasAcuteRestNeeded = true;
        workoutTips.push(
          `**Vận động an toàn khi huyết áp cao (${sys}/${dia} mmHg)**: Tạm ngưng bài tập nặng hoặc nín thở nâng tạ; ưu tiên nghỉ ngơi, tập hít thở sâu (4 giây hít vào - 6 giây thở ra) trong 10 phút và hỏi ý kiến bác sĩ trước khi tập lại.`
        );
      } else {
        workoutTips.push(
          `**Cardio cường độ nhẹ - vừa (Huyết áp ${sys}/${dia} mmHg)**: Đi bộ nhanh, đạp xe thư giãn hoặc Thái cực quyền **25–30 phút/buổi, 5 buổi/tuần**; khởi động kỹ 5 phút và tránh thay đổi tư thế đột ngột.`
        );
      }
    } else if (sys > 0 && sys < 90) {
      dietTips.push(
        `**Bổ sung nước & điện giải (Huyết áp thấp ${sys}/${dia} mmHg)**: Uống đủ 2–2.2 lít nước/ngày, có thể dùng thêm trà gừng ấm buổi sáng, chia nhỏ 4–5 bữa tránh tụt áp sau ăn.`
      );
      workoutTips.push(
        `**Tập nhẹ tăng tuần hoàn**: Tập yoga cơ bản hoặc đi bộ nhẹ 20–25 phút/ngày; đứng dậy từ từ sau khi nằm/ngồi và ngừng tập ngay nếu thấy chóng mặt.`
      );
    } else {
      dietTips.push(
        `**Dinh dưỡng bảo vệ tim mạch (Huyết áp ổn định ${sys}/${dia} mmHg)**: Duy trì khẩu phần ít chất béo bão hòa, ăn nhạt vừa phải, tối thiểu 300–400g rau củ và trái cây mỗi ngày.`
      );
      workoutTips.push(
        `**Duy trì thể lực tim mạch**: Đi bộ nhanh, bơi lội hoặc đạp xe **30 phút/ngày (tối thiểu 150 phút/tuần)** ở cường độ vừa phải.`
      );
    }
  }

  if (grouped.HEART_RATE) {
    const readings = grouped.HEART_RATE.readings;
    const lastHr = readings[readings.length - 1]?.value ?? calcStats(readings.map((r) => r.value)).avg;
    const evalHr = evaluateMedicalThreshold('HEART_RATE', { value: lastHr });

    if (lastHr > 100 || evalHr.level === 'DANGER') {
      dietTips.push(
        `**Làm dịu nhịp tim (Nhịp tim ${lastHr} bpm)**: Hạn chế cà phê đặc, trà đậm, nước tăng lực và rượu bia; tăng cường thực phẩm giàu Magie & Kali như các loại hạt, yến mạch, rau bina.`
      );
      workoutTips.push(
        `**Bài tập điều hòa nhịp tim**: Ưu tiên yoga giãn cơ nhẹ và tập thở sâu **15–20 phút/ngày**; giữ nhịp tim mục tiêu ở vùng nhẹ, tránh chạy nước rút hoặc HIIT lúc này.`
      );
    } else {
      dietTips.push(
        `**Hỗ trợ sức bền tim (Nhịp tim ${lastHr} bpm)**: Bổ sung đạm sạch (cá hồi, ức gà, đậu nành), vitamin nhóm B và uống đủ nước trước/sau khi vận động.`
      );
      workoutTips.push(
        `**Rèn luyện nhịp tim vùng hiếu khí (Zone 2)**: Chạy bộ chậm, đạp xe hoặc nhảy dây nhẹ **30–40 phút/buổi, 3–4 buổi/tuần** giúp cơ tim bơm máu hiệu quả hơn.`
      );
    }
  }

  if (grouped.BLOOD_SUGAR) {
    const readings = grouped.BLOOD_SUGAR.readings;
    const lastBs = readings[readings.length - 1]?.value ?? calcStats(readings.map((r) => r.value)).avg;

    if (lastBs >= 126) {
      dietTips.push(
        `**Thực đơn chỉ số đường huyết thấp Low-GI (Đường huyết ${lastBs} mg/dL)**: Thay cơm trắng/bánh mì trắng bằng gạo lứt, khoai lang, yến mạch; áp dụng quy tắc ăn **Rau xanh trước -> Đạm -> Tinh bột sau**, tránh hoàn toàn nước ngọt có ga và bánh kẹo.`
      );
      workoutTips.push(
        `**Vận động hạ đường huyết sau ăn**: Đi bộ nhẹ nhàng **15–20 phút sau bữa ăn chính khoảng 30 phút**, kết hợp 2–3 buổi tập kháng lực nhẹ (squat ghế, tạ tay nhẹ) mỗi tuần để tăng độ nhạy Insulin.`
      );
    } else if (lastBs > 0 && lastBs < 70) {
      dietTips.push(
        `**Ổn định đường huyết tránh hạ đường (Đường huyết ${lastBs} mg/dL)**: Không bỏ bữa; mang theo 1–2 viên kẹo hoặc gói sữa nhỏ, ăn kết hợp tinh bột phức + đạm vào các bữa phụ.`
      );
      workoutTips.push(
        `**An toàn đường huyết khi tập**: Không tập luyện khi bụng đói; ăn nhẹ 1 quả chuối hoặc lát bánh mì nguyên cám trước buổi tập nhẹ 20–30 phút.`
      );
    } else {
      dietTips.push(
        `**Cân bằng đường huyết (${lastBs} mg/dL)**: Chia bữa ăn hợp lý, ưu tiên chất xơ hòa tan và hạn chế đường tinh luyện dưới 25g/ngày.`
      );
      workoutTips.push(
        `**Vận động chuyển hóa**: Duy trì đi bộ nhanh hoặc tập thể dục toàn thân **30 phút/ngày, 5 ngày/tuần**.`
      );
    }
  }

  if (grouped.WEIGHT) {
    const readings = grouped.WEIGHT.readings;
    const last = readings[readings.length - 1];
    const lastW = last?.value;
    const bmi = last?.bmi;

    if (bmi && bmi >= 25) {
      dietTips.push(
        `**Chế độ kiểm soát cân nặng (Cân nặng ${lastW} kg, BMI ${bmi})**: Tạo mức thâm hụt calo an toàn ~300–400 kcal/ngày bằng cách giảm tinh bột buổi tối và đồ chiên rán; giữ 1/2 đĩa ăn là rau xanh, 1/4 đạm nạc (cá, ức gà, trứng), 1/4 tinh bột chậm.`
      );
      workoutTips.push(
        `**Lịch đốt mỡ bảo vệ khớp (BMI ${bmi})**: Tập **45 phút/buổi, 4–5 buổi/tuần** gồm 30 phút đi bộ nhanh/bơi lội/đạp xe (ít chấn động khớp gối) + 15 phút tập cơ cốt lõi (Plank, nâng tạ nhẹ).`
      );
    } else if (bmi && bmi < 18.5) {
      dietTips.push(
        `**Chế độ tăng cân lành mạnh (Cân nặng ${lastW} kg, BMI ${bmi})**: Tăng nhẹ năng lượng với 3 bữa chính + 2 bữa phụ (sinh tố bơ/chuối, sữa chua hạt óc chó, phô mai), đảm bảo đủ 1.2–1.5g đạm/kg cân nặng mỗi ngày.`
      );
      workoutTips.push(
        `**Tập kháng lực phát triển cơ bắp**: Tập sức mạnh (chống đẩy, squat, tạ nhẹ) **30–40 phút/buổi, 3 buổi/tuần**, hạn chế cardio kéo dài gây tiêu hao calo quá mức.`
      );
    } else {
      dietTips.push(
        `**Duy trì vóc dáng cân đối (${lastW} kg${bmi ? `, BMI ${bmi}` : ''})**: Ăn đa dạng 4 nhóm chất, đúng giờ và hạn chế ăn khuya sau 20h.`
      );
      workoutTips.push(
        `**Lịch rèn luyện toàn diện**: Kết hợp **3 buổi Cardio (30 phút)** và **2 buổi tập sức mạnh / giãn cơ (30 phút)** mỗi tuần.`
      );
    }
  }

  if (grouped.TEMPERATURE) {
    const lastTemp = grouped.TEMPERATURE.readings[grouped.TEMPERATURE.readings.length - 1]?.value;
    if (lastTemp >= 37.5) {
      hasAcuteRestNeeded = true;
      dietTips.push(
        `**Bù nước khi thân nhiệt tăng (${lastTemp}°C)**: Uống nhiều nước ấm, oresol hoặc nước cam tươi bổ sung Vitamin C; ăn thức ăn mềm, dễ tiêu như cháo thịt băm, súp gà.`
      );
      workoutTips.push(
        `**Ưu tiên nghỉ ngơi (Thân nhiệt ${lastTemp}°C)**: Tạm ngưng hoàn toàn các bài tập thể lực cho tới khi thân nhiệt trở về bình thường ít nhất 24 giờ.`
      );
    }
  }

  if (grouped.SPO2) {
    const lastSpo2 = grouped.SPO2.readings[grouped.SPO2.readings.length - 1]?.value;
    if (lastSpo2 && lastSpo2 < 94) {
      hasAcuteRestNeeded = true;
      dietTips.push(
        `**Tăng cường tuần hoàn oxy (SpO₂ ${lastSpo2}%)**: Bổ sung thực phẩm giàu sắt và chất chống oxy hóa (thịt đỏ nạc, rau dền, cải bó xôi, quả mọng), giữ môi trường sống thoáng khí.`
      );
      workoutTips.push(
        `**Bài tập phục hồi hô hấp (SpO₂ ${lastSpo2}%)**: Tập thở mím môi và thở cơ hoành nhẹ nhàng **5–10 phút x 2–3 lần/ngày**; tránh tập gắng sức khi SpO₂ chưa đạt >= 95%.`
      );
    } else if (lastSpo2) {
      workoutTips.push(
        `**Tăng dung tích phổi (SpO₂ tốt ${lastSpo2}%)**: Kết hợp bài tập hít thở sâu khi đi bộ ngoài trời vào buổi sáng sớm 20–30 phút.`
      );
    }
  }

  if (dietTips.length === 0) {
    dietTips.push(
      `Duy trì chế độ ăn cân bằng nhiều rau xanh, trái cây tươi, đạm nạc và uống tối thiểu 1.5–2 lít nước mỗi ngày.`
    );
  }

  if (workoutTips.length === 0) {
    workoutTips.push(
      hasAcuteRestNeeded
        ? `Ưu tiên nghỉ ngơi theo dõi chỉ số trước khi quay lại vận động nhẹ.`
        : `Duy trì vận động thể chất nhẹ đến vừa **30 phút/ngày, tối thiểu 5 ngày/tuần** (đi bộ, đạp xe, yoga hoặc giãn cơ).`
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
