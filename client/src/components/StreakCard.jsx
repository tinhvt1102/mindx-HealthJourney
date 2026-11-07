import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Trophy, 
  Award, 
  Sparkles, 
  Calendar, 
  X, 
  CheckCircle2, 
  Lock 
} from 'lucide-react';
import { streakService } from '../services/api';

export default function StreakCard({ onLogClick }) {
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBadgesModalOpen, setIsBadgesModalOpen] = useState(false);

  const fetchStreak = async () => {
    try {
      setLoading(true);
      const res = await streakService.getMyStreak();
      if (res?.data) {
        setStreakData(res.data);
      }
    } catch (err) {
      console.error('Lỗi lấy streak:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreak();
  }, []);

  if (loading || !streakData) return null;

  const {
    currentStreak = 0,
    longestStreak = 0,
    lastLoggedDate,
    totalBadgesUnlocked = 0,
    totalBadgesAvailable = 6,
    badges = [],
  } = streakData;

  const todayStr = new Date().toISOString().split('T')[0];
  const isLoggedToday = lastLoggedDate === todayStr;

  return (
    <>
      <div className="bg-linear-to-br from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-6 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden group">
        {/* Background glow & decoration */}
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
        <div className="absolute top-3 right-4 opacity-15">
          <Flame className="w-24 h-24" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold uppercase tracking-wider">
                <Flame className="w-4 h-4 text-amber-200 fill-amber-200 animate-bounce" />
                Chuỗi Đo Sức Khỏe
              </span>

              <button
                type="button"
                onClick={() => setIsBadgesModalOpen(true)}
                className="flex items-center gap-1 text-xs font-bold bg-white/20 hover:bg-white/30 backdrop-blur-xs px-3 py-1 rounded-full transition-all cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-200" />
                {totalBadgesUnlocked}/{totalBadgesAvailable} Huy hiệu
              </button>
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tight">
                {currentStreak}
              </span>
              <span className="text-base font-bold text-amber-100">
                ngày liên tục 🔥
              </span>
            </div>

            <p className="text-xs text-amber-100/90 mt-1">
              Kỷ lục chuỗi ngày dài nhất của bạn: <strong>{longestStreak} ngày</strong>
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
            <span className="text-xs font-medium text-white/90">
              {isLoggedToday ? (
                <span className="flex items-center gap-1.5 text-emerald-100 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 fill-emerald-300/30" />
                  Hôm nay đã ghi nhận chỉ số!
                </span>
              ) : (
                <span className="text-amber-100 font-medium">
                  Chưa đo hôm nay. Hãy ghi để duy trì chuỗi!
                </span>
              )}
            </span>

            {!isLoggedToday && onLogClick && (
              <button
                type="button"
                onClick={onLogClick}
                className="px-3 py-1.5 rounded-xl bg-white text-orange-600 font-bold text-xs hover:bg-amber-50 transition-colors shadow-sm cursor-pointer shrink-0"
              >
                Đo ngay +
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Bộ Sưu Tập Huy Hiệu (Badges Showcase) */}
      {isBadgesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 relative max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsBadgesModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Bộ Sưu Tập Huy Hiệu Thành Tích
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mở khóa khi bạn kiên trì theo dõi sức khỏe mỗi ngày
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-3 ${
                    badge.isUnlocked
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl shrink-0 text-2xl flex items-center justify-center ${
                      badge.isUnlocked
                        ? 'bg-white dark:bg-slate-800 shadow-sm border border-amber-200'
                        : 'bg-slate-200 dark:bg-slate-800 grayscale'
                    }`}
                  >
                    {badge.isUnlocked ? badge.icon : <Lock className="w-5 h-5 text-slate-400" />}
                  </div>

                  <div className="min-w-0">
                    <h4
                      className={`text-xs font-bold leading-tight ${
                        badge.isUnlocked
                          ? 'text-amber-900 dark:text-amber-200'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {badge.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {badge.description}
                    </p>
                    {badge.isUnlocked && badge.unlockedAt && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-1 block">
                        Đạt được: {new Date(badge.unlockedAt).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-center">
              <button
                type="button"
                onClick={() => setIsBadgesModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
