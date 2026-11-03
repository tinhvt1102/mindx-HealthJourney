import { HealthRecord, DEFAULT_UNITS, HEALTH_METRIC_TYPES } from '../models/HealthRecord.js';
import { evaluateMedicalThreshold } from '../utils/healthThresholds.js';
import { User } from '../models/User.js';
import mongoose from 'mongoose';

/**
 * @desc    Tạo mới một bản ghi chỉ số sức khỏe (C trong CRUD)
 * @route   POST /api/v1/health-records
 * @access  Private
 */
export const createHealthRecord = async (req, res) => {
  try {
    const { type, value, systolic, diastolic, unit, recordedAt, note } = req.body;

    const newRecord = new HealthRecord({
      userId: req.user._id,
      type,
      value: value !== undefined ? Number(value) : undefined,
      systolic: systolic !== undefined ? Number(systolic) : undefined,
      diastolic: diastolic !== undefined ? Number(diastolic) : undefined,
      unit: unit || DEFAULT_UNITS[type],
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      note: note || '',
    });

    // AC3 SCRUM-24: Tự động tính BMI khi log cân nặng dựa trên chiều cao profile
    if (type === 'WEIGHT' && value !== undefined) {
      const userProfile = await User.findById(req.user._id).select('heightCm');
      if (userProfile && userProfile.heightCm) {
        const heightInMeters = userProfile.heightCm / 100;
        const weightKg = Number(value);
        newRecord.bmi = Number((weightKg / (heightInMeters * heightInMeters)).toFixed(1));
      }
    }

    await newRecord.save();

    return res.status(201).json({
      success: true,
      message: 'Tạo bản ghi chỉ số sức khỏe thành công',
      data: newRecord,
    });
  } catch (error) {
    console.error('Lỗi khi tạo chỉ số sức khỏe:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo chỉ số sức khỏe',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy danh sách lịch sử chỉ số sức khỏe theo bộ lọc (R trong CRUD)
 *          Hỗ trợ lọc theo loại chỉ số và khoảng thời gian (7 ngày, 30 ngày - AC1 SCRUM-28)
 * @route   GET /api/v1/health-records
 * @access  Private
 */
export const getHealthRecords = async (req, res) => {
  try {
    const { type, days, startDate, endDate, sort } = req.query;

    const filter = {
      userId: req.user._id,
    };

    // 1. Lọc theo loại chỉ số (nếu có)
    if (type) {
      filter.type = type;
    }

    // 2. Lọc theo thời gian (7 ngày, 30 ngày theo AC1 SCRUM-28)
    if (days) {
      const daysNum = parseInt(days, 10);
      if (!isNaN(daysNum) && daysNum > 0) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - daysNum);
        filter.recordedAt = { $gte: pastDate };
      }
    } else if (startDate || endDate) {
      filter.recordedAt = {};
      if (startDate) {
        filter.recordedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.recordedAt.$lte = new Date(endDate);
      }
    }

    // Sắp xếp: mặc định tăng dần (asc) để vẽ biểu đồ đường theo dòng thời gian (AC2 SCRUM-28)
    const sortOrder = sort === 'desc' ? -1 : 1;

    const records = await HealthRecord.find(filter).sort({ recordedAt: sortOrder });

    return res.status(200).json({
      success: true,
      count: records.length,
      filter: {
        type: type || 'ALL',
        days: days ? Number(days) : undefined,
      },
      data: records,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách chỉ số sức khỏe:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách chỉ số sức khỏe',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy chi tiết 1 bản ghi chỉ số sức khỏe theo ID (R trong CRUD)
 * @route   GET /api/v1/health-records/:id
 * @access  Private
 */
export const getHealthRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID bản ghi không đúng định dạng',
      });
    }

    const record = await HealthRecord.findById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bản ghi chỉ số sức khỏe',
      });
    }

    // Đảm bảo tính bảo mật: chỉ chủ sở hữu mới xem được
    if (record.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập bản ghi này',
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết chỉ số:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết bản ghi',
      error: error.message,
    });
  }
};

/**
 * @desc    Cập nhật một bản ghi chỉ số sức khỏe (U trong CRUD)
 * @route   PUT /api/v1/health-records/:id
 * @access  Private
 */
export const updateHealthRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, value, systolic, diastolic, unit, recordedAt, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID bản ghi không đúng định dạng',
      });
    }

    const record = await HealthRecord.findById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bản ghi chỉ số sức khỏe để cập nhật',
      });
    }

    // Đảm bảo quyền sở hữu
    if (record.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa bản ghi này',
      });
    }

    // Cập nhật các trường nếu được cung cấp
    if (type !== undefined) record.type = type;
    if (value !== undefined) record.value = Number(value);
    if (systolic !== undefined) record.systolic = Number(systolic);
    if (diastolic !== undefined) record.diastolic = Number(diastolic);
    if (unit !== undefined) record.unit = unit;
    if (recordedAt !== undefined) record.recordedAt = new Date(recordedAt);
    if (note !== undefined) record.note = note.trim();

    await record.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật bản ghi chỉ số sức khỏe thành công',
      data: record,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật chỉ số:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật bản ghi',
      error: error.message,
    });
  }
};

/**
 * @desc    Xóa một bản ghi chỉ số sức khỏe (D trong CRUD)
 * @route   DELETE /api/v1/health-records/:id
 * @access  Private
 */
export const deleteHealthRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID bản ghi không đúng định dạng',
      });
    }

    const record = await HealthRecord.findById(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bản ghi chỉ số sức khỏe để xóa',
      });
    }

    // Đảm bảo quyền sở hữu
    if (record.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa bản ghi này',
      });
    }

    await record.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Xóa bản ghi chỉ số sức khỏe thành công',
      deletedId: id,
    });
  } catch (error) {
    console.error('Lỗi khi xóa chỉ số:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa bản ghi',
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy dữ liệu chỉ số sức khỏe của một thành viên gia đình (được kiểm soát bởi SharingPolicy)
 *          Đáp ứng AC1 & AC2 Jira SCRUM-45 (SCRUM-46):
 *          - Chỉ query và trả về các bản ghi thuộc các loại chỉ số nằm trong req.allowedMetrics
 *          - Nếu caller lọc ?type=... mà type đó không nằm trong req.allowedMetrics -> trả về 403 Forbidden
 *          - Nếu req.allowedMetrics rỗng (Default Deny) -> trả về count: 0, data: []
 * @route   GET /api/families/:familyId/members/:memberId/health-records
 * @access  Private (bảo vệ bởi protect & healthAccessControl)
 */
export const getFamilyMemberHealthRecords = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { type, days, startDate, endDate, sort } = req.query;
    const allowedMetrics = req.allowedMetrics || [];

    // 1. Nếu người dùng request lọc theo 1 type cụ thể:
    if (type) {
      // Nếu type đó không nằm trong danh sách được cấp phép xem -> 403 Forbidden
      if (!allowedMetrics.includes(type)) {
        return res.status(403).json({
          success: false,
          message: `Bạn không có quyền xem chỉ số '${type}' của thành viên này`,
          allowedMetrics,
        });
      }
    }

    // 2. Nếu không được cấp quyền xem bất kỳ chỉ số nào (Default Deny hoặc allowedMetrics: [])
    if (allowedMetrics.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        allowedMetrics: [],
        message: 'Bạn chưa được cấp quyền xem bất kỳ chỉ số sức khỏe nào của thành viên này',
        data: [],
      });
    }

    // 3. Xây dựng câu truy vấn an toàn tại Backend Query Layer (AC1 SCRUM-45)
    const filter = {
      userId: memberId,
      // CHỈ query các type được cấp phép (và match với type filter nếu có)
      type: type ? type : { $in: allowedMetrics },
    };

    // Lọc theo thời gian nếu có (days hoặc startDate / endDate)
    if (days) {
      const daysNum = parseInt(days, 10);
      if (!isNaN(daysNum) && daysNum > 0) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - daysNum);
        filter.recordedAt = { $gte: pastDate };
      }
    } else if (startDate || endDate) {
      filter.recordedAt = {};
      if (startDate) filter.recordedAt.$gte = new Date(startDate);
      if (endDate) filter.recordedAt.$lte = new Date(endDate);
    }

    const sortOrder = sort === 'desc' ? -1 : 1;
    const records = await HealthRecord.find(filter).sort({ recordedAt: sortOrder });

    return res.status(200).json({
      success: true,
      count: records.length,
      allowedMetrics,
      isSelfView: req.isSelfView || false,
      data: records,
    });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu sức khỏe thành viên:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy dữ liệu sức khỏe thành viên',
      error: error.message,
    });
  }
};


/**
 * @desc    Lấy tổng quan sức khỏe mới nhất của một thành viên trong nhóm gia đình (Jira SCRUM-50)
 *          Kiểm soát chặt chẽ bởi SharingPolicy (AC1 & AC2 SCRUM-49 / SCRUM-45):
 *          - Áp dụng bộ lọc allowedMetrics từ middleware healthAccessControl
 *          - Tích hợp đánh giá ngưỡng y khoa (SCRUM-52)
 * @route   GET /api/families/:familyId/members/:memberId/health-overview
 * @access  Private (bảo vệ bởi protect & healthAccessControl)
 */
export const getFamilyMemberHealthOverview = async (req, res) => {
  try {
    const { memberId } = req.params;
    const allowedMetrics = req.allowedMetrics || [];
    const isSelfView = req.isSelfView || false;

    // 1. Lấy thông tin thành viên mục tiêu
    const targetUser = await User.findById(memberId).select('name fullName email avatar avatarUrl birthDate gender heightCm');
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin thành viên',
      });
    }

    const family = req.family;
    const memberRecord = family.members.find(
      (m) =>
        m.userId?.toString() === memberId.toString() ||
        m.userId?._id?.toString() === memberId.toString()
    );

    const memberInfo = {
      id: targetUser._id,
      name: targetUser.fullName || targetUser.name || targetUser.email,
      fullName: targetUser.fullName || targetUser.name,
      email: targetUser.email,
      avatar: targetUser.avatar || targetUser.avatarUrl,
      avatarUrl: targetUser.avatarUrl || targetUser.avatar,
      gender: targetUser.gender || 'UNKNOWN',
      heightCm: targetUser.heightCm || 170,
      birthDate: targetUser.birthDate,
      role: memberRecord?.role || 'MEMBER',
      joinedAt: memberRecord?.joinedAt || new Date(),
    };

    const metrics = {};
    const recentHistory = {};
    let warningCount = 0;
    let dangerCount = 0;

    // 2. Duyệt qua toàn bộ 4 loại chỉ số sức khỏe chuẩn
    for (const type of HEALTH_METRIC_TYPES) {
      const hasAccess = allowedMetrics.includes(type);

      if (!hasAccess) {
        metrics[type] = {
          type,
          hasAccess: false,
          latest: null,
          evaluation: {
            level: 'PROTECTED',
            label: 'Không có quyền xem',
            color: 'slate',
            description: 'Chỉ số này được bảo vệ bởi chính sách quyền riêng tư (Default Deny)',
            badgeText: 'Chưa cấp quyền',
          },
        };
        recentHistory[type] = [];
        continue;
      }

      // Query bản ghi mới nhất
      const latestDoc = await HealthRecord.findOne({
        userId: memberId,
        type,
      }).sort({ recordedAt: -1 });

      let latest = null;
      if (latestDoc) {
        latest = latestDoc.toObject();
        latest.values = {
          systolic: latest.systolic,
          diastolic: latest.diastolic,
          value: latest.value,
          bmi: latest.bmi,
        };
      }

      // Query lịch sử đo 30 ngày gần nhất để vẽ biểu đồ mini
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const historyDocs = await HealthRecord.find({
        userId: memberId,
        type,
        recordedAt: { $gte: thirtyDaysAgo },
      }).sort({ recordedAt: 1 });

      const history = historyDocs.map((doc) => {
        const item = doc.toObject();
        item.values = {
          systolic: item.systolic,
          diastolic: item.diastolic,
          value: item.value,
          bmi: item.bmi,
        };
        return item;
      });

      const evaluation = latest ? evaluateMedicalThreshold(type, latest) : null;
      if (evaluation) {
        if (evaluation.level === 'DANGER') dangerCount++;
        else if (evaluation.level === 'WARNING') warningCount++;
      }

      metrics[type] = {
        type,
        hasAccess: true,
        latest,
        evaluation,
      };
      recentHistory[type] = history;
    }

    const overallStatus = dangerCount > 0 ? 'DANGER' : warningCount > 0 ? 'WARNING' : 'NORMAL';

    return res.status(200).json({
      success: true,
      member: memberInfo,
      allowedMetrics,
      isSelfView,
      overallStatus,
      alerts: {
        dangerCount,
        warningCount,
      },
      metrics,
      recentHistory,
    });
  } catch (error) {
    console.error('Lỗi khi lấy tổng quan sức khỏe thành viên:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy tổng quan sức khỏe thành viên',
      error: error.message,
    });
  }
};
