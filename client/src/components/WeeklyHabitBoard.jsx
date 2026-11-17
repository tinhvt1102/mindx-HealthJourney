import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle2,
  Circle,
  Dumbbell,
  Utensils,
  Sparkles,
  Plus,
  TrendingUp,
  RefreshCw,
  Trophy,
  Check,
  X,
  Target,
  ListFilter,
} from 'lucide-react';
import { habitService } from '../services/api';

const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export default function WeeklyHabitBoard({ initialAiText = null, onNavigateToAi = null }) {
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [weekData, setWeekData] = useState({
    weekStart: '',
    weekDates: [],
    plan: null,
    logs: [],
    streak: { currentStreak: 0, longestStreak: 0, totalDaysLogged: 0 },
  });
  const [filterCategory, setFilterCategory] = useState('all'); // 'all' | 'diet' | 'workout'
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    category: 'diet',
  });
  const [actionMessage, setActionMessage] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchWeekData = useCallback(async (date) => {
    try {
      setLoading(true);
      const res = await habitService.getWeekPlan(date);
      if (res.success) {
        setWeekData({
          weekStart: res.weekStart,
          weekDates: res.weekDates || [],
          plan: res.plan,
          logs: res.logs || [],
          streak: res.streak || { currentStreak: 0, longestStreak: 0, totalDaysLogged: 0 },
        });
      }
    } catch (err) {
      console.error('Lỗi tải kế hoạch tuần:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeekData(currentDate);
  }, [currentDate, fetchWeekData]);

  // Điều hướng tuần
  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleCurrentWeek = () => {
    setCurrentDate(todayStr);
  };

  // Toggle checklist item
  const handleToggle = async (dateStr, itemId, isCompleted) => {
    // Optimistic UI Update
    setWeekData((prev) => {
      const existingLog = prev.logs.find((l) => l.date === dateStr);
      let updatedLogs;
      if (existingLog) {
        const updatedItemIds = isCompleted
          ? existingLog.completedItemIds.filter((id) => id !== itemId)
          : [...existingLog.completedItemIds, itemId];
        updatedLogs = prev.logs.map((l) =>
          l.date === dateStr ? { ...l, completedItemIds: updatedItemIds } : l
        );
      } else {
        updatedLogs = [
          ...prev.logs,
          { date: dateStr, completedItemIds: isCompleted ? [] : [itemId] },
        ];
      }
      return { ...prev, logs: updatedLogs };
    });

    try {
      const res = await habitService.toggleHabit({
        date: dateStr,
        itemId,
        completed: !isCompleted,
      });
      if (res.success && res.streak) {
        setWeekData((prev) => ({ ...prev, streak: res.streak }));
      }
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái thói quen:', err);
      // Revert if failed
      fetchWeekData(currentDate);
    }
  };

  // Đồng bộ từ AI
  const handleSyncAi = async (customText = null) => {
    const textToSync = customText || initialAiText;
    if (!textToSync) {
      if (onNavigateToAi) {
        onNavigateToAi();
      } else {
        setActionMessage('Vui lòng tạo phân tích sức khỏe AI trước để có dữ liệu lộ trình.');
        setTimeout(() => setActionMessage(null), 4000);
      }
      return;
    }

    try {
      setSyncing(true);
      const res = await habitService.syncFromAi({
        summaryText: textToSync,
        weekStart: weekData.weekStart,
      });
      if (res.success) {
        setActionMessage(res.message || 'Đã đồng bộ kế hoạch tuần từ AI thành công!');
        fetchWeekData(currentDate);
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      console.error('Lỗi đồng bộ AI:', err);
      setActionMessage(err.response?.data?.message || 'Không thể đồng bộ lộ trình từ AI');
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  // Thêm mục thói quen thủ công
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.title.trim()) return;

    const existingItems = weekData.plan?.items || [];
    const itemToAdd = {
      id: `custom_${Date.now()}`,
      category: newItem.category,
      title: newItem.title.trim(),
      targetDays: [],
      order: existingItems.length,
    };

    const updatedItems = [...existingItems, itemToAdd];

    try {
      const res = await habitService.savePlan({
        weekStart: weekData.weekStart || currentDate,
        items: updatedItems,
      });
      if (res.success) {
        setWeekData((prev) => ({ ...prev, plan: res.plan }));
        setNewItem({ title: '', category: 'diet' });
        setShowAddModal(false);
        setActionMessage('Đã thêm mục mới vào kế hoạch tuần!');
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      console.error('Lỗi lưu mục thói quen:', err);
    }
  };

  // Xóa 1 mục thói quen
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Bạn có chắc muốn xóa mục này khỏi kế hoạch tuần?')) return;
    const existingItems = weekData.plan?.items || [];
    const updatedItems = existingItems.filter((i) => i.id !== itemId);

    try {
      const res = await habitService.savePlan({
        weekStart: weekData.weekStart,
        items: updatedItems,
      });
      if (res.success) {
        setWeekData((prev) => ({ ...prev, plan: res.plan }));
      }
    } catch (err) {
      console.error('Lỗi xóa mục thói quen:', err);
    }
  };

  const planItems = weekData.plan?.items || [];
  const filteredItems = planItems.filter((item) => {
    if (filterCategory === 'all') return true;
    return item.category === filterCategory;
  });

  // Helper tính hoàn thành cho 1 ngày
  const getDayCompletion = (dateStr) => {
    const log = weekData.logs.find((l) => l.date === dateStr);
    const completedIds = log?.completedItemIds || [];
    const total = filteredItems.length;
    const completed = filteredItems.filter((item) => completedIds.includes(item.id)).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage, completedIds };
  };

  // Tính tổng tiến độ tuần
  const totalWeekTasks = filteredItems.length * (weekData.weekDates.length || 7);
  let totalCompletedWeekTasks = 0;
  weekData.weekDates.forEach((dateStr) => {
    const { completed } = getDayCompletion(dateStr);
    totalCompletedWeekTasks += completed;
  });
  const weekPercentage = totalWeekTasks > 0 ? Math.round((totalCompletedWeekTasks / totalWeekTasks) * 100) : 0;

  // Format date range text
  const formatWeekRange = () => {
    if (!weekData.weekDates || weekData.weekDates.length === 0) return '';
    const start = weekData.weekDates[0];
    const end = weekData.weekDates[weekData.weekDates.length - 1];
    const sParts = start.split('-');
    const eParts = end.split('-');
    return `${sParts[2]}/${sParts[1]} - ${eParts[2]}/${eParts[1]}/${eParts[0]}`;
  };

  return (
    <div className="space-y-6">
      {/* Action Notification Alert */}
      {actionMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner: Streak & Gamification (Phương án C) */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-600 rounded-2xl p-0.5 shadow-md">
        <div className="bg-white dark:bg-slate-900 rounded-[15px] p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Streak Counter */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 shrink-0">
                <Flame className="w-8 h-8 fill-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {weekData.streak.currentStreak} ngày
                  </span>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Streak hiện tại
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>🏆 Kỷ lục: <strong>{weekData.streak.longestStreak} ngày</strong></span>
                  <span>•</span>
                  <span>Tổng tích lũy: <strong>{weekData.streak.totalDaysLogged} ngày</strong></span>
                </p>
              </div>
            </div>

            {/* Weekly Progress Bar */}
            <div className="md:min-w-[260px] bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
                <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Tiến độ tuần này
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{weekPercentage}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${weekPercentage}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 text-right">
                {totalCompletedWeekTasks}/{totalWeekTasks} nhiệm vụ đã tick
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Tuần, Bộ lọc, Nút AI Sync & Thêm mới */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Navigation Tuần */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[150px] text-center">
              {formatWeekRange()}
            </span>
            <button
              onClick={handleNextWeek}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
              title="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleCurrentWeek}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
          >
            Hôm nay
          </button>
        </div>

        {/* Filter Categories */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilterCategory('diet')}
            className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filterCategory === 'diet'
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Ăn uống</span>
          </button>
          <button
            onClick={() => setFilterCategory('workout')}
            className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              filterCategory === 'workout'
                ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>Tập luyện</span>
          </button>
        </div>

        {/* Action Buttons: Sync AI & Add Task */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSyncAi()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="Đồng bộ quy trình ăn uống & tập luyện từ phân tích sức khỏe AI"
          >
            <Sparkles className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Đang đồng bộ...' : 'Đồng bộ từ AI'}</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm mục</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mb-2" />
          <p className="text-sm font-medium">Đang tải bảng kế hoạch tuần...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 bg-teal-50 dark:bg-teal-950/50 rounded-2xl flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
            Chưa có mục thói quen cho tuần này
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            Bạn có thể nhấn nút <strong>"Đồng bộ từ AI"</strong> để tự động chuyển quy trình ăn uống & bài tập được AI phân tích thành danh sách checklist, hoặc tự tạo thêm mục theo ý muốn.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => handleSyncAi()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Đồng bộ từ phân tích AI</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tự thêm mục thói quen</span>
            </button>
          </div>
        </div>
      ) : (
        /* Weekly Board Grid (Phương án B: 7 Cột Thứ 2 -> Chủ Nhật) */
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekData.weekDates.map((dateStr, idx) => {
            const isToday = dateStr === todayStr;
            const dayName = DAY_LABELS[idx] || `Ngày ${idx + 1}`;
            const dateNum = dateStr.split('-')[2];
            const { completed, total, percentage, completedIds } = getDayCompletion(dateStr);

            return (
              <div
                key={dateStr}
                className={`flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isToday
                    ? 'bg-white dark:bg-slate-900 border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                    : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-2xs'
                }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 border-b text-center ${
                    isToday
                      ? 'bg-teal-500 text-white border-teal-600'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? 'text-teal-100' : 'text-slate-400'}`}>
                      {dayName}
                    </span>
                    {isToday && (
                      <span className="text-[9px] bg-white text-teal-700 font-extrabold px-1.5 py-0.2 rounded-full shadow-2xs">
                        Hôm nay
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-black mt-0.5">
                    {dateNum}
                  </div>
                  {/* Progress Mini-bar */}
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-[10px] font-medium opacity-90 mb-0.5">
                      <span>{completed}/{total}</span>
                      <span>{percentage}%</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isToday ? 'bg-teal-700/40' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          percentage === 100
                            ? 'bg-emerald-400'
                            : isToday
                            ? 'bg-white'
                            : 'bg-teal-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Task Checklist Items */}
                <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    {filteredItems.map((item) => {
                      const done = completedIds.includes(item.id);
                      const isDiet = item.category === 'diet';

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggle(dateStr, item.id, done)}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all duration-150 group select-none ${
                            done
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-300'
                              : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            <div className="shrink-0 mt-0.5">
                              {done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-teal-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-[11px] font-medium leading-tight ${
                                  done
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {item.title}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <span
                                  className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                    isDiet
                                      ? 'text-orange-600 bg-orange-100 dark:bg-orange-950/60'
                                      : 'text-teal-600 bg-teal-100 dark:bg-teal-950/60'
                                  }`}
                                >
                                  {isDiet ? 'Ăn uống' : 'Tập luyện'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plan Items Management List */}
      {planItems.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ListFilter className="w-4 h-4 text-teal-600" />
              <span>Danh sách các mục thói quen trong kế hoạch tuần ({planItems.length})</span>
            </h4>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold"
            >
              + Thêm mục mới
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {planItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {item.category === 'diet' ? (
                    <Utensils className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  ) : (
                    <Dumbbell className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  )}
                  <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                    {item.title}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                  title="Xóa mục này"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal thêm mục mới */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Thêm mục thói quen vào kế hoạch tuần
            </h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nhóm thói quen
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItem({ ...newItem, category: 'diet' })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      newItem.category === 'diet'
                        ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-300 text-orange-700 dark:text-orange-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <Utensils className="w-4 h-4 text-orange-500" />
                    <span>Ăn uống</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItem({ ...newItem, category: 'workout' })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      newItem.category === 'workout'
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 text-teal-700 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <Dumbbell className="w-4 h-4 text-teal-500" />
                    <span>Tập luyện</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nội dung thói quen
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Uống 2L nước, Chạy bộ 20 phút..."
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Lưu mục mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
