import { HabitPlan } from '../models/HabitPlan.js';
import { HabitLog } from '../models/HabitLog.js';
import crypto from 'crypto';

/**
 * Trả về ngày Thứ Hai (chuẩn YYYY-MM-DD) của tuần chứa ngày d
 */
export function getMondayOfWeek(inputDate = new Date()) {
  const d = new Date(inputDate);
  const day = d.getDay(); // 0: Sun, 1: Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

/**
 * Lấy danh sách 7 ngày trong tuần dạng YYYY-MM-DD bắt đầu từ Thứ Hai
 */
export function getWeekDateList(mondayStr) {
  const dates = [];
  const monday = new Date(mondayStr + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setUTCDate(cur.getUTCDate() + i);
    dates.push(cur.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Tính chuỗi ngày liên tiếp (Habit Streak) có hoàn thành ít nhất 1 mục
 */
export async function calculateHabitStreak(userId) {
  const logs = await HabitLog.find({
    userId,
    'completedItemIds.0': { $exists: true },
  }).select('date').sort({ date: -1 });

  if (!logs || logs.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalDaysLogged: 0 };
  }

  const dateSet = new Set(logs.map((l) => l.date));
  const totalDaysLogged = dateSet.size;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Tính current streak
  let currentStreak = 0;
  let checkDate = dateSet.has(today) ? new Date(today + 'T00:00:00Z') : (dateSet.has(yesterday) ? new Date(yesterday + 'T00:00:00Z') : null);

  if (checkDate) {
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (dateSet.has(dateStr)) {
        currentStreak++;
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        break;
      }
    }
  }

  // Tính longest streak
  const sortedDates = Array.from(dateSet).sort();
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00Z');
    const curr = new Date(sortedDates[i] + 'T00:00:00Z');
    const diffDays = Math.round((curr - prev) / 86400000);

    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return { currentStreak, longestStreak, totalDaysLogged };
}

/**
 * @desc Lấy kế hoạch tuần và log tick của tuần đó
 * @route GET /api/habits/week?date=YYYY-MM-DD
 */
export const getWeekPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const queryDate = req.query.date || new Date().toISOString().split('T')[0];
    const weekStart = getMondayOfWeek(queryDate);
    const weekDates = getWeekDateList(weekStart);

    // Tìm kế hoạch của tuần này, nếu chưa có thì lấy kế hoạch gần nhất để kế thừa
    let plan = await HabitPlan.findOne({ userId, weekStart });
    if (!plan) {
      const latestPlan = await HabitPlan.findOne({ userId, isActive: true }).sort({ weekStart: -1 });
      if (latestPlan && latestPlan.items && latestPlan.items.length > 0) {
        // Tự động sao chép các mục thói quen sang tuần mới
        plan = await HabitPlan.create({
          userId,
          weekStart,
          items: latestPlan.items,
          sourceHash: latestPlan.sourceHash,
          isActive: true,
        });
      }
    }

    // Lấy log hoàn thành của 7 ngày trong tuần
    const logs = await HabitLog.find({
      userId,
      date: { $in: weekDates },
    });

    const streak = await calculateHabitStreak(userId);

    return res.status(200).json({
      success: true,
      weekStart,
      weekDates,
      plan: plan || null,
      logs: logs || [],
      streak,
    });
  } catch (error) {
    console.error('[getWeekPlan Error]:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy kế hoạch tuần', error: error.message });
  }
};

/**
 * @desc Lưu hoặc cập nhật kế hoạch tuần
 * @route POST /api/habits/plan
 */
export const savePlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const { weekStart, items } = req.body;

    if (!weekStart) {
      return res.status(400).json({ success: false, message: 'weekStart là bắt buộc' });
    }

    const normalizedWeekStart = getMondayOfWeek(weekStart);

    let plan = await HabitPlan.findOne({ userId, weekStart: normalizedWeekStart });
    if (plan) {
      plan.items = items || [];
      await plan.save();
    } else {
      plan = await HabitPlan.create({
        userId,
        weekStart: normalizedWeekStart,
        items: items || [],
        isActive: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lưu kế hoạch tuần thành công',
      plan,
    });
  } catch (error) {
    console.error('[savePlan Error]:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lưu kế hoạch', error: error.message });
  }
};

/**
 * @desc Đánh dấu hoặc bỏ đánh dấu hoàn thành 1 mục thói quen theo ngày
 * @route POST /api/habits/log
 */
export const toggleHabit = async (req, res) => {
  try {
    const userId = req.user._id;
    const { date, itemId, completed } = req.body;

    if (!date || !itemId) {
      return res.status(400).json({ success: false, message: 'date và itemId là bắt buộc' });
    }

    const update = completed
      ? { $addToSet: { completedItemIds: itemId } }
      : { $pull: { completedItemIds: itemId } };

    const log = await HabitLog.findOneAndUpdate(
      { userId, date },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const streak = await calculateHabitStreak(userId);

    return res.status(200).json({
      success: true,
      log,
      streak,
    });
  } catch (error) {
    console.error('[toggleHabit Error]:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái', error: error.message });
  }
};

/**
 * @desc Tự động đồng bộ và chuyển đổi text tóm tắt AI thành các mục checklist
 * @route POST /api/habits/sync-ai
 */
export const syncFromAi = async (req, res) => {
  try {
    const userId = req.user._id;
    const { summaryText, weekStart } = req.body;

    if (!summaryText) {
      return res.status(400).json({ success: false, message: 'summaryText là bắt buộc' });
    }

    const normalizedWeekStart = getMondayOfWeek(weekStart || new Date());
    const items = [];

    // Phân tích markdown theo các mục
    const lines = summaryText.split('\n');
    let currentCategory = null;
    let order = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.includes('Quy trình ăn uống') || line.includes('ăn uống') || line.includes('dinh dưỡng')) {
        currentCategory = 'diet';
        continue;
      }
      if (line.includes('Quy trình tập luyện') || line.includes('tập luyện') || line.includes('vận động')) {
        currentCategory = 'workout';
        continue;
      }
      if (line.startsWith('###') && !line.includes('ăn uống') && !line.includes('tập luyện')) {
        currentCategory = null;
        continue;
      }

      if (!currentCategory) continue;

      // Nhận diện bullet points
      const bulletMatch = line.match(/^[-*•\d.]+\s*(.+)/);
      if (bulletMatch) {
        const cleanText = bulletMatch[1].replace(/\*\*/g, '').trim();
        if (cleanText.length > 3) {
          const id = `ai_${currentCategory}_${Date.now()}_${order}`;
          items.push({
            id,
            category: currentCategory,
            title: cleanText,
            targetDays: [], // Áp dụng mỗi ngày
            order: order++,
          });
        }
      }
    }

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy mục ăn uống hoặc tập luyện nào trong văn bản AI.',
      });
    }

    const sourceHash = crypto.createHash('md5').update(summaryText).digest('hex');

    let plan = await HabitPlan.findOne({ userId, weekStart: normalizedWeekStart });
    if (plan) {
      plan.items = items;
      plan.sourceHash = sourceHash;
      await plan.save();
    } else {
      plan = await HabitPlan.create({
        userId,
        weekStart: normalizedWeekStart,
        items,
        sourceHash,
        isActive: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Đã tạo ${items.length} mục kế hoạch thói quen từ phân tích AI`,
      plan,
    });
  } catch (error) {
    console.error('[syncFromAi Error]:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi đồng bộ từ AI', error: error.message });
  }
};
