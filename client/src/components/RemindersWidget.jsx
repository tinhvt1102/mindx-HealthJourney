import React, { useState, useEffect } from 'react';
import { 
  Pill, 
  Activity, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Clock, 
  Trash2, 
  CalendarCheck, 
  Sparkles,
  X,
  AlertCircle
} from 'lucide-react';
import { reminderService } from '../services/api';

export default function RemindersWidget({ onRecordLogged }) {
  const [reminders, setReminders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    type: 'MEDICATION',
    metricType: 'BLOOD_PRESSURE',
    time: '08:00',
    dosage: '',
    notes: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [remindersRes, statsRes] = await Promise.all([
        reminderService.getAll(),
        reminderService.getStats(),
      ]);
      if (remindersRes?.data) setReminders(remindersRes.data);
      if (statsRes?.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Lỗi tải lịch nhắc:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (id) => {
    try {
      const res = await reminderService.toggle(id);
      if (res?.success) {
        setReminders((prev) =>
          prev.map((r) =>
            r._id === id ? { ...r, isCompletedToday: res.data.isCompletedToday } : r
          )
        );
        // Cập nhật lại stats
        const sRes = await reminderService.getStats();
        if (sRes?.data) setStats(sRes.data);
      }
    } catch (err) {
      console.error('Lỗi toggle lịch nhắc:', err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch nhắc này không?')) return;
    try {
      await reminderService.delete(id);
      setReminders((prev) => prev.filter((r) => r._id !== id));
      const sRes = await reminderService.getStats();
      if (sRes?.data) setStats(sRes.data);
    } catch (err) {
      console.error('Lỗi xóa lịch nhắc:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Vui lòng nhập tên thuốc hoặc chỉ số cần đo');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await reminderService.create(formData);
      setIsModalOpen(false);
      setFormData({
        title: '',
        type: 'MEDICATION',
        metricType: 'BLOOD_PRESSURE',
        time: '08:00',
        dosage: '',
        notes: '',
      });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi tạo lịch nhắc');
    } finally {
      setSubmitting(false);
    }
  };

  const completedTodayCount = reminders.filter((r) => r.isCompletedToday).length;
  const progressPercent =
    reminders.length > 0 ? Math.round((completedTodayCount / reminders.length) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200/80 dark:border-slate-700">
      {/* Header Widget */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Lịch nhắc thuốc & Đo chỉ số
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kế hoạch tuân thủ điều trị hàng ngày
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 dark:text-teal-300 text-xs font-semibold transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm nhắc nhở
        </button>
      </div>

      {/* Progress & Compliance Rate */}
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 mb-4 border border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Tiến độ hôm nay: {completedTodayCount}/{reminders.length} hoàn thành
          </span>
          <span className="font-bold text-teal-600 dark:text-teal-400">
            {progressPercent}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-teal-500 to-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {stats && (
          <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Tỷ lệ tuân thủ 7 ngày qua:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              {stats.complianceRate}% ({stats.completedWeekTasks}/{stats.expectedWeekTasks} lần)
            </span>
          </div>
        )}
      </div>

      {/* Danh sách công việc hôm nay */}
      <div className="space-y-2.5">
        {loading ? (
          <p className="text-center py-6 text-xs text-slate-400">Đang tải lịch nhắc...</p>
        ) : reminders.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <Pill className="w-8 h-8 mx-auto mb-2 opacity-40 stroke-1" />
            <p className="text-xs">Bạn chưa có lịch nhắc nào. Hãy thêm để không bị quên!</p>
          </div>
        ) : (
          reminders.map((r) => {
            const isMed = r.type === 'MEDICATION';
            return (
              <div
                key={r._id}
                onClick={() => handleToggle(r._id)}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  r.isCompletedToday
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/50 opacity-80'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-teal-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    className="shrink-0 transition-transform active:scale-90"
                  >
                    {r.isCompletedToday ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-teal-500" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-bold leading-tight truncate ${
                        r.isCompletedToday
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {r.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-0.5 font-medium">
                        <Clock className="w-3 h-3 text-teal-600" />
                        {r.time}
                      </span>
                      {r.dosage && <span>• {r.dosage}</span>}
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                          isMed
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}
                      >
                        {isMed ? 'Thuốc' : 'Đo chỉ số'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDelete(r._id, e)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                  title="Xóa lịch nhắc"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Thêm Lịch Nhắc */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 relative">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Thêm Lịch Nhắc Mới
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Nhắc uống thuốc hoặc đo huyết áp, đường huyết đúng giờ
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Loại nhắc nhở
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'MEDICATION' })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                      formData.type === 'MEDICATION'
                        ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Pill className="w-4 h-4" /> Uống thuốc
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'MEASUREMENT' })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                      formData.type === 'MEASUREMENT'
                        ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Activity className="w-4 h-4" /> Đo chỉ số
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {formData.type === 'MEDICATION' ? 'Tên thuốc & Hàm lượng' : 'Tên chỉ số cần đo'}
                </label>
                <input
                  type="text"
                  placeholder={
                    formData.type === 'MEDICATION'
                      ? 'Ví dụ: Amlodipine 5mg, Panadol...'
                      : 'Ví dụ: Đo huyết áp sáng, Đo đường huyết đói...'
                  }
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Giờ nhắc
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Liều lượng / Cách dùng
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 1 viên sau ăn"
                    value={formData.dosage}
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-teal-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/30 disabled:opacity-50"
                >
                  {submitting ? 'Đang tạo...' : 'Lưu lịch nhắc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
