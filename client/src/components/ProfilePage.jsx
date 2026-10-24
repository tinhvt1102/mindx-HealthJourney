import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Mail, 
  Calendar, 
  Ruler, 
  HeartPulse, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Save, 
  RotateCcw, 
  ShieldCheck, 
  Sparkles, 
  Lock,
  ArrowLeft,
  Info,
  Camera,
  UploadCloud
} from 'lucide-react';
import { authService } from '../services/api';

export default function ProfilePage({ currentUser, onUpdateUser, onBack }) {
  // Loading khi fetch dữ liệu từ server
  const [initialLoading, setInitialLoading] = useState(false);
  // Loading khi submit form
  const [saving, setSaving] = useState(false);
  // Thông báo phản hồi
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Avatar states
  const [avatar, setAvatar] = useState(currentUser?.avatar || currentUser?.avatarUrl || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [heightCm, setHeightCm] = useState(170);
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('OTHER');

  // Lưu trữ dữ liệu gốc để so sánh có thay đổi không và để Reset
  const [originalData, setOriginalData] = useState({
    fullName: '',
    email: '',
    heightCm: 170,
    birthDate: '',
    gender: 'OTHER',
  });

  // Helper format ngày YYYY-MM-DD cho input type="date"
  const formatDateForInput = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Helper hiển thị ngày đẹp kiểu Việt Nam (DD/MM/YYYY)
  const formatDateDisplay = (dateVal) => {
    if (!dateVal) return 'Chưa cập nhật';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'Chưa cập nhật';
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return 'Chưa cập nhật';
    }
  };

  // Helper tính tuổi từ ngày sinh
  const calculateAge = (dateVal) => {
    if (!dateVal) return null;
    const birth = new Date(dateVal);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  // Cập nhật state từ user object
  const populateFormData = (user) => {
    if (!user) return;
    const formattedBirth = formatDateForInput(user.birthDate);
    const data = {
      fullName: user.fullName || '',
      email: user.email || '',
      heightCm: user.heightCm !== undefined && user.heightCm !== null ? user.heightCm : 170,
      birthDate: formattedBirth,
      gender: user.gender || 'OTHER',
    };

    setFullName(data.fullName);
    setEmail(data.email);
    setHeightCm(data.heightCm);
    setBirthDate(data.birthDate);
    setGender(data.gender);
    setOriginalData(data);
    if (user.avatar || user.avatarUrl) {
      setAvatar(user.avatar || user.avatarUrl);
    }
  };

  // Xử lý upload avatar lên Cloudinary
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Kích thước ảnh tối đa là 5MB.');
      return;
    }

    try {
      setUploadingAvatar(true);
      setErrorMessage('');
      const res = await authService.uploadAvatar(file);
      if (res.success && res.avatarUrl) {
        setAvatar(res.avatarUrl);
        setSuccessMessage('Cập nhật ảnh đại diện thành công!');
        if (onUpdateUser && res.user) {
          onUpdateUser(res.user);
        }
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Không thể tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Lấy dữ liệu mới nhất từ server khi mount
  useEffect(() => {
    const fetchLatestProfile = async () => {
      // Ưu tiên điền từ currentUser trước để không bị trống màn hình
      if (currentUser) {
        populateFormData(currentUser);
      }

      setInitialLoading(true);
      try {
        const res = await authService.getMe();
        if (res?.user) {
          populateFormData(res.user);
          if (onUpdateUser) onUpdateUser(res.user);
        }
      } catch (err) {
        console.warn('Không thể đồng bộ dữ liệu mới nhất từ server:', err);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchLatestProfile();
  }, []);

  // Kiểm tra form có thay đổi so với dữ liệu gốc không
  const isFormChanged = 
    fullName !== originalData.fullName ||
    Number(heightCm) !== Number(originalData.heightCm) ||
    birthDate !== originalData.birthDate ||
    gender !== originalData.gender;

  // Xử lý nút Đặt lại (Reset)
  const handleReset = () => {
    setFullName(originalData.fullName);
    setHeightCm(originalData.heightCm);
    setBirthDate(originalData.birthDate);
    setGender(originalData.gender);
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Điều chỉnh nhanh chiều cao (+/- step)
  const adjustHeight = (delta) => {
    const current = Number(heightCm) || 170;
    const nextVal = Math.min(250, Math.max(50, current + delta));
    setHeightCm(nextVal);
  };

  // Xử lý gửi form cập nhật lên API
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Client-side validations
    const heightVal = Number(heightCm);
    if (isNaN(heightVal) || heightVal < 50 || heightVal > 250) {
      setErrorMessage('Chiều cao phải nằm trong khoảng từ 50cm đến 250cm.');
      return;
    }

    if (birthDate) {
      const parsedBirth = new Date(birthDate);
      if (parsedBirth > new Date()) {
        setErrorMessage('Ngày sinh không thể nằm ở thời điểm tương lai.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        heightCm: heightVal,
        birthDate: birthDate ? new Date(birthDate).toISOString() : null,
        gender: gender,
      };

      const res = await authService.updateProfile(payload);
      const updatedUser = res.user;

      // Cập nhật dữ liệu gốc & UI
      populateFormData(updatedUser);
      
      // Cập nhật lên App level và LocalStorage
      if (onUpdateUser) {
        onUpdateUser(updatedUser);
      }
      localStorage.setItem('health_user', JSON.stringify(updatedUser));

      setSuccessMessage('Cập nhật thông tin hồ sơ sức khỏe thành công!');
      
      // Tự ẩn thông báo sau 4 giây
      setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (err) {
      console.error('Update profile error:', err);
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin. Vui lòng thử lại sau.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const calculatedAge = calculateAge(birthDate);

  // Avatar Initial
  const avatarLetter = (fullName || email || 'U').charAt(0).toUpperCase();

  const genderLabels = {
    MALE: { label: 'Nam', symbol: '♂', color: 'text-sky-600 bg-sky-50 border-sky-200' },
    FEMALE: { label: 'Nữ', symbol: '♀', color: 'text-rose-600 bg-rose-50 border-rose-200' },
    OTHER: { label: 'Khác', symbol: '⚧', color: 'text-teal-600 bg-teal-50 border-teal-200' },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Breadcrumb & Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Quay lại Tổng quan"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hồ sơ cá nhân</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật thông tin thể trạng để theo dõi chỉ số sức khỏe chuẩn xác hơn
            </p>
          </div>
        </div>

        {initialLoading && (
          <div className="inline-flex items-center gap-2 text-xs text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Đang đồng bộ...
          </div>
        )}
      </div>

      {/* HEADER CARD: Danh tính người dùng */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar Cloudinary */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center text-3xl font-extrabold shadow-lg shadow-teal-600/20 overflow-hidden border-2 border-white">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                avatarLetter
              )}
            </div>

            {/* Nút bấm đổi ảnh đại diện Cloudinary */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 bg-slate-900/60 text-white rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
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

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900 truncate">
                {fullName || 'Chưa đặt họ tên'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60">
                <ShieldCheck className="w-3.5 h-3.5" />
                Đã xác thực
              </span>
            </div>

            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 truncate">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{email}</span>
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-medium">
                Giới tính: <strong className="text-slate-800">{genderLabels[gender]?.label || 'Khác'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-medium">
                Chiều cao: <strong className="text-slate-800">{heightCm ? `${heightCm} cm` : 'Chưa nhập'}</strong>
              </span>
              {calculatedAge !== null && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-medium">
                  Độ tuổi: <strong className="text-slate-800">{calculatedAge} tuổi</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3 QUICK STATS CARDS: Thẻ tóm tắt chỉ số thể chất */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card Chiều cao */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0">
            <Ruler className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Chiều cao</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {heightCm ? (
                <>
                  {heightCm} <span className="text-sm font-normal text-slate-500">cm</span>
                </>
              ) : (
                <span className="text-sm font-normal text-slate-400">Chưa nhập</span>
              )}
            </div>
            <span className="text-[11px] text-teal-600 font-medium block mt-1">
              {heightCm ? `${(heightCm / 100).toFixed(2)} m` : 'Khuyến nghị: 50-250cm'}
            </span>
          </div>
        </div>

        {/* Card Ngày sinh & Tuổi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Ngày sinh & Tuổi</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {calculatedAge !== null ? (
                <>
                  {calculatedAge} <span className="text-sm font-normal text-slate-500">tuổi</span>
                </>
              ) : (
                <span className="text-sm font-normal text-slate-400">Chưa đặt</span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1 truncate">
              {formatDateDisplay(birthDate)}
            </span>
          </div>
        </div>

        {/* Card Giới tính sinh học */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Giới tính</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
              <span>{genderLabels[gender]?.label || 'Khác'}</span>
              <span className="text-base text-slate-400 font-semibold">{genderLabels[gender]?.symbol}</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Chuẩn y khoa theo thể trạng
            </span>
          </div>
        </div>
      </div>

      {/* FORM CARD CẬP NHẬT CHIỀU CAO, NGÀY SINH, GIỚI TÍNH */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        
        {/* Form Card Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Cập nhật thông tin thể chất</h3>
              <p className="text-xs text-slate-500">
                Nhập chính xác chiều cao, ngày sinh và giới tính để nhận kết quả phân tích y tế
              </p>
            </div>
          </div>

          {isFormChanged && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 animate-pulse">
              Có thay đổi chưa lưu
            </span>
          )}
        </div>

        {/* Thông báo Thành công / Lỗi */}
        <div className="px-6 pt-4">
          {successMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Thành công!</span>
                <span className="text-xs text-emerald-700">{successMessage}</span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Đã có lỗi xảy ra!</span>
                <span className="text-xs text-rose-700">{errorMessage}</span>
              </div>
            </div>
          )}
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* 1. CHIỀU CAO (HEIGHT CM) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-2">
            <div className="md:col-span-4">
              <label htmlFor="heightInput" className="block text-sm font-semibold text-slate-800">
                Chiều cao cơ thể
              </label>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Đơn vị centimet (cm). Chiều cao cần thiết để tính toán chỉ số BMI và huyết áp tiêu chuẩn.
              </p>
            </div>

            <div className="md:col-span-8">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                {/* Input số */}
                <div className="relative flex-1 min-w-[160px]">
                  <input
                    id="heightInput"
                    type="number"
                    min="50"
                    max="250"
                    step="1"
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full h-11 pl-4 pr-12 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-xs font-semibold text-slate-400">
                    cm
                  </div>
                </div>

                {/* Các nút căn chỉnh nhanh */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => adjustHeight(-5)}
                    className="h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
                    title="Giảm 5cm"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustHeight(-1)}
                    className="h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
                    title="Giảm 1cm"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustHeight(1)}
                    className="h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
                    title="Tăng 1cm"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustHeight(5)}
                    className="h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer"
                    title="Tăng 5cm"
                  >
                    +5
                  </button>
                </div>
              </div>

              {/* Gợi ý quy chuẩn */}
              <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-1">
                <span>Tối thiểu: 50 cm</span>
                <span>Tối đa: 250 cm</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* 2. NGÀY SINH (BIRTH DATE) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-4">
              <label htmlFor="birthDateInput" className="block text-sm font-semibold text-slate-800">
                Ngày sinh
              </label>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Hệ thống tự động tính độ tuổi để hiển thị ngưỡng nhịp tim và khuyến nghị dinh dưỡng phù hợp.
              </p>
            </div>

            <div className="md:col-span-8 space-y-2">
              <div className="relative">
                <input
                  id="birthDateInput"
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all"
                />
              </div>

              {calculatedAge !== null ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-50 border border-teal-100 text-teal-800 text-xs font-medium">
                  <Info className="w-3.5 h-3.5 text-teal-600" />
                  <span>Tuổi hiện tại tính theo ngày sinh: <strong>{calculatedAge} tuổi</strong></span>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Vui lòng chọn ngày sinh để kích hoạt tính năng phân tích độ tuổi tự động.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* 3. GIỚI TÍNH (GENDER) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-4">
              <label className="block text-sm font-semibold text-slate-800">
                Giới tính sinh học
              </label>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Yếu tố quyết định các khoảng tham chiếu y khoa (hồng cầu, khối lượng cơ, BMR).
              </p>
            </div>

            <div className="md:col-span-8">
              {/* 3 Card lựa chọn Nam - Nữ - Khác */}
              <div className="grid grid-cols-3 gap-3">
                {/* Nam */}
                <button
                  type="button"
                  onClick={() => setGender('MALE')}
                  className={`p-3.5 rounded-xl border text-center transition-all duration-200 flex flex-col items-center gap-1.5 cursor-pointer ${
                    gender === 'MALE'
                      ? 'border-teal-600 bg-teal-50/70 text-teal-900 shadow-sm ring-2 ring-teal-600/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-lg font-bold leading-none">♂</span>
                  <span className="text-xs font-semibold">Nam</span>
                </button>

                {/* Nữ */}
                <button
                  type="button"
                  onClick={() => setGender('FEMALE')}
                  className={`p-3.5 rounded-xl border text-center transition-all duration-200 flex flex-col items-center gap-1.5 cursor-pointer ${
                    gender === 'FEMALE'
                      ? 'border-teal-600 bg-teal-50/70 text-teal-900 shadow-sm ring-2 ring-teal-600/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-lg font-bold leading-none">♀</span>
                  <span className="text-xs font-semibold">Nữ</span>
                </button>

                {/* Khác */}
                <button
                  type="button"
                  onClick={() => setGender('OTHER')}
                  className={`p-3.5 rounded-xl border text-center transition-all duration-200 flex flex-col items-center gap-1.5 cursor-pointer ${
                    gender === 'OTHER'
                      ? 'border-teal-600 bg-teal-50/70 text-teal-900 shadow-sm ring-2 ring-teal-600/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-lg font-bold leading-none">⚧</span>
                  <span className="text-xs font-semibold">Khác</span>
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* 4. HỌ VÀ TÊN & EMAIL */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-4">
              <label htmlFor="fullNameInput" className="block text-sm font-semibold text-slate-800">
                Họ và tên
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Tên hiển thị trong hồ sơ sức khỏe và khi chia sẻ dữ liệu với người thân trong gia đình.
              </p>
            </div>

            <div className="md:col-span-8">
              <div className="relative">
                <input
                  id="fullNameInput"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 5. EMAIL (CHỈ ĐỌC) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div className="md:col-span-4">
              <label className="block text-sm font-semibold text-slate-800">
                Email đăng nhập
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Địa chỉ email định danh tài khoản duy nhất, không thể thay đổi tại đây.
              </p>
            </div>

            <div className="md:col-span-8">
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full h-11 pl-4 pr-10 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm font-medium cursor-not-allowed select-none"
                />
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!isFormChanged || saving}
              className="w-full sm:w-auto h-11 px-5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Khôi phục ban đầu</span>
            </button>

            <button
              type="submit"
              disabled={!isFormChanged || saving}
              className="w-full sm:w-auto h-11 px-6 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-semibold text-sm rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu thay đổi...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Lưu thay đổi</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}

