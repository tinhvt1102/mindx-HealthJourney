import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import ProfilePage from './components/ProfilePage';
import FamilyPage from './components/FamilyPage';
import PrivacyMatrixPage from './components/PrivacyMatrixPage';
import HealthTrackerPage from './components/HealthTrackerPage';
import HealthRecordModal from './components/HealthRecordModal';
import InvitationBanner from './components/InvitationBanner';
import InvitationModal from './components/InvitationModal';
import AiSummaryCard from './components/AiSummaryCard';
import NotificationBell from './components/NotificationBell';
import ThemeToggle from './components/ThemeToggle';
import DoctorShareModal from './components/DoctorShareModal';
import DoctorQuickViewPage from './components/DoctorQuickViewPage';
import RemindersWidget from './components/RemindersWidget';
import StreakCard from './components/StreakCard';
import MobileBottomNav from './components/MobileBottomNav';
import { 
  Heart, 
  LogOut, 
  User, 
  Activity, 
  Users, 
  ShieldCheck, 
  Shield, 
  UserCog, 
  LayoutDashboard, 
  ChevronRight,
  UserPlus,
  Plus,
  TrendingUp,
  Stethoscope,
  Flame,
  CalendarCheck
} from 'lucide-react';
import { authService } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');

  // Modal ghi nhận chỉ số nhanh toàn cục
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);

  // Modal chia sẻ bác sĩ
  const [isDoctorShareOpen, setIsDoctorShareOpen] = useState(false);

  // Xem báo cáo bác sĩ qua URL
  const [doctorToken, setDoctorToken] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const shareMatch = path.match(/^\/shared-report\/([a-zA-Z0-9_-]+)/);
      return shareMatch ? shareMatch[1] : new URLSearchParams(window.location.search).get('shareToken');
    }
    return null;
  });

  const [urlInviteToken, setUrlInviteToken] = useState(null);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);

  useEffect(() => {
    // Khởi tạo theme từ localStorage
    const savedTheme = localStorage.getItem('health_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('inviteToken') || params.get('invitation');
    if (tokenFromUrl) {
      setUrlInviteToken(tokenFromUrl);
      setIsUrlModalOpen(true);
    }

    const token = localStorage.getItem('health_token');
    const savedUser = localStorage.getItem('health_user');

    if (!token || !savedUser) {
      localStorage.removeItem('health_token');
      localStorage.removeItem('health_user');
      setCurrentUser(null);
      return;
    }

    try {
      setCurrentUser(JSON.parse(savedUser));
    } catch (e) {
      localStorage.removeItem('health_token');
      localStorage.removeItem('health_user');
      setCurrentUser(null);
      return;
    }

    authService.getMe()
      .then((res) => {
        if (res?.user) {
          setCurrentUser(res.user);
          localStorage.setItem('health_user', JSON.stringify(res.user));
        }
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('health_token');
          localStorage.removeItem('health_user');
          setCurrentUser(null);
        }
      });
  }, []);

  // Nếu truy cập bằng link chia sẻ bác sĩ công khai (/shared-report/:token)
  if (doctorToken) {
    return (
      <DoctorQuickViewPage
        token={doctorToken}
        onBack={() => {
          setDoctorToken(null);
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('health_token');
    localStorage.removeItem('health_user');
    setCurrentUser(null);
    setCurrentTab('dashboard');
  };

  const handleUpdateUser = (updatedUser) => {
    const merged = { ...currentUser, ...updatedUser };
    setCurrentUser(merged);
    localStorage.setItem('health_user', JSON.stringify(merged));
  };

  if (!currentUser) {
    return <AuthPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const avatarUrl = currentUser.avatar || currentUser.avatarUrl;
  const displayName = currentUser.fullName || currentUser.name || currentUser.email;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors pb-20 md:pb-8">
      {/* Header chính */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div 
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
                <Heart className="w-5 h-5 fill-white" />
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-lg leading-tight block">
                  HealthJourney
                </span>
                <span className="text-xs text-teal-600 dark:text-teal-400 font-medium block">
                  Nhật ký sức khỏe gia đình
                </span>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1.5 pl-4 border-l border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentTab('dashboard')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Tổng quan</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('health')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'health'
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Chỉ số sức khỏe</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('family')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'family'
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Gia đình</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('privacy')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'privacy'
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Quyền riêng tư</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('profile')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'profile'
                    ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <UserCog className="w-4 h-4" />
                <span>Hồ sơ</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Nút Chia sẻ Bác sĩ */}
            <button
              type="button"
              onClick={() => setIsDoctorShareOpen(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-xs font-bold transition-all cursor-pointer"
              title="Tạo liên kết chia sẻ an toàn cho Bác sĩ"
            >
              <Stethoscope className="w-4 h-4 text-teal-600" />
              <span>Gửi Bác sĩ</span>
            </button>

            {/* Nút bấm Ghi chỉ số nhanh */}
            <button
              type="button"
              onClick={() => setIsQuickLogOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm shadow-teal-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Ghi chỉ số</span>
            </button>

            {/* Nút gạt Dark / Light Theme (SCRUM-81) */}
            <ThemeToggle />

            {/* Chuông Thông Báo Khẩn Cấp (SCRUM-63) */}
            <NotificationBell />

            {/* User Profile Pill */}
            <button
              onClick={() => setCurrentTab('profile')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                currentTab === 'profile'
                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 text-teal-800 dark:text-teal-200'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
              title="Xem và chỉnh sửa hồ sơ cá nhân"
            >
              <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-xs font-semibold max-w-[90px] sm:max-w-[120px] truncate hidden sm:inline-block">
                {displayName}
              </span>
            </button>

            {/* Nút Đăng xuất */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all duration-200 cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <InvitationBanner 
          currentUser={currentUser} 
          onFamilyUpdated={() => {
            setCurrentTab('family');
          }} 
        />

        {currentTab === 'profile' ? (
          <ProfilePage
            currentUser={currentUser}
            onUpdateUser={handleUpdateUser}
            onBack={() => setCurrentTab('dashboard')}
          />
        ) : currentTab === 'health' ? (
          <HealthTrackerPage
            currentUser={currentUser}
            onOpenLogModal={() => setIsQuickLogOpen(true)}
          />
        ) : currentTab === 'family' ? (
          <FamilyPage
            currentUser={currentUser}
            onBack={() => setCurrentTab('dashboard')}
            onNavigateToPrivacy={() => setCurrentTab('privacy')}
          />
        ) : currentTab === 'privacy' ? (
          <PrivacyMatrixPage
            currentUser={currentUser}
            onBack={() => setCurrentTab('dashboard')}
          />
        ) : (
          /* TAB DASHBOARD / TỔNG QUAN */
          <div className="space-y-6">
            {/* Banner Chào Mừng */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Chăm sóc sức khỏe mỗi ngày
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Xin chào, {displayName}! 👋
                </h2>
                <p className="mt-2 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  Chào mừng bạn quay lại với <strong>HealthJourney</strong>. Hãy theo dõi các chỉ số sức khỏe đều đặn, tuân thủ lịch uống thuốc và kết nối yêu thương cùng các thành viên trong gia đình.
                </p>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setIsQuickLogOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ghi chỉ số mới</span>
                </button>
                <button
                  onClick={() => setIsDoctorShareOpen(true)}
                  className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  <span>Gửi Bác sĩ</span>
                </button>
              </div>
            </div>

            {/* Grid 2 Cột: Chuỗi Ngày Đo (StreakCard SCRUM-86) & Lịch Uống Thuốc (RemindersWidget SCRUM-68) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <StreakCard onLogClick={() => setIsQuickLogOpen(true)} />
              </div>
              <div className="lg:col-span-7">
                <RemindersWidget onRecordLogged={() => setCurrentTab('health')} />
              </div>
            </div>

            {/* AI Summary Card: Tóm tắt xu hướng sức khỏe bản thân (SCRUM-54 / SCRUM-58) */}
            <AiSummaryCard 
              memberId={currentUser._id} 
              isSelfView={true}
              memberName={currentUser.name || currentUser.fullName || 'bạn'}
            />

            {/* Thông tin tóm tắt chỉ số thể chất hiện tại */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Chiều cao</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {currentUser.heightCm ? `${currentUser.heightCm} cm` : 'Chưa thiết lập'}
                </div>
                <p className="text-xs text-slate-400 mt-1">Căn cứ theo dõi thể trạng & BMI</p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Giới tính sinh học</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {currentUser.gender === 'MALE' ? 'Nam (♂)' : currentUser.gender === 'FEMALE' ? 'Nữ (♀)' : 'Khác (⚧)'}
                </div>
                <p className="text-xs text-slate-400 mt-1">Thông tin hồ sơ y tế</p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Ngày sinh</span>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {currentUser.birthDate 
                    ? new Date(currentUser.birthDate).toLocaleDateString('vi-VN') 
                    : 'Chưa cập nhật'}
                </div>
                <p className="text-xs text-slate-400 mt-1">Theo dõi theo độ tuổi</p>
              </div>
            </div>

            {/* Quick Cards Điều Hướng */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <div 
                onClick={() => setCurrentTab('health')}
                className="p-5 rounded-2xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <Activity className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded-full">
                    Nhật ký
                  </span>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                  Chỉ số sức khỏe & Biểu đồ
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Ghi nhận Huyết áp, Nhịp tim, Cân nặng, Đường huyết và xem biểu đồ 7/30 ngày.
                </p>
              </div>

              <div 
                onClick={() => setCurrentTab('family')}
                className="p-5 rounded-2xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded-full">
                    Gia đình
                  </span>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                  Không gian Gia đình
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Mời người thân tham gia để cùng theo dõi và nhận cảnh báo khẩn cấp khi có nguy cơ.
                </p>
              </div>

              <div 
                onClick={() => setCurrentTab('privacy')}
                className="p-5 rounded-2xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <ShieldCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded-full">
                    Bảo mật
                  </span>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                  Quyền riêng tư & Chia sẻ
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Chủ động chọn những người thân được phép xem từng chỉ số của bạn (Default Deny).
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (SCRUM-82) */}
      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onQuickLogClick={() => setIsQuickLogOpen(true)}
      />

      {/* Modal ghi chỉ số nhanh toàn cục */}
      <HealthRecordModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onSuccess={() => {
          setCurrentTab('health');
        }}
        currentUserHeight={currentUser?.heightCm}
      />

      {/* Modal Chia sẻ Bác Sĩ (SCRUM-75) */}
      <DoctorShareModal
        isOpen={isDoctorShareOpen}
        onClose={() => setIsDoctorShareOpen(false)}
      />

      {/* Modal Lời mời gia đình từ link URL */}
      <InvitationModal
        token={urlInviteToken}
        isOpen={isUrlModalOpen}
        onClose={() => {
          setIsUrlModalOpen(false);
          const url = new URL(window.location);
          url.searchParams.delete('inviteToken');
          url.searchParams.delete('invitation');
          window.history.replaceState({}, '', url);
        }}
        onSuccess={() => {
          setCurrentTab('family');
        }}
      />
    </div>
  );
}
