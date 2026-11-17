import React, { useState } from 'react';
import { X, UserPlus, Loader2, AlertCircle, HeartHandshake } from 'lucide-react';
import { familyService } from '../services/api';

const RELATIONSHIP_OPTIONS = [
  'Ông nội',
  'Bà nội',
  'Ông ngoại',
  'Bà ngoại',
  'Bố',
  'Mẹ',
  'Con nhỏ',
  'Người thân khác',
];

/**
 * Modal thêm Hồ sơ Phụ thuộc (dành cho Ông bà lớn tuổi / Trẻ nhỏ chưa có smartphone riêng)
 */
export default function DependentModal({ isOpen, onClose, familyId, familyName, onSuccess }) {
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState('Bà nội');
  const [gender, setGender] = useState('FEMALE');
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('160');
  const [weightKg, setWeightKg] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setFullName('');
    setRelationship('Bà nội');
    setGender('FEMALE');
    setBirthDate('');
    setHeightCm('160');
    setWeightKg('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError('Vui lòng nhập họ tên người thân (ít nhất 2 ký tự).');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const payload = {
        fullName: fullName.trim(),
        relationship,
        gender,
        birthDate: birthDate || undefined,
        heightCm: heightCm ? Number(heightCm) : 165,
        weightKg: weightKg ? Number(weightKg) : undefined,
      };

      const res = await familyService.createDependent(familyId, payload);
      if (res?.success) {
        resetForm();
        if (onSuccess) onSuccess(res.dependent);
        onClose();
      }
    } catch (err) {
      console.error('Lỗi tạo hồ sơ phụ thuộc:', err);
      setError(err.response?.data?.message || 'Không thể tạo hồ sơ phụ thuộc. Vui lòng thử lại.');
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                Thêm hồ sơ phụ thuộc
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[230px]">
                Nhóm: {familyName || 'Gia đình'}
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
          <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/50 text-xs text-teal-800 dark:text-teal-200 leading-relaxed">
            Dành cho ông bà, cha mẹ lớn tuổi hoặc trẻ nhỏ không dùng tài khoản riêng. Bạn sẽ là người ghi hộ chỉ số và theo dõi sức khỏe.
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Họ và tên <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ví dụ: Bà Nguyễn Thị Hoa"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Mối quan hệ
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500"
              >
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Giới tính
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500"
              >
                <option value="FEMALE">Nữ</option>
                <option value="MALE">Nam</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Ngày sinh
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Cao (cm)
              </label>
              <input
                type="number"
                min="50"
                max="250"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="160"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Nặng (kg)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="Tùy chọn"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Tạo hồ sơ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
