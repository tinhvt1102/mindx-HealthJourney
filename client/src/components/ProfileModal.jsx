import React, { useState, useRef } from 'react';
import { 
  X, 
  Camera, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Mail, 
  Ruler, 
  FileText,
  ShieldCheck,
  UploadCloud
} from 'lucide-react';
import { authService } from '../services/api';

export default function ProfileModal({ user, onClose, onUserUpdated }) {
  const [formData, setFormData] = useState({
    name: user?.name || user?.fullName || '',
    bio: user?.bio || '',
    heightCm: user?.heightCm || '',
    gender: user?.gender ? user.gender.toLowerCase() : 'other',
  });

  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || user?.avatarUrl || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fileInputRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate kích thước file tối đa 5MB
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Kích thước ảnh tối đa là 5MB.' });
      return;
    }

    // Preview local trước
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);

    try {
      setUploadingAvatar(true);
      setMessage({ type: '', text: '' });

      const res = await authService.uploadAvatar(file);
      if (res.success) {
        setAvatarPreview(res.avatarUrl);
        setMessage({ type: 'success', text: 'Tải ảnh đại diện lên Cloudinary thành công!' });
        if (onUserUpdated && res.user) {
          onUserUpdated(res.user);
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Lỗi khi upload ảnh lên Cloudinary.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setMessage({ type: '', text: '' });

      const res = await authService.updateProfile({
        name: formData.name,
        fullName: formData.name,
        bio: formData.bio,
        heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,
        gender: formData.gender,
      });

      if (res.success) {
        setMessage({ type: 'success', text: 'Cập nhật hồ sơ thành công!' });
        if (onUserUpdated && res.user) {
          onUserUpdated(res.user);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Lỗi cập nhật hồ sơ cá nhân.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Hồ sơ cá nhân</h3>
            <p className="text-xs text-slate-500">Quản lý danh tính và ảnh đại diện Cloudinary</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Thông báo Alert */}
          {message.text && (
            <div
              className={`p-3.5 rounded-xl text-xs sm:text-sm flex items-start gap-2.5 transition-all ${
                message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{message.text}</span>
            </div>
          )}

          {/* Phần Avatar Upload Cloudinary */}
          <div className="flex items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-teal-100 text-teal-700 border-2 border-white shadow-md overflow-hidden flex items-center justify-center font-bold text-2xl">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (formData.name || user?.email || 'U').charAt(0).toUpperCase()
                )}
              </div>

              {/* Nút bấm đổi ảnh */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 bg-slate-900/50 text-white rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                title="Thay đổi ảnh đại diện"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="w-5 h-5 mb-0.5" />
                    <span className="text-[10px] font-medium">Đổi ảnh</span>
                  </>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-slate-800">Ảnh đại diện Cloudinary</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Định dạng JPG, PNG hoặc WEBP (tối đa 5MB).
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                    <span>Đang tải lên...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5 text-teal-600" />
                    <span>Tải ảnh lên</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Email (Readonly có huy hiệu OTP đã xác thực) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email tài khoản
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full pl-10 pr-28 py-2.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-sm cursor-not-allowed"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Đã xác thực OTP
                </span>
              </div>
            </div>
          </div>

          {/* Họ và tên */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="VD: Đoàn Minh Quân"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Chiều cao & Giới tính */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Chiều cao (cm)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Ruler className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  min="50"
                  max="250"
                  value={formData.heightCm}
                  onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                  placeholder="170"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Giới tính
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              >
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
          </div>

          {/* Giới thiệu ngắn / Bio */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Ghi chú sức khỏe / Bio
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3.5 pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </div>
              <textarea
                rows={2}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="VD: Tiền sử gia đình huyết áp cao, đang theo dõi định kỳ..."
                className="w-full pl-10 pr-3.5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingProfile || uploadingAvatar}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 active:scale-[0.98] transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
