import { Streak } from '../models/Streak.js';
import { ALL_BADGES, updateStreakOnRecord } from '../services/streak.service.js';

/**
 * @desc    Lấy thông tin chuỗi ngày đo và bộ sưu tập huy hiệu của người dùng (SCRUM-85)
 * @route   GET /api/streaks
 * @access  Private
 */
export const getMyStreak = async (req, res) => {
  try {
    let streakDoc = await Streak.findOne({ userId: req.user._id });

    if (!streakDoc) {
      // Tự động đồng bộ và tính toán lại nếu chưa có document
      const result = await updateStreakOnRecord(req.user._id);
      if (result) {
        streakDoc = await Streak.findOne({ userId: req.user._id });
      }
    }

    // Kiểm tra xem chuỗi có bị đứt quãng không nếu hôm nay đã quá 1 ngày kể từ lần ghi nhận cuối
    let currentStreak = streakDoc ? streakDoc.currentStreak : 0;
    const longestStreak = streakDoc ? streakDoc.longestStreak : 0;
    const lastLoggedDate = streakDoc ? streakDoc.lastLoggedDate : null;

    if (lastLoggedDate) {
      const today = new Date().toISOString().split('T')[0];
      const todayDate = new Date(today + 'T00:00:00Z');
      const lastDate = new Date(lastLoggedDate + 'T00:00:00Z');
      const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        // Đã đứt quãng chuỗi ngày
        currentStreak = 0;
        if (streakDoc) {
          streakDoc.currentStreak = 0;
          await streakDoc.save();
        }
      }
    }

    const unlockedBadgeIds = new Set(streakDoc ? streakDoc.badges.map((b) => b.id) : []);

    // Danh sách toàn bộ huy hiệu kèm trạng thái đã mở hay chưa
    const badgesWithStatus = ALL_BADGES.map((b) => {
      const unlocked = streakDoc?.badges.find((ub) => ub.id === b.id);
      return {
        ...b,
        isUnlocked: unlockedBadgeIds.has(b.id),
        unlockedAt: unlocked ? unlocked.unlockedAt : null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        currentStreak,
        longestStreak,
        lastLoggedDate,
        totalBadgesUnlocked: unlockedBadgeIds.size,
        totalBadgesAvailable: ALL_BADGES.length,
        badges: badgesWithStatus,
      },
    });
  } catch (error) {
    console.error('Lỗi lấy streak:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin chuỗi ngày đo',
      error: error.message,
    });
  }
};
