import React from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  Plus, 
  Users, 
  User, 
  ShieldCheck 
} from 'lucide-react';

export default function MobileBottomNav({ currentTab, setCurrentTab, onQuickLogClick }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-2 py-1.5 shadow-lg">
      <div className="flex items-center justify-around max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            currentTab === 'dashboard'
              ? 'text-teal-600 dark:text-teal-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Tổng quan</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('health')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            currentTab === 'health'
              ? 'text-teal-600 dark:text-teal-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Activity className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Chỉ số</span>
        </button>

        {/* Nút Ghi Nhanh (+) Nổi Bật Ở Giữa */}
        <button
          type="button"
          onClick={onQuickLogClick}
          className="flex flex-col items-center -mt-5 cursor-pointer group"
          title="Ghi nhận chỉ số nhanh"
        >
          <div className="w-12 h-12 rounded-full bg-linear-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-600/40 group-hover:scale-110 active:scale-95 transition-all">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 mt-0.5">
            Ghi đo
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('family')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            currentTab === 'family'
              ? 'text-teal-600 dark:text-teal-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Gia đình</span>
        </button>

        <button
          type="button"
          onClick={() => setCurrentTab('profile')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            currentTab === 'profile'
              ? 'text-teal-600 dark:text-teal-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          <User className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Hồ sơ</span>
        </button>
      </div>
    </div>
  );
}
