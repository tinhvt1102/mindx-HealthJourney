import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { DoctorShareLink } from '../models/DoctorShareLink.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { User } from '../models/User.js';
import { evaluateMedicalThreshold } from '../utils/healthThresholds.js';

/**
 * @desc    Tạo link chia sẻ an toàn cho Bác sĩ kèm mã PIN 4 số (AC1 & AC2 SCRUM-60 / SCRUM-74)
 * @route   POST /api/shares/create-doctor-link
 * @access  Private
 */
export const createDoctorShareLink = async (req, res) => {
  try {
    const { pin, durationHours = 24, allowedMetrics, notes } = req.body;

    if (!pin || !/^\d{4}$/.test(pin.toString())) {
      return res.status(400).json({
        success: false,
        message: 'Mã PIN bảo mật phải gồm đúng 4 chữ số (ví dụ: 1234)',
      });
    }

    const hours = Number(durationHours) || 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const token = crypto.randomBytes(16).toString('hex');
    const pinHash = await bcrypt.hash(pin.toString(), 10);

    const shareLink = new DoctorShareLink({
      userId: req.user._id,
      token,
      pinHash,
      expiresAt,
      allowedMetrics: allowedMetrics && allowedMetrics.length > 0
        ? allowedMetrics
        : ['BLOOD_PRESSURE', 'HEART_RATE', 'BLOOD_SUGAR', 'WEIGHT', 'TEMPERATURE', 'SPO2'],
      notes: notes ? notes.trim() : '',
      isActive: true,
    });

    await shareLink.save();

    const clientUrl = process.env.CLIENT_URL || 'https://mindx-health-journey.vercel.app';
    const shareUrl = `${clientUrl}/shared-report/${token}`;

    return res.status(201).json({
      success: true,
      message: 'Tạo link chia sẻ cho bác sĩ thành công',
      data: {
        token,
        shareUrl,
        expiresAt,
        allowedMetrics: shareLink.allowedMetrics,
        notes: shareLink.notes,
      },
    });
  } catch (error) {
    console.error('Lỗi tạo link bác sĩ:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo link chia sẻ bác sĩ',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy danh sách các liên kết chia sẻ cho Bác sĩ của người dùng
 * @route   GET /api/shares/my-links
 * @access  Private
 */
export const getMyDoctorShareLinks = async (req, res) => {
  try {
    const links = await DoctorShareLink.find({ userId: req.user._id }).sort({ createdAt: -1 });

    const clientUrl = process.env.CLIENT_URL || 'https://mindx-health-journey.vercel.app';

    const data = links.map((l) => {
      const isExpired = new Date() > new Date(l.expiresAt);
      return {
        _id: l._id,
        token: l.token,
        shareUrl: `${clientUrl}/shared-report/${l.token}`,
        expiresAt: l.expiresAt,
        isActive: l.isActive && !isExpired,
        isExpired,
        viewCount: l.viewCount,
        lastViewedAt: l.lastViewedAt,
        allowedMetrics: l.allowedMetrics,
        notes: l.notes,
        createdAt: l.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách liên kết chia sẻ',
      error: error.message,
    });
  }
};

/**
 * @desc    Hủy hoặc thu hồi link chia sẻ bác sĩ (AC3 SCRUM-60)
 * @route   DELETE /api/shares/:token
 * @access  Private
 */
export const revokeDoctorShareLink = async (req, res) => {
  try {
    const link = await DoctorShareLink.findOne({
      token: req.params.token,
      userId: req.user._id,
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy liên kết chia sẻ',
      });
    }

    link.isActive = false;
    await link.save();

    return res.status(200).json({
      success: true,
      message: 'Đã thu hồi liên kết chia sẻ thành công',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi thu hồi link chia sẻ',
      error: error.message,
    });
  }
};

/**
 * @desc    Xác thực mã PIN và lấy hồ sơ sức khỏe 30 ngày dạng Read-Only cho Bác sĩ (AC2 SCRUM-60)
 * @route   POST /api/shares/:token/verify-pin
 * @access  Public (Không cần Auth)
 */
export const verifyDoctorPinAndGetReport = async (req, res) => {
  try {
    const { token } = req.params;
    const { pin } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Thiếu token chia sẻ' });
    }

    if (!pin) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã PIN 4 số' });
    }

    // Tìm link kèm pinHash (select +pinHash)
    const shareLink = await DoctorShareLink.findOne({ token }).select('+pinHash');

    if (!shareLink || !shareLink.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Liên kết không tồn tại hoặc đã bị chủ hồ sơ thu hồi quyền truy cập',
      });
    }

    // Kiểm tra hết hạn
    if (new Date() > new Date(shareLink.expiresAt)) {
      return res.status(410).json({
        success: false,
        message: 'Liên kết chia sẻ này đã hết hạn hiệu lực',
      });
    }

    // So sánh mã PIN
    const isPinValid = await bcrypt.compare(pin.toString(), shareLink.pinHash);
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Mã PIN bảo mật không chính xác. Vui lòng thử lại.',
      });
    }

    // Cập nhật lượt xem
    shareLink.viewCount += 1;
    shareLink.lastViewedAt = new Date();
    await shareLink.save();

    // Lấy thông tin bệnh nhân (bảo vệ các trường nhạy cảm như password, otp)
    const patient = await User.findById(shareLink.userId).select(
      'name fullName birthDate gender bloodType heightCm weightKg avatar avatarUrl'
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hồ sơ người bệnh',
      });
    }

    // Lấy bản ghi sức khỏe 30 ngày gần nhất theo allowedMetrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const records = await HealthRecord.find({
      userId: shareLink.userId,
      type: { $in: shareLink.allowedMetrics },
      recordedAt: { $gte: thirtyDaysAgo },
    }).sort({ recordedAt: -1 });

    // Đánh giá ngưỡng y tế và tính thống kê trung bình
    const evaluatedRecords = records.map((r) => {
      const evaluation = evaluateMedicalThreshold(r.type, r);
      return {
        ...r.toJSON(),
        evaluation,
      };
    });

    // Thống kê nhanh theo loại chỉ số
    const statsByMetric = {};
    for (const type of shareLink.allowedMetrics) {
      const typeRecords = records.filter((r) => r.type === type);
      if (typeRecords.length > 0) {
        if (type === 'BLOOD_PRESSURE') {
          const sysSum = typeRecords.reduce((acc, cur) => acc + (cur.systolic || 0), 0);
          const diaSum = typeRecords.reduce((acc, cur) => acc + (cur.diastolic || 0), 0);
          statsByMetric[type] = {
            count: typeRecords.length,
            avgSystolic: Math.round(sysSum / typeRecords.length),
            avgDiastolic: Math.round(diaSum / typeRecords.length),
            latest: typeRecords[0],
          };
        } else {
          const valSum = typeRecords.reduce((acc, cur) => acc + (cur.value || 0), 0);
          statsByMetric[type] = {
            count: typeRecords.length,
            avgValue: Number((valSum / typeRecords.length).toFixed(1)),
            unit: typeRecords[0].unit,
            latest: typeRecords[0],
          };
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Xác thực mã PIN thành công. Hồ sơ bệnh án đã sẵn sàng.',
      data: {
        patient: {
          name: patient.fullName || patient.name,
          birthDate: patient.birthDate,
          gender: patient.gender,
          bloodType: patient.bloodType,
          heightCm: patient.heightCm,
          weightKg: patient.weightKg,
          bmi: patient.bmi,
        },
        records: evaluatedRecords,
        stats: statsByMetric,
        doctorNotes: shareLink.notes,
        expiresAt: shareLink.expiresAt,
      },
    });
  } catch (error) {
    console.error('Lỗi verify PIN bác sĩ:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tải hồ sơ bác sĩ',
      error: error.message,
    });
  }
};
