import { Streak } from '../models/Streak.js';
import { HealthRecord } from '../models/HealthRecord.js';

export const ALL_BADGES = [
  {
    id: 'FIRST_RECORD',
    name: 'Khởi đầu khỏe mạnh',
    description: 'Ghi nhận chỉ số sức khỏe đầu tiên vào hệ thống',
    icon: '🌱',
  },
  {
    id: 'STREAK_3',
    name: 'Chiến binh 3 ngày',
    description: 'Duy trì chuỗi ghi nhận chỉ số 3 ngày liên tiếp',
    icon: '⚡',
  },
  {
    id: 'STREAK_7',
    name: 'Tuần lễ bền bỉ',
    description: 'Chăm sóc sức khỏe liên tục 7 ngày không gián đoạn',
    icon: '🔥',
  },
  {
    id: 'STREAK_14',
    name: 'Hai tuần vàng',
    description: 'Duy trì chuỗi ghi nhận 14 ngày liên tiếp',
    icon: '🌟',
  },
  {
    id: 'STREAK_30',
    name: 'Thói quen thép',
    description: 'Đạt mốc 30 ngày kỷ luật và yêu thương sức khỏe',
    icon: '👑',
  },
  {
    id: 'CENTURION_10',
    name: 'Chuyên gia theo dõi',
    description: 'Tích lũy đạt mốc 10 bản ghi theo dõi sức khỏe',
    icon: '💎',
  },
];

/**
 * Cập nhật chuỗi ngày đo liên tục (Streak) và kiểm tra mở khóa huy hiệu (SCRUM-85)
 * @param {string|ObjectId} userId
 * @param {Date} recordDate
 */
export const updateStreakOnRecord = async (userId, recordDate = new Date()) => {
  try {
    const d = new Date(recordDate);
    const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD

    let streakDoc = await Streak.findOne({ userId });
    if (!streakDoc) {
      streakDoc = new Streak({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastLoggedDate: null,
        loggedDates: [],
        badges: [],
      });
    }

    const newUnlockedBadges = [];

    // Nếu ngày này chưa được ghi nhận trong danh sách các ngày
    if (!streakDoc.loggedDates.includes(dateStr)) {
      streakDoc.loggedDates.push(dateStr);
      streakDoc.loggedDates.sort();

      if (!streakDoc.lastLoggedDate) {
        // Lần đầu tiên ghi nhận
        streakDoc.currentStreak = 1;
      } else {
        const lastDate = new Date(streakDoc.lastLoggedDate + 'T00:00:00Z');
        const thisDate = new Date(dateStr + 'T00:00:00Z');
        const diffDays = Math.round((thisDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Ngày kế tiếp liên tục
          streakDoc.currentStreak += 1;
        } else if (diffDays > 1) {
          // Bị đứt đoạn
          streakDoc.currentStreak = 1;
        }
        // diffDays <= 0: ghi bù quá khứ, giữ nguyên currentStreak
      }

      streakDoc.lastLoggedDate = dateStr;
      if (streakDoc.currentStreak > streakDoc.longestStreak) {
        streakDoc.longestStreak = streakDoc.currentStreak;
      }
    }

    // Đếm tổng số bản ghi của user
    const totalRecords = await HealthRecord.countDocuments({ userId });
    const existingBadgeIds = new Set(streakDoc.badges.map((b) => b.id));

    const checkAndAward = (badgeId) => {
      if (!existingBadgeIds.has(badgeId)) {
        const template = ALL_BADGES.find((b) => b.id === badgeId);
        if (template) {
          const newBadge = {
            id: template.id,
            name: template.name,
            description: template.description,
            icon: template.icon,
            unlockedAt: new Date(),
          };
          streakDoc.badges.push(newBadge);
          newUnlockedBadges.push(newBadge);
          existingBadgeIds.add(badgeId);
        }
      }
    };

    if (totalRecords >= 1) checkAndAward('FIRST_RECORD');
    if (totalRecords >= 10) checkAndAward('CENTURION_10');
    if (streakDoc.currentStreak >= 3) checkAndAward('STREAK_3');
    if (streakDoc.currentStreak >= 7) checkAndAward('STREAK_7');
    if (streakDoc.currentStreak >= 14) checkAndAward('STREAK_14');
    if (streakDoc.currentStreak >= 30) checkAndAward('STREAK_30');

    await streakDoc.save();

    return {
      currentStreak: streakDoc.currentStreak,
      longestStreak: streakDoc.longestStreak,
      lastLoggedDate: streakDoc.lastLoggedDate,
      badges: streakDoc.badges,
      newUnlockedBadges,
    };
  } catch (error) {
    console.error('Lỗi tính streak:', error);
    return null;
  }
};
