import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  Lock, 
  Clock, 
  Copy, 
  Check, 
  Trash2, 
  X, 
  AlertCircle, 
  ExternalLink,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';
import { doctorShareService } from '../services/api';

export default function DoctorShareModal({ isOpen, onClose }) {
  const [pin, setPin] = useState('');
  const [durationHours, setDurationHours] = useState(24);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const [myLinks, setMyLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const fetchMyLinks = async () => {
    try {
      setLoadingLinks(true);
      const res = await doctorShareService.getMyLinks();
      if (res?.data) {
        setMyLinks(res.data);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách link:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMyLinks();
      setCreatedResult(null);
      setError('');
      setPin('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError('Mã PIN bảo mật phải gồm đúng 4 chữ số');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await doctorShareService.createLink({
        pin,
        durationHours,
        notes,
      });
      if (res?.data) {
        setCreatedResult({
          ...res.data,
          plainPin: pin,
        });
        fetchMyLinks();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi tạo link chia sẻ');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (token) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi link chia sẻ này không?')) return;
    try {
      await doctorShareService.revokeLink(token);
      fetchMyLinks();
      if (createdResult?.token === token) {
        setCreatedResult(null);
      }
    } catch (err) {
      console.error('Lỗi thu hồi link:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Chia sẻ Hồ sơ cho Bác sĩ
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tạo liên kết xem nhanh tạm thời kèm mã PIN bảo mật
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 my-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Link vừa tạo thành công */}
        {createdResult ? (
          <div className="my-4 p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-2">
              <ShieldCheck className="w-4 h-4" />
              Đã tạo liên kết an toàn thành công!
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              Gửi liên kết này và mã PIN cho bác sĩ của bạn. Bác sĩ chỉ có quyền xem (Read-Only) trong vòng {durationHours} giờ.
            </p>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700 mb-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                  {createdResult.shareUrl}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(createdResult.shareUrl)}
                  className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Đã copy' : 'Copy'}
                </button>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500">Mã PIN bảo mật:</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 tracking-wider">
                  {createdResult.plainPin}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCreatedResult(null)}
              className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline"
            >
              + Tạo thêm liên kết khác
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4 my-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Đặt mã PIN bảo mật (4 chữ số)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Ví dụ: 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono tracking-widest text-slate-800 dark:text-slate-100 focus:outline-teal-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Bác sĩ mở link bắt buộc phải nhập đúng mã PIN này mới xem được hồ sơ.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Thời hạn hiệu lực của liên kết
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDurationHours(24)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                    durationHours === 24
                      ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Clock className="w-4 h-4" /> 24 Giờ (1 ngày)
                </button>
                <button
                  type="button"
                  onClick={() => setDurationHours(168)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                    durationHours === 168
                      ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Clock className="w-4 h-4" /> 7 Ngày (1 tuần)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú gửi Bác sĩ (tùy chọn)
              </label>
              <textarea
                rows={2}
                placeholder="Ví dụ: Kính nhờ Bác sĩ xem giúp biểu đồ huyết áp 30 ngày qua khi đổi thuốc mới..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || pin.length !== 4}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/30 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? 'Đang tạo liên kết...' : 'Tạo Liên Kết Cho Bác Sĩ'}
            </button>
          </form>
        )}

        {/* Danh sách link đang hoạt động */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Các liên kết đã tạo ({myLinks.length})
          </h4>

          {loadingLinks ? (
            <p className="text-xs text-slate-400 py-2">Đang tải danh sách...</p>
          ) : myLinks.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Chưa có liên kết chia sẻ nào.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {myLinks.map((l) => (
                <div
                  key={l._id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          l.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {l.isActive ? 'Đang hoạt động' : 'Đã thu hồi / Hết hạn'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        • {l.viewCount} lượt xem
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Hết hạn: {new Date(l.expiresAt).toLocaleString('vi-VN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {l.isActive && (
                      <button
                        type="button"
                        onClick={() => handleCopy(l.shareUrl)}
                        className="p-1.5 text-slate-500 hover:text-teal-600 rounded-lg cursor-pointer"
                        title="Copy link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {l.isActive && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(l.token)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        title="Thu hồi quyền truy cập"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
