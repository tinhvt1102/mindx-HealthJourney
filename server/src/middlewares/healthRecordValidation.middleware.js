import mongoose from 'mongoose';
import { HealthRecord, HEALTH_METRIC_TYPES } from '../models/HealthRecord.js';

/**
 * Kiểm tra các ngưỡng giá trị sinh lý y học để chặn giá trị phi lý
 */
export const validateMetricValues = ({ type, value, systolic, diastolic, unit }) => {
  const errors = {};

  switch (type) {
    case 'BLOOD_PRESSURE': {
      // Cho phép lấy systolic, diastolic trực tiếp hoặc từ object value/values
      const sys = Number(systolic);
      const dia = Number(diastolic);

      if (systolic === undefined || systolic === null || isNaN(sys)) {
        errors.systolic = 'Huyết áp tâm thu (systolic) là bắt buộc và phải là số';
      } else if (sys < 60 || sys > 260) {
        errors.systolic = 'Huyết áp tâm thu phi lý (phải nằm trong khoảng 60 - 260 mmHg)';
      }

      if (diastolic === undefined || diastolic === null || isNaN(dia)) {
        errors.diastolic = 'Huyết áp tâm trương (diastolic) là bắt buộc và phải là số';
      } else if (dia < 40 || dia > 160) {
        errors.diastolic = 'Huyết áp tâm trương phi lý (phải nằm trong khoảng 40 - 160 mmHg)';
      }

      // Quy tắc sinh lý cốt lõi: Tâm thu bắt buộc phải lớn hơn tâm trương
      if (!errors.systolic && !errors.diastolic) {
        if (sys <= dia) {
          errors.bloodPressure = 'Huyết áp phi lý: Chỉ số tâm thu phải lớn hơn chỉ số tâm trương';
        }
      }
      break;
    }

    case 'HEART_RATE': {
      const hr = Number(value);
      if (value === undefined || value === null || isNaN(hr)) {
        errors.value = 'Chỉ số nhịp tim là bắt buộc và phải là số';
      } else if (hr < 30 || hr > 220) {
        errors.value = 'Nhịp tim phi lý (phải nằm trong khoảng 30 - 220 bpm)';
      }
      break;
    }

    case 'BLOOD_SUGAR': {
      const bs = Number(value);
      if (value === undefined || value === null || isNaN(bs)) {
        errors.value = 'Chỉ số đường huyết là bắt buộc và phải là số';
      } else {
        const isMmol = unit && unit.toLowerCase() === 'mmol/l';
        if (isMmol) {
          if (bs < 1.1 || bs > 33.3) {
            errors.value = 'Chỉ số đường huyết phi lý (phải nằm trong khoảng 1.1 - 33.3 mmol/L)';
          }
        } else {
          if (bs < 20 || bs > 600) {
            errors.value = 'Chỉ số đường huyết phi lý (phải nằm trong khoảng 20 - 600 mg/dL)';
          }
        }
      }
      break;
    }

    case 'TEMPERATURE': {
      const temp = Number(value);
      if (value === undefined || value === null || isNaN(temp)) {
        errors.value = 'Chỉ số nhiệt độ là bắt buộc và phải là số';
      } else {
        const isFahrenheit = unit && unit.toUpperCase() === '°F';
        if (isFahrenheit) {
          if (temp < 93.2 || temp > 109.4) {
            errors.value = 'Nhiệt độ cơ thể phi lý (phải nằm trong khoảng 93.2 - 109.4 °F)';
          }
        } else {
          if (temp < 34.0 || temp > 43.0) {
            errors.value = 'Nhiệt độ cơ thể phi lý (phải nằm trong khoảng 34.0 - 43.0 °C)';
          }
        }
      }
      break;
    }

    case 'SPO2': {
      const spo2 = Number(value);
      if (value === undefined || value === null || isNaN(spo2)) {
        errors.value = 'Chỉ số SpO2 là bắt buộc và phải là số';
      } else if (spo2 < 50 || spo2 > 100) {
        errors.value = 'Nồng độ oxy trong máu SpO2 phi lý (phải nằm trong khoảng 50% - 100%)';
      }
      break;
    }

    case 'WEIGHT': {
      const w = Number(value);
      if (value === undefined || value === null || isNaN(w)) {
        errors.value = 'Chỉ số cân nặng là bắt buộc và phải là số';
      } else if (w < 10 || w > 300) {
        errors.value = 'Cân nặng phi lý (phải nằm trong khoảng 10 - 300 kg)';
      }
      break;
    }

    default:
      errors.type = `Loại chỉ số không hợp lệ. Phải là một trong: ${HEALTH_METRIC_TYPES.join(', ')}`;
      break;
  }

  return errors;
};

/**
 * Middleware validate khi tạo mới HealthRecord (POST)
 */
export const validateCreateHealthRecord = (req, res, next) => {
  const { type, value, systolic, diastolic, unit, recordedAt, note } = req.body;
  let errors = {};

  // 1. Kiểm tra type bắt buộc
  if (!type) {
    errors.type = 'Loại chỉ số sức khỏe là bắt buộc';
  } else if (!HEALTH_METRIC_TYPES.includes(type)) {
    errors.type = `Loại chỉ số không hợp lệ. Chỉ chấp nhận: ${HEALTH_METRIC_TYPES.join(', ')}`;
  } else {
    // 2. Validate giá trị cụ thể theo type
    const metricErrors = validateMetricValues({ type, value, systolic, diastolic, unit });
    errors = { ...errors, ...metricErrors };
  }

  // 3. Validate thời gian đo (recordedAt)
  if (recordedAt !== undefined && recordedAt !== null && recordedAt !== '') {
    const parsedDate = new Date(recordedAt);
    if (isNaN(parsedDate.getTime())) {
      errors.recordedAt = 'Thời gian đo không đúng định dạng ngày tháng hợp lệ';
    } else if (parsedDate > new Date()) {
      errors.recordedAt = 'Thời gian đo phi lý (không thể ghi nhận chỉ số ở thời điểm tương lai)';
    }
  }

  // 4. Validate ghi chú (note)
  if (note !== undefined && typeof note === 'string' && note.trim().length > 500) {
    errors.note = 'Ghi chú không được vượt quá 500 ký tự';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu chỉ số sức khỏe không hợp lệ hoặc chứa giá trị phi lý',
      errors,
    });
  }

  next();
};

/**
 * Middleware validate khi cập nhật HealthRecord (PUT)
 */
export const validateUpdateHealthRecord = async (req, res, next) => {
  const { type, value, systolic, diastolic, unit, recordedAt, note } = req.body;
  let errors = {};

  // Nếu có cập nhật type
  if (type !== undefined) {
    if (!HEALTH_METRIC_TYPES.includes(type)) {
      errors.type = `Loại chỉ số không hợp lệ. Chỉ chấp nhận: ${HEALTH_METRIC_TYPES.join(', ')}`;
    }
  }

  // Validate các trường giá trị đo nếu được cung cấp
  if (type || value !== undefined || systolic !== undefined || diastolic !== undefined) {
    let targetType = type;
    let currentRecord = null;

    if (!targetType && req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
      currentRecord = await HealthRecord.findById(req.params.id);
      if (currentRecord) {
        targetType = currentRecord.type;
        req.existingRecord = currentRecord;
      }
    }

    if (targetType) {
      // Nếu chỉ cập nhật 1 trong 2 chỉ số huyết áp, lấy chỉ số còn lại từ record hiện tại để đối chiếu tâm thu > tâm trương
      const sysToCheck = systolic !== undefined ? systolic : currentRecord?.systolic;
      const diaToCheck = diastolic !== undefined ? diastolic : currentRecord?.diastolic;

      const metricErrors = validateMetricValues({
        type: targetType,
        value,
        systolic: sysToCheck,
        diastolic: diaToCheck,
        unit,
      });
      errors = { ...errors, ...metricErrors };
    }
  }

  // Validate thời gian đo
  if (recordedAt !== undefined && recordedAt !== null && recordedAt !== '') {
    const parsedDate = new Date(recordedAt);
    if (isNaN(parsedDate.getTime())) {
      errors.recordedAt = 'Thời gian đo không đúng định dạng ngày tháng hợp lệ';
    } else if (parsedDate > new Date()) {
      errors.recordedAt = 'Thời gian đo phi lý (không thể ghi nhận chỉ số ở thời điểm tương lai)';
    }
  }

  if (note !== undefined && typeof note === 'string' && note.trim().length > 500) {
    errors.note = 'Ghi chú không được vượt quá 500 ký tự';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu cập nhật chỉ số sức khỏe không hợp lệ hoặc chứa giá trị phi lý',
      errors,
    });
  }

  next();
};
