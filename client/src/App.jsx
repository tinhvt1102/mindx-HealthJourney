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
import Sidebar from './components/Sidebar';
import WeeklyHabitBoard from './components/WeeklyHabitBoard';
import {
  Heart,
  Activity,
  Users,
  ShieldCheck,
  UserCog,
  LayoutDashboard,
  Plus,
  Stethoscope,
  Menu,
  CalendarCheck,
} from 'lucide-react';
import { authService } from './services/api';

const TAB_META = {
  dashboard: { title: 'Tổng quan sức khỏe', icon: LayoutDashboard },
  health: { title: 'Chỉ số sức khỏe & Biểu đồ', icon: Activity },
  habits: { title: 'Kế hoạch tuần & Thói quen', icon: CalendarCheck },
  family: { title: 'Không gian Gia đình', icon: Users },
  privacy: { title: 'Quyền riêng tư & Chia sẻ', icon: ShieldCheck },
  profile: { title: 'Hồ sơ cá nhân', icon: UserCog },
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');

  // Trạng thái thu gọn Sidebar trên Desktop & mở Drawer trên Mobile
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('health_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('health_sidebar_collapsed', String(next));
      return next;
    });
  };

  if (!currentUser) {
    return <AuthPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const avatarUrl = currentUser.avatar || currentUser.avatarUrl;
  const displayName = currentUser.fullName || currentUser.name || currentUser.email;
  const activeTabMeta = TAB_META[currentTab] || TAB_META.dashboard;
  const ActiveTabIcon = activeTabMeta.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors flex">
      {/* Thanh điều hướng Sidebar trái (Desktop) & Drawer (Mobile) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenDoctorShare={() => setIsDoctorShareOpen(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Cột nội dung chính bên phải */}
      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-8">
        {/* Topbar tối giản (h-14) */}
        <header className="h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30">
          <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
            {/* Trái: Menu + Logo trên Mobile | Tiêu đề trang hiện tại trên Desktop */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Mở menu điều hướng"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div
                onClick={() => setCurrentTab('dashboard')}
                className="flex md:hidden items-center gap-2 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm">
                  <Heart className="w-4 h-4 fill-white" />
                </div>
                <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                  HealthJourney
                </span>
              </div>

              <div className="hidden md:flex items-center gap-2.5 min-w-0">
                <ActiveTabIcon className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                <h1 className="font-bold text-slate-900 dark:text-white text-base truncate">
                  {activeTabMeta.title}
                </h1>
              </div>
            </div>

            {/* Phải: Các nút thao tác nhanh tối giản */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsQuickLogOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm shadow-teal-600/25 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Ghi chỉ số</span>
              </button>

              <ThemeToggle />
              <NotificationBell />

              <button
                type="button"
                onClick={() => setCurrentTab('profile')}
                className={`p-0.5 rounded-full border-2 transition-all cursor-pointer ${
                  currentTab === 'profile'
                    ? 'border-teal-500 ring-2 ring-teal-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-teal-400'
                }`}
                title={`Hồ sơ cá nhân (${displayName})`}
                aria-label="Hồ sơ cá nhân"
              >
                <div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
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
        ) : currentTab === 'habits' ? (
          <WeeklyHabitBoard
            onNavigateToAi={() => setCurrentTab('dashboard')}
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
              onOpenHabits={() => setCurrentTab('habits')}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
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
                  Chỉ số sức khỏe
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Ghi nhận Huyết áp, Nhịp tim, Cân nặng, Đường huyết và biểu đồ.
                </p>
              </div>

              <div 
                onClick={() => setCurrentTab('habits')}
                className="p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <CalendarCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                    Mới • B & C
                  </span>
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                  Kế hoạch tuần
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Tick checklist ăn uống, tập luyện theo tuần và duy trì Habit Streak.
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
                  Mời người thân cùng theo dõi và nhận cảnh báo khẩn cấp khi có nguy cơ.
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
                  Quyền riêng tư
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Chủ động cấp quyền xem từng chỉ số cho người thân (Default Deny).
                </p>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>

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
