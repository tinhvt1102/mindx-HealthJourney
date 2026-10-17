import { HealthRecord, DEFAULT_UNITS } from '../models/HealthRecord.js';
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
