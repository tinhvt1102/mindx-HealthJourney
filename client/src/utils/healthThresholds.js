/**
 * Frontend helper tính toán và phân loại ngưỡng rủi ro y tế cho các chỉ số sức khỏe (Jira SCRUM-52 / SCRUM-53)
 */

export const RISK_LEVELS = {
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  DANGER: 'DANGER',
};

export const evaluateMedicalThreshold = (metricType, values) => {
  if (!values) {
    return {
      level: RISK_LEVELS.NORMAL,
      label: 'Chưa có dữ liệu',
      color: 'slate',
      description: 'Chưa có bản ghi đo lường nào',
      badgeText: 'Chưa có dữ liệu',
      bgClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  switch (metricType) {
    case 'BLOOD_PRESSURE': {
      const systolic = Number(values.systolic || values.value);
      const diastolic = Number(values.diastolic || 0);

      if (isNaN(systolic) || isNaN(diastolic)) {
        return {
          level: RISK_LEVELS.NORMAL,
          label: 'Bình thường',
          color: 'emerald',
          description: 'Chỉ số bình thường',
          badgeText: 'Bình thường',
          bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      }

      if (systolic >= 140 || diastolic >= 90) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Tăng huyết áp',
          color: 'rose',
          description: `Chỉ số ${systolic}/${diastolic} mmHg vượt ngưỡng an toàn (>=140/90). Cần theo dõi sát.`,
          badgeText: 'Nguy cơ cao (Đỏ)',
          bgClass: 'bg-rose-50 text-rose-700 border-rose-300',
        };
      }

      if (systolic >= 120 || diastolic >= 80) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Tiền tăng huyết áp',
          color: 'amber',
          description: `Chỉ số ${systolic}/${diastolic} mmHg ở mức cảnh báo nhẹ (120-139 / 80-89).`,
          badgeText: 'Cảnh báo (Vàng)',
          bgClass: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      }

      if (systolic < 90 || (diastolic > 0 && diastolic < 60)) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Huyết áp thấp',
          color: 'amber',
          description: `Chỉ số ${systolic}/${diastolic} mmHg thấp hơn mức bình thường (<90/60).`,
          badgeText: 'Huyết áp thấp (Vàng)',
          bgClass: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      }

      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Tối ưu',
        color: 'emerald',
        description: `Huyết áp ${systolic}/${diastolic} mmHg trong ngưỡng tối ưu (<120/80).`,
        badgeText: 'Bình thường (Xanh)',
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }

    case 'HEART_RATE': {
      const hr = Number(typeof values === 'object' ? values.value : values);
      if (isNaN(hr)) {
        return {
          level: RISK_LEVELS.NORMAL,
          label: 'Bình thường',
          color: 'emerald',
          badgeText: 'Bình thường',
          bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      }

      if (hr < 50) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Quá chậm (<50)',
          color: 'rose',
          description: `Nhịp tim ${hr} bpm quá thấp (<50 bpm). Cần chú ý theo dõi.`,
          badgeText: 'Quá chậm (Đỏ)',
          bgClass: 'bg-rose-50 text-rose-700 border-rose-300',
        };
      }

      if (hr < 60) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Nhịp chậm',
          color: 'amber',
          description: `Nhịp tim ${hr} bpm thấp hơn mức thông thường (60-100 bpm).`,
          badgeText: 'Nhịp chậm (Vàng)',
          bgClass: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      }

      if (hr > 120) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Quá nhanh (>120)',
          color: 'rose',
          description: `Nhịp tim ${hr} bpm rất cao (>120 bpm lúc nghỉ).`,
          badgeText: 'Quá nhanh (Đỏ)',
          bgClass: 'bg-rose-50 text-rose-700 border-rose-300',
        };
      }

      if (hr > 100) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Nhịp nhanh (>100)',
          color: 'amber',
          description: `Nhịp tim ${hr} bpm hơi cao (>100 bpm).`,
          badgeText: 'Nhịp nhanh (Vàng)',
          bgClass: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      }

      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Bình thường',
        color: 'emerald',
        description: `Nhịp tim ${hr} bpm duy trì nhịp xoang đều đặn, tối ưu (60-100 bpm).`,
        badgeText: 'Bình thường (Xanh)',
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }

    case 'BLOOD_SUGAR': {
      const bs = Number(typeof values === 'object' ? values.value : values);
      if (isNaN(bs)) {
        return {
          level: RISK_LEVELS.NORMAL,
          label: 'Bình thường',
          color: 'emerald',
          badgeText: 'Bình thường',
          bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      }

      if (bs < 70) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Hạ đường huyết (<70)',
          color: 'rose',
          description: `Đường huyết ${bs} mg/dL quá thấp (<70 mg/dL). Cần bổ sung đường ngay.`,
          badgeText: 'Hạ đường huyết (Đỏ)',
          bgClass: 'bg-rose-50 text-rose-700 border-rose-300',
        };
      }

      if (bs >= 126) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Đường huyết cao (>=126)',
          color: 'rose',
          description: `Đường huyết ${bs} mg/dL ở mức nguy cơ đái tháo đường khi đói.`,
          badgeText: 'Đường huyết cao (Đỏ)',
          bgClass: 'bg-rose-50 text-rose-700 border-rose-300',
        };
      }

      if (bs >= 100) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Tiền tiểu đường (100-125)',
          color: 'amber',
          description: `Đường huyết ${bs} mg/dL ở mức tiền tiểu đường.`,
          badgeText: 'Cảnh báo (Vàng)',
          bgClass: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      }

      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Bình thường',
        color: 'emerald',
        description: `Đường huyết ${bs} mg/dL trong ngưỡng lý tưởng (70-99 mg/dL).`,
        badgeText: 'Bình thường (Xanh)',
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }

    case 'WEIGHT': {
      const bmi = Number(typeof values === 'object' ? (values.bmi || values.value) : values);

      if (isNaN(bmi)) {
        return {
          level: RISK_LEVELS.NORMAL,
          label: 'Bình thường',
          color: 'emerald',
          badgeText: 'Bình thường',
          bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      }

      if (bmi >= 30.0) {
        return {
          level: RISK_LEVELS.DANGER,
          label: 'Béo phì (BMI >=30)',
          color: 'rose',
          description: `Chỉ số BMI ${bmi} ở mức béo phì. Cần có kế hoạch dinh dưỡng y tế.`,
          badgeText: 'Béo phì (Đỏ)',
          bgClass: 'bg-rose-50 text-rose-700 border-rose-300',
        };
      }

      if (bmi >= 25.0) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Thừa cân (BMI 25-29.9)',
          color: 'amber',
          description: `Chỉ số BMI ${bmi} ở mức thừa cân.`,
          badgeText: 'Thừa cân (Vàng)',
          bgClass: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      }

      if (bmi < 18.5) {
        return {
          level: RISK_LEVELS.WARNING,
          label: 'Thiếu cân (BMI <18.5)',
          color: 'amber',
          description: `Chỉ số BMI ${bmi} ở mức thiếu cân. Cần bổ sung dinh dưỡng.`,
          badgeText: 'Thiếu cân (Vàng)',
          bgClass: 'bg-amber-50 text-amber-800 border-amber-300',
        };
      }

      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Cân đối (BMI 18.5-24.9)',
        color: 'emerald',
        description: `Chỉ số BMI ${bmi} nằm trong khoảng chuẩn cân đối.`,
        badgeText: 'Vóc dáng chuẩn (Xanh)',
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }

    default:
      return {
        level: RISK_LEVELS.NORMAL,
        label: 'Ổn định',
        color: 'emerald',
        description: 'Chỉ số ở mức an toàn',
        badgeText: 'Bình thường',
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
  }
};
