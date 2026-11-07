import { Family } from '../models/Family.js';
import { SharingPolicy } from '../models/SharingPolicy.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { sendCriticalAlertEmail } from './email.service.js';

/**
 * Kiểm tra xem một bản ghi chỉ số sức khỏe có đạt ngưỡng nguy kịch y tế hay không (SCRUM-62)
 * @param {string} metricType - BLOOD_PRESSURE | HEART_RATE | BLOOD_SUGAR | SPO2 | TEMPERATURE | WEIGHT
 * @param {object} record - Bản ghi HealthRecord
 * @returns {object} { isCritical, label, valueString, description, instructions }
 */
export const checkCriticalThreshold = (metricType, record) => {
  if (!record) return { isCritical: false };

  switch (metricType) {
    case 'BLOOD_PRESSURE': {
      const systolic = Number(record.systolic ?? record.value ?? 0);
      const diastolic = Number(record.diastolic ?? 0);

      // Cơn tăng huyết áp cấp cứu: >= 160/100 mmHg hoặc hạ huyết áp sốc < 85/55 mmHg
      if (systolic >= 160 || diastolic >= 100) {
        return {
          isCritical: true,
          label: 'Huyết áp nguy kịch',
          valueString: `${systolic}/${diastolic} mmHg`,
          description: `Huyết áp tâm thu/tâm trương (${systolic}/${diastolic} mmHg) vượt ngưỡng nguy hiểm >= 160/100 mmHg. Nguy cơ đột quỵ hoặc suy tim cấp!`,
          instructions: '1. Đặt người bệnh nằm nghỉ ở nơi yên tĩnh, đầu cao 30 độ. 2. Không uống nước ngọt hay tự ý dùng thuốc ngoài chỉ định. 3. Đo lại sau 5 phút, nếu không giảm hãy gọi 115 ngay.',
        };
      }
      if ((systolic > 0 && systolic < 85) || (diastolic > 0 && diastolic < 55)) {
        return {
          isCritical: true,
          label: 'Huyết áp tụt nguy hiểm',
          valueString: `${systolic}/${diastolic} mmHg`,
          description: `Huyết áp (${systolic}/${diastolic} mmHg) tụt sâu dưới mức 85/55 mmHg. Nguy cơ trụy mạch hoặc ngất xỉu.`,
          instructions: '1. Đặt người bệnh nằm đầu bằng, kê cao chân 30 độ. 2. Uống trà gừng ấm hoặc nước đường ấm. 3. Nếu lơ mơ, liên hệ cơ sở y tế gần nhất.',
        };
      }
      break;
    }

    case 'HEART_RATE': {
      const hr = Number(record.value ?? 0);
      if (hr > 130) {
        return {
          isCritical: true,
          label: 'Nhịp tim nhanh nguy kịch',
          valueString: `${hr} bpm`,
          description: `Nhịp tim (${hr} bpm) vượt quá 130 bpm khi nghỉ ngơi. Nguy cơ loạn nhịp tim hoặc rung nhĩ cấp.`,
          instructions: '1. Yêu cầu người bệnh hít sâu thở chậm, thả lỏng cơ thể. 2. Không vận động mạnh. 3. Theo dõi nếu kèm khó thở hoặc đau ngực, cần cấp cứu ngay.',
        };
      }
      if (hr > 0 && hr < 45) {
        return {
          isCritical: true,
          label: 'Nhịp tim chậm nguy kịch',
          valueString: `${hr} bpm`,
          description: `Nhịp tim (${hr} bpm) dưới 45 bpm. Nguy cơ ngưng tim hoặc block tim.`,
          instructions: '1. Giữ ấm cơ thể, cho người bệnh nằm nghỉ. 2. Kiểm tra tri giác và mạch cảnh. 3. Đưa đi cấp cứu nếu choáng váng.',
        };
      }
      break;
    }

    case 'BLOOD_SUGAR': {
      const bs = Number(record.value ?? 0);
      if (bs > 0 && bs < 55) {
        return {
          isCritical: true,
          label: 'Hạ đường huyết nguy kịch',
          valueString: `${bs} mg/dL`,
          description: `Đường huyết tụt xuống ${bs} mg/dL (< 55 mg/dL). Nguy cơ hôn mê hạ đường huyết cấp tính!`,
          instructions: '1. Uống ngay 1 ly nước đường, ngậm kẹo ngọt hoặc uống nước ép trái cây. 2. Nghỉ ngơi 15 phút và đo lại đường huyết. 3. Nếu hôn mê, TUYỆT ĐỐI không ép uống, gọi 115 ngay.',
        };
      }
      if (bs >= 280) {
        return {
          isCritical: true,
          label: 'Tăng đường huyết rất cao',
          valueString: `${bs} mg/dL`,
          description: `Đường huyết tăng cao ${bs} mg/dL (>= 280 mg/dL). Nguy cơ nhiễm toan ceton.`,
          instructions: '1. Bổ sung nhiều nước lọc để thanh lọc thận. 2. Kiểm tra lại liều tiêm Insulin/thuốc theo chỉ định bác sĩ.',
        };
      }
      break;
    }

    case 'SPO2': {
      const spo2 = Number(record.value ?? 0);
      if (spo2 > 0 && spo2 < 90) {
        return {
          isCritical: true,
          label: 'Thiếu oxy máu nghiêm trọng (SpO2)',
          valueString: `${spo2} %`,
          description: `Nồng độ oxy trong máu chỉ đạt ${spo2}% (< 90%). Nguy cơ suy hô hấp cấp!`,
          instructions: '1. Mở cửa thông thoáng gió, cho người bệnh ngồi thẳng tựa lưng. 2. Hít thở sâu và sử dụng bình oxy y tế nếu có sẵn. 3. Gọi 115 ngay.',
        };
      }
      break;
    }

    case 'TEMPERATURE': {
      const temp = Number(record.value ?? 0);
      if (temp >= 39.5) {
        return {
          isCritical: true,
          label: 'Sốt cao nguy kịch',
          valueString: `${temp} °C`,
          description: `Thân nhiệt ${temp}°C vượt mức 39.5°C. Nguy cơ co giật do sốt cao.`,
          instructions: '1. Uống thuốc hạ sốt Paracetamol đúng liều. 2. Chườm khăn ấm ở trán, nách, bẹn. 3. Uống nhiều oresol.',
        };
      }
      if (temp > 0 && temp <= 35.0) {
        return {
          isCritical: true,
          label: 'Hạ thân nhiệt nguy hiểm',
          valueString: `${temp} °C`,
          description: `Thân nhiệt ${temp}°C tụt dưới 35°C. Nguy cơ rối loạn chuyển hóa do nhiễm lạnh.`,
          instructions: '1. Ủ ấm chăn dày, uống nước ấm. 2. Tránh gió lạnh.',
        };
      }
      break;
    }

    default:
      break;
  }

  return { isCritical: false };
};

/**
 * Trigger tự động quét gia đình và gửi thông báo, email khẩn cấp (SCRUM-62)
 * @param {object} healthRecord - Bản ghi vừa lưu
 * @param {object} user - Người vừa đo (User doc hoặc object)
 */
export const processCriticalAlertTrigger = async (healthRecord, user) => {
  try {
    const metricType = healthRecord.type;
    const check = checkCriticalThreshold(metricType, healthRecord);

    if (!check.isCritical) {
      return { triggered: false, reason: 'NOT_CRITICAL' };
    }

    // 1. Tìm tất cả các gia đình mà user tham gia
    const families = await Family.find({ 'members.userId': user._id });
    if (!families || families.length === 0) {
      return { triggered: false, reason: 'NO_FAMILY_FOUND' };
    }

    const patientName = user.fullName || user.name || user.email || 'Người thân';
    const patientPhone = user.phone || '';

    let alertCount = 0;
    const notifiedUserIds = new Set();

    for (const family of families) {
      for (const member of family.members) {
        const viewerIdStr = member.userId.toString();
        const ownerIdStr = user._id.toString();

        // Không gửi cảnh báo cho chính bản thân mình
        if (viewerIdStr === ownerIdStr) continue;

        // Tránh gửi lặp nếu cùng 1 người thân nằm ở nhiều nhóm gia đình
        if (notifiedUserIds.has(viewerIdStr)) continue;

        // 2. Kiểm tra SharingPolicy: Chỉ gửi nếu Viewer ĐÃ ĐƯỢC CẤP QUYỀN xem metricType này (Default Deny)
        const policy = await SharingPolicy.findOne({
          familyId: family._id,
          ownerId: user._id,
          viewerId: member.userId,
        });

        const isAllowed = policy && Array.isArray(policy.allowedMetrics) && policy.allowedMetrics.includes(metricType);

        if (!isAllowed) {
          // Bị chặn bởi Default Deny theo tiêu chí AC bảo vệ quyền riêng tư
          continue;
        }

        // Lấy thông tin user người nhận để lấy email
        const recipient = await User.findById(member.userId).select('name fullName email');
        if (!recipient || !recipient.email) continue;

        notifiedUserIds.add(viewerIdStr);

        // 3. Tạo Notification trong cơ sở dữ liệu
        const notification = new Notification({
          recipientId: recipient._id,
          senderId: user._id,
          type: 'CRITICAL_ALERT',
          title: `🚨 CẢNH BÁO NGUY CẤP: ${patientName}!`,
          message: `${patientName} vừa ghi nhận chỉ số ${check.label} (${check.valueString}). Tình trạng: ${check.description}`,
          data: {
            recordId: healthRecord._id,
            metricType,
            values: {
              systolic: healthRecord.systolic,
              diastolic: healthRecord.diastolic,
              value: healthRecord.value,
            },
            unit: healthRecord.unit,
            severity: 'CRITICAL',
            patientName,
            patientId: user._id,
            patientPhone,
            instructions: check.instructions,
            description: check.description,
          },
        });
        await notification.save();

        // 4. Gửi email thông báo đỏ khẩn cấp
        await sendCriticalAlertEmail(recipient.email, {
          patientName,
          metricType,
          metricLabel: check.label,
          valueString: check.valueString,
          description: check.description,
          instructions: check.instructions,
          callerPhone: patientPhone,
        });

        alertCount++;
      }
    }

    return {
      triggered: true,
      alertCount,
      recipientsNotified: Array.from(notifiedUserIds),
      check,
    };
  } catch (error) {
    console.error('Lỗi khi xử lý trigger cảnh báo nguy kịch:', error);
    return { triggered: false, error: error.message };
  }
};
