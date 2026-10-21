import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import ProfilePage from './components/ProfilePage';
import FamilyPage from './components/FamilyPage';
import InvitationBanner from './components/InvitationBanner';
import InvitationModal from './components/InvitationModal';
import { 
  Heart, 
  LogOut, 
  User, 
  Activity, 
  Users, 
  Shield, 
  UserCog, 
  LayoutDashboard, 
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { authService } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard'); // Mặc định mở Dashboard hoặc Family

  // Hỗ trợ duyệt lời mời từ URL query params (?inviteToken=... hoặc ?invitation=...)
  const [urlInviteToken, setUrlInviteToken] = useState(null);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);

  useEffect(() => {
    // Kiểm tra URL params khi mở trang
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('inviteToken') || params.get('invitation');
    if (tokenFromUrl) {
      setUrlInviteToken(tokenFromUrl);
      setIsUrlModalOpen(true);
    }

    const savedUser = localStorage.getItem('health_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('health_user');
      }
    }

    // Đồng bộ thông tin mới nhất từ máy chủ nếu đã có token
    const token = localStorage.getItem('health_token');
    if (token) {
      authService.getMe()
        .then((res) => {
          if (res?.user) {
            setCurrentUser(res.user);
            localStorage.setItem('health_user', JSON.stringify(res.user));
          }
        })
        .catch(() => {
          // Token hết hạn thì interceptor đã xử lý
        });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('health_token');
    localStorage.removeItem('health_user');
    setCurrentUser(null);
    setCurrentTab('dashboard');
  };

  const handleUpdateUser = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  if (!currentUser) {
    return <AuthPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div 
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
                <Heart className="w-5 h-5 fill-white" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-lg leading-tight block">HealthJourney</span>
                <span className="text-xs text-teal-600 font-medium block">Nhật ký sức khỏe gia đình</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden sm:flex items-center gap-1.5 pl-4 border-l border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentTab('dashboard')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Tổng quan</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('family')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'family'
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Gia đình</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('profile')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'profile'
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <UserCog className="w-4 h-4" />
                <span>Hồ sơ cá nhân</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* User Pill Button (Click để vào Profile) */}
            <button
              onClick={() => setCurrentTab('profile')}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                currentTab === 'profile'
                  ? 'bg-teal-50 border-teal-200 text-teal-800'
                  : 'bg-slate-100 border-slate-200/80 text-slate-700 hover:bg-slate-200/70'
              }`}
              title="Xem và chỉnh sửa hồ sơ cá nhân"
            >
              <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">
                {(currentUser.fullName || currentUser.email || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold max-w-[130px] truncate">
                {currentUser.fullName || currentUser.email}
              </span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200 cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="sm:hidden flex border-t border-slate-100 bg-white px-4 py-1.5 gap-2">
          <button
            type="button"
            onClick={() => setCurrentTab('dashboard')}
            className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg ${
              currentTab === 'dashboard' ? 'bg-teal-50 text-teal-700' : 'text-slate-500'
            }`}
          >
            Tổng quan
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('family')}
            className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg ${
              currentTab === 'family' ? 'bg-teal-50 text-teal-700' : 'text-slate-500'
            }`}
          >
            Gia đình
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('profile')}
            className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg ${
              currentTab === 'profile' ? 'bg-teal-50 text-teal-700' : 'text-slate-500'
            }`}
          >
            Hồ sơ
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Banner thông báo lời mời cho Member (SCRUM-39) */}
        <InvitationBanner 
          currentUser={currentUser} 
          onFamilyUpdated={() => {
            // Khi accept lời mời, có thể tự động chuyển sang tab family để xem
            setCurrentTab('family');
          }} 
        />

        {currentTab === 'profile' ? (
          <ProfilePage
            currentUser={currentUser}
            onUpdateUser={handleUpdateUser}
            onBack={() => setCurrentTab('dashboard')}
          />
        ) : currentTab === 'family' ? (
          <FamilyPage
            currentUser={currentUser}
            onBack={() => setCurrentTab('dashboard')}
          />
        ) : (
          <div className="space-y-6">
            {/* Banner chào mừng & Quick link sang Profile */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Hệ thống hoạt động bình thường
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Xin chào, {currentUser.fullName || 'bạn'}! 👋
                </h2>
                <p className="mt-2 text-slate-600 text-sm leading-relaxed">
                  Chào mừng bạn quay lại với <strong>HealthJourney</strong>. Bạn có thể cập nhật thông tin thể chất trong mục Hồ sơ hoặc thiết lập nhóm Gia đình để cùng người thân theo dõi sức khỏe.
                </p>
              </div>

              {/* Quick actions */}
              <div className="shrink-0 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setCurrentTab('family')}
                  className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>Quản lý Gia đình</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thông tin tóm tắt chỉ số thể chất hiện tại */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Chiều cao hiện tại</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {currentUser.heightCm ? `${currentUser.heightCm} cm` : 'Chưa thiết lập'}
                </div>
                <p className="text-xs text-slate-400 mt-1">Chuẩn tính chỉ số BMI cơ thể</p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Giới tính sinh học</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {currentUser.gender === 'MALE' ? 'Nam (♂)' : currentUser.gender === 'FEMALE' ? 'Nữ (♀)' : 'Khác (⚧)'}
                </div>
                <p className="text-xs text-slate-400 mt-1">Khung tham chiếu y tế</p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Ngày sinh</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {currentUser.birthDate 
                    ? new Date(currentUser.birthDate).toLocaleDateString('vi-VN') 
                    : 'Chưa cập nhật'}
                </div>
                <p className="text-xs text-slate-400 mt-1">Tính toán phân nhóm tuổi</p>
              </div>
            </div>

            {/* Các nhóm tính năng chính */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-teal-300 transition-all">
                <Activity className="w-6 h-6 text-teal-600 mb-3" />
                <h4 className="font-semibold text-slate-900">Chỉ số sức khỏe</h4>
                <p className="text-xs text-slate-500 mt-1">Ghi nhận Huyết áp, Nhịp tim, Cân nặng, Đường huyết.</p>
              </div>

              <div 
                onClick={() => setCurrentTab('family')}
                className="p-5 rounded-xl border border-teal-200/80 bg-teal-50/40 hover:bg-teal-50 hover:border-teal-400 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-3">
                  <Users className="w-6 h-6 text-teal-600" />
                  <span className="text-[11px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                    Gia đình
                  </span>
                </div>
                <h4 className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                  Không gian Gia đình
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Mời người thân qua Email, duyệt lời mời bằng Token và quản lý thành viên.
                </p>
              </div>

              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-teal-300 transition-all">
                <Shield className="w-6 h-6 text-teal-600 mb-3" />
                <h4 className="font-semibold text-slate-900">Phân quyền riêng tư</h4>
                <p className="text-xs text-slate-500 mt-1">Bật/tắt ai được xem chỉ số nào (Default Deny).</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal duyệt lời mời trực tiếp từ URL (?inviteToken=...) */}
      <InvitationModal
        token={urlInviteToken}
        isOpen={isUrlModalOpen}
        onClose={() => {
          setIsUrlModalOpen(false);
          // Xóa query param trên URL mà không reload trang
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
