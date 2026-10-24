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
  UploadCloud,
  Activity
} from 'lucide-react';
import { authService, healthRecordService } from '../services/api';
import HealthRecordModal from './HealthRecordModal';
import Human3DViewer from './Human3DViewer';

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

  // Lưu trữ chỉ số sức khỏe mới nhất để truyền vào mô hình 3D (Huyết áp, Nhiệt độ, Cân nặng, Tim mạch)
  const [latestMetrics, setLatestMetrics] = useState({});
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [heightCm, setHeightCm] = useState(170);
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('MALE');

  // Lưu bản snapshot dữ liệu ban đầu để kiểm tra dirty state (isFormChanged)
  const [originalData, setOriginalData] = useState({
    fullName: '',
    heightCm: 170,
    birthDate: '',
    gender: 'MALE',
  });

  // Helper điền dữ liệu người dùng vào state
  const populateFormData = (userData) => {
    if (!userData) return;
    const name = userData.fullName || userData.name || '';
    const userEmail = userData.email || '';
    const height = userData.heightCm || 170;
    const userGender = userData.gender || 'MALE';
    const userAvatar = userData.avatar || userData.avatarUrl || '';

    let bDate = '';
    if (userData.birthDate) {
      try {
        const d = new Date(userData.birthDate);
        if (!isNaN(d.getTime())) {
          bDate = d.toISOString().split('T')[0];
        }
      } catch (e) {
        bDate = '';
      }
    }

    setFullName(name);
    setEmail(userEmail);
    setHeightCm(height);
    setGender(userGender);
    setBirthDate(bDate);
    if (userAvatar) setAvatar(userAvatar);

    setOriginalData({
      fullName: name,
      heightCm: height,
      birthDate: bDate,
      gender: userGender,
    });
  };

  // Upload Avatar
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

        // Tải các chỉ số sức khỏe mới nhất để hiển thị trực quan lên mô hình 3D
        const recRes = await healthRecordService.getAll();
        if (recRes?.success && Array.isArray(recRes.data)) {
          // Sắp xếp bản ghi mới nhất lên đầu
          const sorted = [...recRes.data].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
          setLatestMetrics({
            bloodPressure: sorted.find((r) => r.type === 'BLOOD_PRESSURE'),
            temperature: sorted.find((r) => r.type === 'TEMPERATURE'),
            weight: sorted.find((r) => r.type === 'WEIGHT'),
            heartRate: sorted.find((r) => r.type === 'HEART_RATE'),
          });
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

      populateFormData(updatedUser);
      
      if (onUpdateUser) {
        onUpdateUser(updatedUser);
      }
      localStorage.setItem('health_user', JSON.stringify(updatedUser));

      setSuccessMessage('Cập nhật thông tin hồ sơ sức khỏe thành công!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Lỗi khi cập nhật profile:', err);
      setErrorMessage(
        err.response?.data?.message || 'Không thể cập nhật hồ sơ. Vui lòng kiểm tra lại kết nối.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Tính tuổi từ ngày sinh
  const calculateAge = (dobString) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  // Định dạng ngày hiển thị dd/mm/yyyy
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'Chưa cập nhật';
    try {
      const [year, month, day] = dateStr.split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const calculatedAge = calculateAge(birthDate);
  const avatarLetter = (fullName || email || 'U').charAt(0).toUpperCase();

  const genderLabels = {
    MALE: { label: 'Nam', symbol: '♂', color: 'text-sky-600 bg-sky-50 border-sky-200' },
    FEMALE: { label: 'Nữ', symbol: '♀', color: 'text-rose-600 bg-rose-50 border-rose-200' },
    OTHER: { label: 'Khác', symbol: '⚧', color: 'text-teal-600 bg-teal-50 border-teal-200' },
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
              title="Quay lại Tổng quan"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hồ sơ cá nhân</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật thông tin thể trạng để mô hình 3D và các chỉ số sức khỏe hiển thị chuẩn xác nhất
            </p>
          </div>
        </div>

        {initialLoading && (
          <div className="inline-flex items-center gap-2 text-xs text-teal-600 bg-teal-50 px-3.5 py-1.5 rounded-full font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Đang đồng bộ...
          </div>
        )}
      </div>

      {/* Thông báo Feedback Alerts */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setSuccessMessage('')}
            className="text-emerald-500 hover:text-emerald-700 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 font-medium">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setErrorMessage('')}
            className="text-rose-500 hover:text-rose-700 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2-COLUMN SPLIT LAYOUT: BÊN TRÁI LÀ MÔ HÌNH 3D, BÊN PHẢI LÀ THÔNG TIN & FORM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* CỘT TRÁI (5 Cols): MÔ HÌNH 3D NGƯỜI NAM / NỮ THEO CHỈ SỐ */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
          <Human3DViewer
            gender={gender}
            heightCm={Number(heightCm) || 170}
            fullName={fullName || 'Tôi'}
            latestMetrics={latestMetrics}
            onOpenLogModal={() => setIsLogModalOpen(true)}
          />

          {/* Card diễn giải tương tác 3D */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Phản hồi thể trạng thời gian thực</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Khi bạn thay đổi <strong>Chiều cao</strong> hoặc chuyển đổi <strong>Giới tính Nam / Nữ</strong> ở biểu mẫu bên phải, người mẫu 3D sẽ tự động biến đổi tỷ lệ khung xương và vóc dáng ngay lập tức.
            </p>
          </div>
        </div>

        {/* CỘT PHẢI (7 Cols): HỒ SƠ & FORM CẬP NHẬT */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* HEADER CARD: Danh tính người dùng */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Avatar */}
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center text-2xl font-extrabold shadow-md shadow-teal-600/20 overflow-hidden border-2 border-white">
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    avatarLetter
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 bg-slate-900/60 text-white rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                  title="Thay đổi ảnh đại diện"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mb-0.5" />
                      <span className="text-[9px] font-medium">Đổi ảnh</span>
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
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 truncate">
                    {fullName || 'Chưa đặt họ tên'}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Đã xác thực
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{email}</span>
                </p>

                <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 font-medium text-[11px]">
                    Giới tính: <strong className="text-slate-800">{genderLabels[gender]?.label || 'Khác'}</strong>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 font-medium text-[11px]">
                    Chiều cao: <strong className="text-slate-800">{heightCm ? `${heightCm} cm` : 'Chưa nhập'}</strong>
                  </span>
                  {calculatedAge !== null && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 font-medium text-[11px]">
                      Độ tuổi: <strong className="text-slate-800">{calculatedAge} tuổi</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3 QUICK STATS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                <Ruler className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chiều cao</span>
                <div className="text-base font-extrabold text-slate-900 truncate">
                  {heightCm ? `${heightCm} cm` : 'Chưa nhập'}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tuổi</span>
                <div className="text-base font-extrabold text-slate-900 truncate">
                  {calculatedAge !== null ? `${calculatedAge} tuổi` : 'Chưa đặt'}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Giới tính</span>
                <div className="text-base font-extrabold text-slate-900 truncate flex items-center gap-1">
                  <span>{genderLabels[gender]?.label || 'Khác'}</span>
                  <span className="text-sm text-slate-400 font-semibold">{genderLabels[gender]?.symbol}</span>
                </div>
              </div>
            </div>
          </div>

          {/* FORM CARD CẬP NHẬT */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-7">
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Cập nhật thông tin thể chất</h3>
                <p className="text-xs text-slate-500">Mọi thay đổi sẽ cập nhật trực tiếp lên mô hình 3D bên trái</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* 1. CHIỀU CAO */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="heightInput" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Chiều cao cơ thể (cm) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200/60">
                    {heightCm ? `${(heightCm / 100).toFixed(2)} m` : 'Chưa nhập'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      id="heightInput"
                      type="number"
                      min="50"
                      max="250"
                      step="1"
                      required
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="170"
                      className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-base font-bold focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all"
                    />
                    <span className="absolute right-3.5 top-3 text-xs font-semibold text-slate-400 pointer-events-none">
                      cm
                    </span>
                  </div>

                  {/* Nút điều chỉnh nhanh */}
                  <div className="flex items-center gap-1 shrink-0">
                    {[-5, -1, 1, 5].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() => adjustHeight(delta)}
                        className="h-11 px-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Range Slider trực quan */}
                <input
                  type="range"
                  min="100"
                  max="220"
                  step="1"
                  value={Number(heightCm) || 170}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="w-full mt-3 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                />
              </div>

              {/* 2. NGÀY SINH */}
              <div>
                <label htmlFor="birthDateInput" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Ngày sinh
                </label>
                <input
                  id="birthDateInput"
                  type="date"
                  value={birthDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all"
                />
                {calculatedAge !== null && (
                  <p className="text-[11px] text-teal-700 font-semibold mt-1">
                    Tuổi hiện tại: {calculatedAge} tuổi
                  </p>
                )}
              </div>

              {/* 3. GIỚI TÍNH SINH HỌC (THAY ĐỔI MÔ HÌNH 3D NAM/NỮ) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Giới tính sinh học <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGender('MALE')}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      gender === 'MALE'
                        ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-sm ring-2 ring-teal-600/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base font-bold text-sky-600">♂</span>
                    <span className="text-xs font-bold">Nam</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGender('FEMALE')}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      gender === 'FEMALE'
                        ? 'border-rose-500 bg-rose-50 text-rose-900 shadow-sm ring-2 ring-rose-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base font-bold text-rose-500">♀</span>
                    <span className="text-xs font-bold">Nữ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGender('OTHER')}
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      gender === 'OTHER'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-sm ring-2 ring-purple-600/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base font-bold text-purple-600">⚧</span>
                    <span className="text-xs font-bold">Khác</span>
                  </button>
                </div>
              </div>

              {/* 4. HỌ TÊN */}
              <div>
                <label htmlFor="fullNameInput" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Họ và tên
                </label>
                <input
                  id="fullNameInput"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/15 transition-all"
                />
              </div>

              {/* 5. EMAIL (Chỉ đọc) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Email tài khoản
                </label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full h-11 pl-4 pr-10 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-xs font-semibold cursor-not-allowed select-none"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!isFormChanged || saving}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5 inline mr-1.5" />
                  Khôi phục
                </button>

                <button
                  type="submit"
                  disabled={!isFormChanged || saving}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
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

      </div>

      {/* Modal ghi nhận chỉ số sức khỏe */}
      <HealthRecordModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        onSuccess={async () => {
          setSuccessMessage('Đã lưu chỉ số sức khỏe mới!');
          // Tải lại các chỉ số mới nhất lên mô hình 3D
          try {
            const recRes = await healthRecordService.getAll();
            if (recRes?.success && Array.isArray(recRes.data)) {
              const sorted = [...recRes.data].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
              setLatestMetrics({
                bloodPressure: sorted.find((r) => r.type === 'BLOOD_PRESSURE'),
                temperature: sorted.find((r) => r.type === 'TEMPERATURE'),
                weight: sorted.find((r) => r.type === 'WEIGHT'),
                heartRate: sorted.find((r) => r.type === 'HEART_RATE'),
              });
            }
          } catch (e) {}
          setTimeout(() => setSuccessMessage(''), 3000);
        }}
        currentUserHeight={heightCm}
      />
    </div>
  );
}