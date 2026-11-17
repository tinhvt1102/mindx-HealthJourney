import React, { useEffect } from 'react';
import {
  Heart,
  LayoutDashboard,
  Activity,
  Users,
  ShieldCheck,
  Stethoscope,
  UserCog,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  CalendarCheck,
} from 'lucide-react';

const MAIN_NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'health', label: 'Chỉ số sức khỏe', icon: Activity },
  { id: 'habits', label: 'Kế hoạch tuần', icon: CalendarCheck },
  { id: 'family', label: 'Gia đình', icon: Users },
  { id: 'privacy', label: 'Quyền riêng tư', icon: ShieldCheck },
];

const UTILITY_NAV_ITEMS = [
  { id: 'doctor_share', label: 'Gửi Bác sĩ', icon: Stethoscope, isAction: true },
  { id: 'profile', label: 'Hồ sơ cá nhân', icon: UserCog },
];

/**
 * Render một nhóm mục điều hướng dùng chung cho cả Sidebar Desktop và Mobile Drawer.
 */
function NavSection({
  title,
  items,
  currentTab,
  isCollapsed,
  showCollapsedDivider = false,
  onSelectTab,
  onOpenDoctorShare,
}) {
  return (
    <div className="space-y-1">
      {!isCollapsed ? (
        <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {title}
        </div>
      ) : (
        showCollapsedDivider && (
          <div className="mx-3 my-2 border-t border-slate-200/80 dark:border-slate-800" />
        )
      )}

      {items.map((item) => {
        const Icon = item.icon;
        const isActive = !item.isAction && currentTab === item.id;

        const handleClick = () => {
          if (item.isAction && item.id === 'doctor_share') {
            onOpenDoctorShare();
          } else {
            onSelectTab(item.id);
          }
        };

        return (
          <button
            key={item.id}
            type="button"
            onClick={handleClick}
            title={isCollapsed ? item.label : undefined}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
              isCollapsed ? 'justify-center px-2' : ''
            } ${
              isActive
                ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 shadow-2xs ring-1 ring-teal-200/70 dark:ring-teal-800/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Icon
              className={`w-[18px] h-[18px] shrink-0 ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400'
                  : item.isAction
                  ? 'text-teal-600/80 dark:text-teal-400/80'
                  : ''
              }`}
            />
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Nội dung bên trong Sidebar (dùng chung cho Desktop và Mobile Drawer).
 */
function SidebarPanel({
  currentTab,
  onSelectTab,
  onOpenDoctorShare,
  onLogout,
  currentUser,
  isCollapsed,
  isMobile,
  onCloseMobile,
}) {
  const avatarUrl = currentUser?.avatar || currentUser?.avatarUrl;
  const displayName = currentUser?.fullName || currentUser?.name || currentUser?.email || 'Thành viên';
  const effectiveCollapsed = !isMobile && isCollapsed;

  return (
    <div className="flex flex-col h-full">
      {/* Đầu Sidebar: Thương hiệu đồng bộ chiều cao h-14 với Topbar */}
      <div
        className={`h-14 shrink-0 border-b border-slate-200/80 dark:border-slate-800 flex items-center ${
          effectiveCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        <div
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group min-w-0"
          title="HealthJourney - Tổng quan"
        >
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-600/20 group-hover:scale-105 transition-transform shrink-0">
            <Heart className="w-4 h-4 fill-white" />
          </div>
          {!effectiveCollapsed && (
            <div className="min-w-0">
              <span className="font-bold text-slate-900 dark:text-white text-base leading-tight block truncate">
                HealthJourney
              </span>
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium block truncate">
                Sức khỏe gia đình
              </span>
            </div>
          )}
        </div>

        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Thân Sidebar: Các nhóm điều hướng */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Điều hướng chính">
        <NavSection
          title="Theo dõi"
          items={MAIN_NAV_ITEMS}
          currentTab={currentTab}
          isCollapsed={effectiveCollapsed}
          onSelectTab={onSelectTab}
          onOpenDoctorShare={onOpenDoctorShare}
        />

        <NavSection
          title="Tiện ích & Hồ sơ"
          items={UTILITY_NAV_ITEMS}
          currentTab={currentTab}
          isCollapsed={effectiveCollapsed}
          showCollapsedDivider
          onSelectTab={onSelectTab}
          onOpenDoctorShare={onOpenDoctorShare}
        />
      </nav>

      {/* Chân Sidebar: Thông tin người dùng & Nút đăng xuất */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          title={effectiveCollapsed ? `${displayName} (Hồ sơ)` : 'Xem hồ sơ cá nhân'}
          className={`w-full flex items-center gap-2.5 p-2 rounded-xl transition-colors cursor-pointer ${
            effectiveCollapsed ? 'justify-center' : ''
          } ${
            currentTab === 'profile'
              ? 'bg-slate-100 dark:bg-slate-800'
              : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          {!effectiveCollapsed && (
            <div className="min-w-0 text-left flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {displayName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {currentUser?.email}
              </div>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onLogout}
          title={effectiveCollapsed ? 'Đăng xuất' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer ${
            effectiveCollapsed ? 'justify-center px-2' : ''
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!effectiveCollapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </div>
  );
}

/**
 * Thanh điều hướng Sidebar trái cho Desktop (hỗ trợ thu gọn) & Slide-over Drawer cho Mobile.
 */
export default function Sidebar({
  currentTab,
  onSelectTab,
  onOpenDoctorShare,
  onLogout,
  currentUser,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) {
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const handleSelectAndClose = (tabId) => {
    onSelectTab(tabId);
    if (isMobileOpen) onCloseMobile();
  };

  const handleDoctorShareAndClose = () => {
    onOpenDoctorShare();
    if (isMobileOpen) onCloseMobile();
  };

  return (
    <>
      {/* Desktop Sidebar (cố định bên trái, có nút thu gọn ở cạnh phải) */}
      <aside
        className={`hidden md:flex flex-col sticky top-0 h-screen shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-all duration-200 z-30 ${
          isCollapsed ? 'w-[76px]' : 'w-60'
        }`}
      >
        <SidebarPanel
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          onOpenDoctorShare={onOpenDoctorShare}
          onLogout={onLogout}
          currentUser={currentUser}
          isCollapsed={isCollapsed}
          isMobile={false}
        />

        {/* Nút thu gọn / mở rộng Sidebar nằm trên đường viền */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden md:flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 shadow-xs absolute -right-3 top-4 z-40 transition-colors cursor-pointer"
          title={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          aria-label={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-3.5 h-3.5" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5" />
          )}
        </button>
      </aside>

      {/* Mobile Slide-over Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[82vw] h-full bg-white dark:bg-slate-900 shadow-2xl border-r border-slate-200 dark:border-slate-800 z-10">
            <SidebarPanel
              currentTab={currentTab}
              onSelectTab={handleSelectAndClose}
              onOpenDoctorShare={handleDoctorShareAndClose}
              onLogout={() => {
                onCloseMobile();
                onLogout();
              }}
              currentUser={currentUser}
              isCollapsed={false}
              isMobile={true}
              onCloseMobile={onCloseMobile}
            />
          </aside>
        </div>
      )}
    </>
  );
}
