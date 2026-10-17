import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import ProfileModal from './components/ProfileModal';
import { 
  Heart, 
  LogOut, 
  User, 
  Activity, 
  Users, 
  Shield, 
  Settings, 
  Sparkles,
  ShieldCheck,
  Ruler
} from 'lucide-react';
import { authService } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('health_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('health_user');
      }
    }
    // Lấy thông tin user mới nhất từ backend nếu có token
    const token = localStorage.getItem('health_token');
    if (token) {
      authService.getMe()
        .then((res) => {
          if (res.success && res.user) {
            setCurrentUser(res.user);
            localStorage.setItem('health_user', JSON.stringify(res.user));
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('health_token');
    localStorage.removeItem('health_user');
    setCurrentUser(null);
  };

  const handleUserUpdated = (updatedUser) => {
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
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg leading-tight block">HealthJourney</span>
              <span className="text-xs text-teal-600 font-medium block">Nhật ký sức khỏe gia đình</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User Profile Pill button */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-sm font-medium transition-colors cursor-pointer border border-slate-200/60"
              title="Xem và chỉnh sửa hồ sơ cá nhân"
            >
              <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="max-w-[120px] sm:max-w-[180px] truncate">{displayName}</span>
              <Settings className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200 cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Welcome & Profile Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-teal-50 border-2 border-teal-500/20 text-teal-700 flex items-center justify-center text-2xl font-bold shadow-inner overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>
                {currentUser.isVerified && (
                  <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-white rounded-full shadow-sm" title="Email đã xác thực OTP">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {displayName}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Đã xác thực OTP
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                  <span>{currentUser.email}</span>
                  {currentUser.heightCm && (
                    <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-xs">
                      <Ruler className="w-3 h-3 text-teal-600" />
                      {currentUser.heightCm} cm
                    </span>
                  )}
                  {currentUser.gender && (
                    <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-xs capitalize">
                      {currentUser.gender === 'male' ? 'Nam' : currentUser.gender === 'female' ? 'Nữ' : 'Khác'}
                    </span>
                  )}
                </p>
                {currentUser.bio && (
                  <p className="text-xs text-slate-600 mt-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                    "{currentUser.bio}"
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowProfileModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Settings className="w-4 h-4" />
              <span>Cập nhật hồ sơ & Cloudinary</span>
            </button>
          </div>

          <div className="pt-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Lộ trình tính năng tiếp theo (Sprint 2 & 3)
            </h3>
            {/* 3 Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-teal-300 transition-all">
                <Activity className="w-6 h-6 text-teal-600 mb-3" />
                <h4 className="font-semibold text-slate-900">Chỉ số cá nhân (Epic 2)</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Nhập & biểu đồ Huyết áp, Nhịp tim, Cân nặng, Đường huyết theo chuẩn WHO.
                </p>
              </div>
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-teal-300 transition-all">
                <Users className="w-6 h-6 text-teal-600 mb-3" />
                <h4 className="font-semibold text-slate-900">Nhóm Gia đình (Epic 3)</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Tạo Family Group, mời người thân qua Email, liên kết người cao tuổi.
                </p>
              </div>
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-teal-300 transition-all">
                <Shield className="w-6 h-6 text-teal-600 mb-3" />
                <h4 className="font-semibold text-slate-900">Phân quyền riêng tư (Epic 4)</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Default Deny: Kiểm soát ai trong gia đình được xem chỉ số sức khỏe của bạn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Profile / Avatar */}
      {showProfileModal && (
        <ProfileModal
          user={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUserUpdated={handleUserUpdated}
        />
      )}
    </div>
  );
}
