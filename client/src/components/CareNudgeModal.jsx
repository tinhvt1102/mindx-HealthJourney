import React, { useState, useEffect } from 'react';
import { X, BellRing, Activity, Pill, HeartHandshake, Send, Loader2, AlertCircle } from 'lucide-react';
import { familyService } from '../services/api';

const NUDGE_PRESETS = [
  {
    id: 'MEASUREMENT',
    label: 'Nhắc đo chỉ số',
    icon: Activity,
    defaultMessage: 'Hôm nay bạn đừng quên đo huyết áp / chỉ số sức khỏe và ghi lên HealthJourney nhé!',
  },
  {
    id: 'MEDICATION',
    label: 'Nhắc uống thuốc',
    icon: Pill,
    defaultMessage: 'Đến giờ uống thuốc rồi nhé! Nhớ uống đúng liều và giữ sức khỏe thật tốt nha.',
  },
  {
    id: 'CUSTOM',
    label: 'Lời nhắn riêng',
    icon: HeartHandshake,
    defaultMessage: '',
  },
];

/**
 * Modal gửi lời nhắc yêu thương (Care Nudge) cho người thân trong gia đình
 */
export default function CareNudgeModal({ isOpen, onClose, familyId, targetMember, onSuccess }) {
  const [category, setCategory] = useState('MEASUREMENT');
  const [message, setMessage] = useState(NUDGE_PRESETS[0].defaultMessage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCategory('MEASUREMENT');
      setMessage(NUDGE_PRESETS[0].defaultMessage);
      setError('');
    }
  }, [isOpen, targetMember]);

  if (!isOpen || !targetMember) return null;

  const targetUser = targetMember.userId || targetMember;
  const targetId = targetUser._id || targetUser.id;
  const targetName = targetUser.fullName || targetUser.name || targetUser.email || 'Người thân';

  const handleSelectCategory = (preset) => {
    setCategory(preset.id);
    setMessage(preset.defaultMessage);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const res = await familyService.nudgeMember(familyId, targetId, {
        category,
        message: message.trim(),
      });
      if (res?.success) {
        if (onSuccess) onSuccess(res.message || `Đã gửi lời nhắc tới ${targetName}`);
        onClose();
      }
    } catch (err) {
      console.error('Lỗi gửi lời nhắc:', err);
      setError(err.response?.data?.message || 'Không thể gửi lời nhắc. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                Nhắc người thân
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[230px]">
                Gửi tới: <strong className="text-slate-700 dark:text-slate-200">{targetName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Chọn mẫu lời nhắc nhanh
            </label>
            <div className="grid grid-cols-3 gap-2">
              {NUDGE_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const active = category === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectCategory(preset)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-400 dark:border-teal-600 text-teal-800 dark:text-teal-300'
                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] text-center leading-tight">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Lời nhắn gửi kèm
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={300}
              placeholder="Nhập lời nhắn quan tâm tới người thân..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Gửi lời nhắc</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
