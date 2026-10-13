import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import { Heart, LogOut, User, Activity, Users, Shield } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('health_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('health_user');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('health_token');
    localStorage.removeItem('health_user');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <AuthPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
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

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
              <User className="w-4 h-4 text-teal-600" />
              <span>{currentUser.fullName || currentUser.email}</span>
            </div>
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

      {/* Main Content Preview */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Xác thực thành công
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            Xin chào, {currentUser.fullName}! 
          </h2>
          <p className="mt-2 text-slate-600 text-sm max-w-2xl leading-relaxed">
            Bạn đã đăng nhập thành công vào hệ thống <strong>HealthJourney</strong>.
          </p>

          {/* 3 Quick Cards cho các Sprint tiếp theo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-teal-300 transition-all">
              <Activity className="w-6 h-6 text-teal-600 mb-3" />
              <h4 className="font-semibold text-slate-900">Chỉ số cá nhân</h4>
              <p className="text-xs text-slate-500 mt-1">Ghi nhận Huyết áp, Nhịp tim, Cân nặng, Đường huyết.</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-teal-300 transition-all">
              <Users className="w-6 h-6 text-teal-600 mb-3" />
              <h4 className="font-semibold text-slate-900">Nhóm Gia đình</h4>
              <p className="text-xs text-slate-500 mt-1">Tạo Family và gửi lời mời người thân qua Email.</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-teal-300 transition-all">
              <Shield className="w-6 h-6 text-teal-600 mb-3" />
              <h4 className="font-semibold text-slate-900">Phân quyền riêng tư</h4>
              <p className="text-xs text-slate-500 mt-1">Bật/tắt ai được xem chỉ số nào (Default Deny).</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
