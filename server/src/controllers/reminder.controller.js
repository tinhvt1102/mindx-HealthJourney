import { Reminder } from '../models/Reminder.js';

/**
 * Lấy chuỗi ngày YYYY-MM-DD từ Date object theo múi giờ địa phương
 */
const getLocalDateString = (d = new Date()) => {
  return d.toISOString().split('T')[0];
};

/**
 * @desc    Lấy danh sách lịch nhắc của người dùng (kèm trạng thái hôm nay)
 * @route   GET /api/reminders
 * @access  Private
 */
export const getReminders = async (req, res) => {
  try {
    const todayStr = getLocalDateString();
    const reminders = await Reminder.find({ userId: req.user._id }).sort({ time: 1 });

    const data = reminders.map((r) => {
      const isCompletedToday = Array.isArray(r.completedDates) && r.completedDates.includes(todayStr);
      return {
        ...r.toJSON(),
        isCompletedToday,
      };
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách lịch nhắc:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch nhắc',
      error: error.message,
    });
  }
};

/**
 * @desc    Tạo lịch nhắc mới (Uống thuốc hoặc Đo chỉ số)
 * @route   POST /api/reminders
 * @access  Private
 */
export const createReminder = async (req, res) => {
  try {
    const { title, type, metricType, time, frequency, daysOfWeek, dosage, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề lịch nhắc là bắt buộc',
      });
    }

    if (!time || !time.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian nhắc nhở là bắt buộc (ví dụ: 08:00)',
      });
    }

    const reminder = new Reminder({
      userId: req.user._id,
      title: title.trim(),
      type: type || 'MEDICATION',
      metricType: type === 'MEASUREMENT' ? metricType : null,
      time: time.trim(),
      frequency: frequency || 'DAILY',
      daysOfWeek: daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
      dosage: dosage ? dosage.trim() : '',
      notes: notes ? notes.trim() : '',
      isActive: true,
      completedDates: [],
    });

    await reminder.save();

    return res.status(201).json({
      success: true,
      message: 'Tạo lịch nhắc thành công',
      data: reminder,
    });
  } catch (error) {
    console.error('Lỗi tạo lịch nhắc:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo lịch nhắc',
      error: error.message,
    });
  }
};

/**
 * @desc    Cập nhật lịch nhắc
 * @route   PUT /api/reminders/:id
 * @access  Private
 */
export const updateReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params.id, userId: req.user._id });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch nhắc',
      });
    }

    const { title, type, metricType, time, frequency, daysOfWeek, dosage, notes, isActive } = req.body;

    if (title !== undefined) reminder.title = title.trim();
    if (type !== undefined) reminder.type = type;
    if (metricType !== undefined) reminder.metricType = metricType;
    if (time !== undefined) reminder.time = time.trim();
    if (frequency !== undefined) reminder.frequency = frequency;
    if (daysOfWeek !== undefined) reminder.daysOfWeek = daysOfWeek;
    if (dosage !== undefined) reminder.dosage = dosage.trim();
    if (notes !== undefined) reminder.notes = notes.trim();
    if (isActive !== undefined) reminder.isActive = isActive;

    await reminder.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật lịch nhắc thành công',
      data: reminder,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật lịch nhắc',
      error: error.message,
    });
  }
};

/**
 * @desc    Xóa lịch nhắc
 * @route   DELETE /api/reminders/:id
 * @access  Private
 */
export const deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch nhắc',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Xóa lịch nhắc thành công',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa lịch nhắc',
      error: error.message,
    });
  }
};

/**
 * @desc    Đánh dấu toggle đã hoàn thành / hủy hoàn thành hôm nay (AC2 SCRUM-52)
 * @route   POST /api/reminders/:id/toggle
 * @access  Private
 */
export const toggleReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params.id, userId: req.user._id });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch nhắc',
      });
    }

    const targetDate = req.body.date || getLocalDateString();
    const dates = Array.isArray(reminder.completedDates) ? [...reminder.completedDates] : [];

    const index = dates.indexOf(targetDate);
    let completed = false;

    if (index > -1) {
      // Đã có -> Hủy hoàn thành
      dates.splice(index, 1);
      completed = false;
    } else {
      // Chưa có -> Đánh dấu hoàn thành
      dates.push(targetDate);
      completed = true;
    }

    reminder.completedDates = dates;
    await reminder.save();

    return res.status(200).json({
      success: true,
      message: completed ? 'Đã hoàn thành việc uống thuốc/đo chỉ số' : 'Đã bỏ đánh dấu hoàn thành',
      data: {
        _id: reminder._id,
        isCompletedToday: completed,
        completedDates: reminder.completedDates,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi thay đổi trạng thái hoàn thành',
      error: error.message,
    });
  }
};

/**
 * @desc    Thống kê tỷ lệ tuân thủ điều trị theo tuần (Compliance Rate % - AC3 SCRUM-52)
 * @route   GET /api/reminders/stats
 * @access  Private
 */
export const getReminderStats = async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id, isActive: true });

    // Tạo danh sách 7 ngày gần nhất (từ 6 ngày trước đến hôm nay)
    const last7Days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay(); // 0-6
      last7Days.push({ dateStr, dayOfWeek });
    }

    let expectedTotal = 0;
    let completedTotal = 0;

    for (const day of last7Days) {
      for (const reminder of reminders) {
        // Kiểm tra xem reminder có áp dụng vào thứ này không
        if (reminder.daysOfWeek.includes(day.dayOfWeek)) {
          expectedTotal++;
          if (reminder.completedDates.includes(day.dateStr)) {
            completedTotal++;
          }
        }
      }
    }

    const complianceRate = expectedTotal > 0 ? Math.round((completedTotal / expectedTotal) * 100) : 100;

    return res.status(200).json({
      success: true,
      data: {
        totalReminders: reminders.length,
        expectedWeekTasks: expectedTotal,
        completedWeekTasks: completedTotal,
        complianceRate, // % tuân thủ
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê lịch nhắc',
      error: error.message,
    });
  }
};
