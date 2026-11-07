import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  CheckCheck, 
  PhoneCall, 
  X, 
  ShieldAlert, 
  Clock, 
  ExternalLink,
  HeartPulse
} from 'lucide-react';
import { notificationService } from '../services/api';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState(null);

  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getAll();
      if (res?.data) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.error('Lỗi lấy thông báo:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Polling nhẹ mỗi 30 giây để cập nhật thông báo khẩn cấp kịp thời
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, []);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Lỗi đánh dấu đã đọc:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Lỗi đánh dấu tất cả đã đọc:', err);
    }
  };

  const openEmergencyModal = (notif) => {
    setSelectedEmergency(notif);
    if (!notif.isRead) {
      handleMarkAsRead(notif._id);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Nút bấm Chuông */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer dark:text-slate-300 dark:hover:bg-slate-800"
        title="Thông báo sức khỏe"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-5 h-5 px-1 bg-rose-600 text-white text-[11px] font-bold rounded-full animate-pulse shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/80">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Thông báo khẩn cấp & nhắc nhở
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 font-medium flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-2 stroke-1 opacity-50" />
                <p className="text-sm">Bạn chưa có thông báo mới nào</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isCritical = notif.type === 'CRITICAL_ALERT';
                return (
                  <div
                    key={notif._id}
                    onClick={() => openEmergencyModal(notif)}
                    className={`p-3.5 transition-colors cursor-pointer flex gap-3 text-left ${
                      !notif.isRead
                        ? isCritical
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                          : 'bg-teal-50/40 dark:bg-teal-950/20 hover:bg-teal-50/60 dark:hover:bg-teal-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${
                        isCritical
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400'
                          : 'bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400'
                      }`}
                    >
                      {isCritical ? (
                        <AlertTriangle className="w-5 h-5 animate-bounce" />
                      ) : (
                        <HeartPulse className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4
                          className={`text-xs font-bold leading-tight truncate ${
                            isCritical
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between mt-2 pt-1">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                        {isCritical && (
                          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline">
                            Xem sơ cứu & gọi 🚨
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal Hướng Dẫn Sơ Cứu & Gọi Cấp Cứu Nhanh (AC3 SCRUM-48) */}
      {selectedEmergency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-rose-500 overflow-hidden relative">
            <button
              type="button"
              onClick={() => setSelectedEmergency(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  Cảnh báo Y tế Nguy cấp
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  Chỉ số sức khỏe vượt ngưỡng nguy kịch
                </p>
              </div>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 mb-4">
              <p className="text-sm font-semibold text-rose-950 dark:text-rose-200 mb-1">
                {selectedEmergency.title}
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {selectedEmergency.message}
              </p>
            </div>

            {selectedEmergency.data?.instructions && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 mb-6">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider mb-2">
                  🚑 Hướng dẫn xử lý & sơ cứu khẩn cấp:
                </h4>
                <p className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed whitespace-pre-line">
                  {selectedEmergency.data.instructions}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {selectedEmergency.data?.patientPhone ? (
                <a
                  href={`tel:${selectedEmergency.data.patientPhone}`}
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4" />
                  Gọi ngay ({selectedEmergency.data.patientPhone})
                </a>
              ) : (
                <a
                  href="tel:115"
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4" />
                  Gọi cấp cứu 115
                </a>
              )}

              <button
                type="button"
                onClick={() => setSelectedEmergency(null)}
                className="py-3 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Đã nắm rõ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
