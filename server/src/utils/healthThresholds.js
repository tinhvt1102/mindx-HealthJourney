/**
 * Helper tính toán và phân loại ngưỡng rủi ro y tế cho các chỉ số sức khỏe (Jira SCRUM-52 / SCRUM-53)
 * Đáp ứng các tiêu chí chấp nhận y khoa:
 * - Huyết áp (BLOOD_PRESSURE):
 *   + Bình thường: Tâm thu < 120 và Tâm trương < 80 (Xanh)
 *   + Tiền tăng huyết áp / Lưu ý: Tâm thu 120-139 hoặc Tâm trương 80-89 (Vàng)
 *   + Tăng huyết áp độ 1/2 (Nguy cơ cao): Tâm thu >= 140 hoặc Tâm trương >= 90 (Đỏ)
 *   + Huyết áp thấp: Tâm thu < 90 hoặc Tâm trương < 60 (Vàng)
 * - Nhịp tim (HEART_RATE):
 *   + Bình thường: 60 - 100 bpm (Xanh)
 *   + Chậm: < 60 bpm (Dưới 50 bpm: Cảnh báo Vàng/Đỏ)
 *   + Nhanh: > 100 bpm (Vàng/Đỏ)
 * - Đường huyết (BLOOD_SUGAR):
 *   + Bình thường: 70 - 99 mg/dL (khi đói)
 *   + Tiền tiểu đường: 100 - 125 mg/dL (Vàng)
 *   + Nguy cơ đái tháo đường: >= 126 mg/dL (Đỏ)
 *   + Hạ đường huyết: < 70 mg/dL (Đỏ)
 * - Cân nặng & BMI (WEIGHT):
 *   + Thiếu cân: BMI < 18.5 (Vàng)
 *   + Bình thường / Cân đối: 18.5 - 24.9 (Xanh)
 *   + Thừa cân: 25.0 - 29.9 (Vàng)
 *   + Béo phì: >= 30.0 (Đỏ)
 */

export const RISK_LEVELS = {
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  DANGER: 'DANGER',
};

/**
 * Đánh giá mức độ rủi ro theo loại chỉ số và giá trị đo
 * @param {string} metricType - BLOOD_PRESSURE | HEART_RATE | BLOOD_SUGAR | WEIGHT | TEMPERATURE | SPO2
 * @param {object|number} values - Giá trị đo ({ systolic, diastolic } hoặc value hoặc HealthRecord)
 * @returns {object} { level, label, color, description, badgeText }
 */
export const evaluateMedicalThreshold = (metricType, values) => {
  if (!values) {
    return {
      level: RISK_LEVELS.NORMAL,
      label: 'Chưa có dữ liệu',
      color: 'slate',
      description: 'Chưa có bản ghi đo lường nào',
      badgeText: 'Chưa có dữ liệu',
    };
  }

  switch (metricType) {
    case 'BLOOD_PRESSURE': {
      const systolic = Number(
        values.systolic ?? values.value ?? (values.values && values.values.systolic)
      );
      const diastolic = Number(
        values.diastolic ?? (values.values && values.values.diastolic) ?? 0
      );

      if (isNaN(systolic) || isNaN(diastolic) || (systolic === 0 && diastolic === 0)) {
        return { level: RISK_LEVELS.NORMAL, label: 'Bình thường', color: 'emerald', description: 'Chỉ số bình thường', badgeText: 'Bình thường' };
      }

      if (systolic >= 140 || diastolic >= 90) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Tăng huyết áp',
          color: 'rose',
          description: `Chỉ số ${systolic}/${diastolic} mmHg vượt ngưỡng an toàn (>=140/90). Cần nghỉ ngơi và theo dõi sát.`,
          badgeText: 'Nguy cơ cao (Đỏ)',
        };
      }

      if (systolic >= 120 || diastolic >= 80) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Tiền tăng huyết áp',
          color: 'amber',
          description: `Chỉ số ${systolic}/${diastolic} mmHg ở mức cảnh báo nhẹ (120-139 / 80-89). Cần chú ý giảm muối và vận động.`,
          badgeText: 'Cảnh báo (Vàng)',
        };
      }

      if (systolic < 90 || (diastolic > 0 && diastolic < 60)) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Huyết áp thấp',
          color: 'amber',
          description: `Chỉ số ${systolic}/${diastolic} mmHg thấp hơn bình thường (<90/60). Chú ý bổ sung nước và nghỉ ngơi.`,
          badgeText: 'Huyết áp thấp (Vàng)',
        };
      }

      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Bình thường',
        color: 'emerald',
        description: `Huyết áp ${systolic}/${diastolic} mmHg duy trì trong ngưỡng tối ưu (<120/80).`,
        badgeText: 'Bình thường (Xanh)',
      };
    }

    case 'HEART_RATE': {
      const hr = Number(
        typeof values === 'object'
          ? (values.value ?? (values.values && values.values.value))
          : values
      );
      if (isNaN(hr)) return { level: RISK_LEVELS.NORMAL, label: 'Bình thường', color: 'emerald', badgeText: 'Bình thường' };

      if (hr < 50) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Nhịp tim quá chậm',
          color: 'rose',
          description: `Nhịp tim ${hr} bpm quá thấp (<50 bpm). Cần theo dõi xem có hiện tượng chóng mặt hay mệt mỏi không.`,
          badgeText: 'Quá chậm (Đỏ)',
        };
      }

      if (hr < 60) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Nhịp tim chậm',
          color: 'amber',
          description: `Nhịp tim ${hr} bpm thấp hơn mức thông thường (60-100 bpm). Thường gặp ở người tập thể thao hoặc khi nghỉ sâu.`,
          badgeText: 'Nhịp chậm (Vàng)',
        };
      }

      if (hr > 120) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Nhịp tim quá nhanh',
          color: 'rose',
          description: `Nhịp tim ${hr} bpm rất cao (>120 bpm lúc nghỉ). Cần thả lỏng cơ thể và đo lại sau vài phút.`,
          badgeText: 'Quá nhanh (Đỏ)',
        };
      }

      if (hr > 100) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Nhịp tim nhanh',
          color: 'amber',
          description: `Nhịp tim ${hr} bpm hơi cao (>100 bpm). Có thể do căng thẳng, vận động hoặc dùng caffein.`,
          badgeText: 'Nhịp nhanh (Vàng)',
        };
      }

      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Bình thường',
        color: 'emerald',
        description: `Nhịp tim ${hr} bpm duy trì nhịp xoang đều đặn, tối ưu (60-100 bpm).`,
        badgeText: 'Bình thường (Xanh)',
      };
    }

    case 'BLOOD_SUGAR': {
      const bs = Number(
        typeof values === 'object'
          ? (values.value ?? (values.values && values.values.value))
          : values
      );
      if (isNaN(bs)) return { level: RISK_LEVELS.NORMAL, label: 'Bình thường', color: 'emerald', badgeText: 'Bình thường' };

      if (bs < 70) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Hạ đường huyết',
          color: 'rose',
          description: `Đường huyết ${bs} mg/dL quá thấp (<70 mg/dL). Cần bổ sung ngay đồ uống có đường hoặc thức ăn nhẹ.`,
          badgeText: 'Hạ đường huyết (Đỏ)',
        };
      }

      if (bs >= 126) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Đường huyết cao',
          color: 'rose',
          description: `Đường huyết ${bs} mg/dL ở mức nguy cơ đái tháo đường (>=126 mg/dL khi đói). Nên thăm khám bác sĩ.`,
          badgeText: 'Đường huyết cao (Đỏ)',
        };
      }

      if (bs >= 100) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Tiền tiểu đường',
          color: 'amber',
          description: `Đường huyết ${bs} mg/dL hơi cao (100-125 mg/dL). Cần giảm đồ ngọt, tinh bột nhanh và tăng cường vận động.`,
          badgeText: 'Cảnh báo (Vàng)',
        };
      }

      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Bình thường',
        color: 'emerald',
        description: `Đường huyết ${bs} mg/dL trong giới hạn an toàn (70-99 mg/dL).`,
        badgeText: 'Bình thường (Xanh)',
      };
    }

    case 'WEIGHT': {
      const bmi = Number(
        typeof values === 'object'
          ? (values.bmi ?? (values.values && values.values.bmi) ?? values.value)
          : values
      );

      if (isNaN(bmi)) {
        return { level: RISK_LEVELS.NORMAL, label: 'Cân đối', color: 'emerald', badgeText: 'Bình thường' };
      }

      if (bmi >= 30.0) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Béo phì',
          color: 'rose',
          description: `Chỉ số BMI ${bmi} ở mức béo phì (>=30). Tăng nguy cơ tim mạch và chuyển hóa.`,
          badgeText: 'Béo phì (Đỏ)',
        };
      }

      if (bmi >= 25.0) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Thừa cân',
          color: 'amber',
          description: `Chỉ số BMI ${bmi} ở mức thừa cân (25.0 - 29.9). Cần cân đối khẩu phần ăn và tăng vận động.`,
          badgeText: 'Thừa cân (Vàng)',
        };
      }

      if (bmi < 18.5) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Thiếu cân',
          color: 'amber',
          description: `Chỉ số BMI ${bmi} dưới chuẩn (<18.5). Cần bổ sung dinh dưỡng và rèn luyện thể lực.`,
          badgeText: 'Thiếu cân (Vàng)',
        };
      }

      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Cân đối',
        color: 'emerald',
        description: `Chỉ số BMI ${bmi} nằm trong khoảng chuẩn cân đối (18.5 - 24.9).`,
        badgeText: 'Vóc dáng chuẩn (Xanh)',
      };
    }

    case 'TEMPERATURE': {
      const temp = Number(
        typeof values === 'object'
          ? (values.value ?? (values.values && values.values.value))
          : values
      );
      if (isNaN(temp)) return { level: RISK_LEVELS.NORMAL, label: 'Bình thường', color: 'emerald', badgeText: 'Bình thường' };
      if (temp >= 38.5) {
        return { level: RISK_LEVELS.DANGER, label: 'Sốt cao', color: 'rose', description: `Thân nhiệt ${temp}°C ở mức sốt cao. Cần hạ sốt kịp thời.`, badgeText: 'Sốt cao (Đỏ)' };
      }
      if (temp >= 37.5) {
        return { level: RISK_LEVELS.WARNING, label: 'Sốt nhẹ', color: 'amber', description: `Thân nhiệt ${temp}°C hơi sốt. Cần uống nhiều nước.`, badgeText: 'Sốt nhẹ (Vàng)' };
      }
      if (temp < 35.5) {
        return { level: RISK_LEVELS.WARNING, label: 'Hạ thân nhiệt', color: 'amber', description: `Thân nhiệt ${temp}°C thấp. Cần giữ ấm.`, badgeText: 'Hạ nhiệt (Vàng)' };
      }
      return { level: RISK_LEVELS.NORMAL, label: 'Bình thường', color: 'emerald', description: `Thân nhiệt ${temp}°C ổn định.`, badgeText: 'Bình thường (Xanh)' };
    }

    case 'SPO2': {
      const spo2 = Number(
        typeof values === 'object'
          ? (values.value ?? (values.values && values.values.value))
          : values
      );
      if (isNaN(spo2)) return { level: RISK_LEVELS.NORMAL, label: 'Bình thường', color: 'emerald', badgeText: 'Bình thường' };
      if (spo2 < 90) {
        return { level: RISK_LEVELS.DANGER, label: 'Thiếu oxy nghiêm trọng', color: 'rose', description: `Nồng độ SpO2 ${spo2}% rất nguy hiểm. Cần can thiệp y tế khẩn cấp.`, badgeText: 'Thiếu oxy nặng (Đỏ)' };
      }
      if (spo2 < 95) {
        return { level: RISK_LEVELS.WARNING, label: 'SpO2 thấp', color: 'amber', description: `Nồng độ SpO2 ${spo2}% thấp hơn chuẩn (95-100%). Cần theo dõi nhịp thở.`, badgeText: 'SpO2 thấp (Vàng)' };
      }
      return { level: RISK_LEVELS.NORMAL, label: 'Bình thường', color: 'emerald', description: `Nồng độ SpO2 ${spo2}% bão hòa tốt.`, badgeText: 'Tối ưu (Xanh)' };
    }

    default:
      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Ổn định',
        color: 'emerald',
        description: 'Chỉ số ở mức bình thường',
        badgeText: 'Bình thường',
      };
  }
};
