import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CheckCircle2, 
  X, 
  Loader2, 
  Clock, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { invitationService } from '../services/api';
import InvitationModal from './InvitationModal';

/**
 * Banner hiển thị trên đầu ứng dụng khi Member có lời mời gia nhập nhóm gia đình (SCRUM-39)
 */
export default function InvitationBanner({ currentUser, onFamilyUpdated }) {
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tải danh sách lời mời PENDING của user
  const loadPendingInvitations = async () => {
    if (!currentUser?.email) return;
    try {
      setLoading(true);
      const res = await invitationService.getPending();
      if (res.success && Array.isArray(res.invitations)) {
        setPendingInvitations(res.invitations);
      }
    } catch (err) {
      console.error('Không thể kiểm tra lời mời đang chờ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingInvitations();
  }, [currentUser?.email]);

  const handleQuickAccept = async (invitation) => {
    try {
      setProcessingId(invitation.id);
      await invitationService.accept(invitation.token);
      // Xóa khỏi danh sách lời mời hiển thị
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      if (onFamilyUpdated) {
        onFamilyUpdated();
      }
    } catch (err) {
      console.error('Lỗi khi chấp nhận lời mời:', err);
      // Mở modal nếu cần hiển thị lỗi chi tiết
      setSelectedToken(invitation.token);
      setIsModalOpen(true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleQuickDecline = async (invitation) => {
    try {
      setProcessingId(invitation.id);
      await invitationService.decline(invitation.token);
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      if (onFamilyUpdated) {
        onFamilyUpdated();
      }
    } catch (err) {
      console.error('Lỗi khi từ chối lời mời:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenDetailModal = (token) => {
    setSelectedToken(token);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    loadPendingInvitations();
    if (onFamilyUpdated) {
      onFamilyUpdated();
    }
  };

  if (!pendingInvitations || pendingInvitations.length === 0) {
    return (
      <InvitationModal
        token={selectedToken}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    );
  }

  // Lấy lời mời mới nhất để hiển thị
  const activeInvite = pendingInvitations[0];
  const isProcessing = processingId === activeInvite.id;

  return (
    <>
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/15 border border-teal-200/90 p-4 sm:p-5 shadow-xs transition-all animate-in fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100/90 px-2.5 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  Lời mời gia nhập gia đình
                </span>
                {pendingInvitations.length > 1 && (
                  <span className="text-xs text-slate-500 font-medium">
                    (+{pendingInvitations.length - 1} lời mời khác)
                  </span>
                )}
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                <strong className="text-teal-700">{activeInvite.inviterName}</strong> đã gửi lời mời bạn tham gia nhóm{' '}
                <span className="text-slate-900 underline decoration-teal-400 decoration-2 font-extrabold">
                  "{activeInvite.familyName}"
                </span>
              </h4>
              <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Hiệu lực trong vòng 48 giờ kể từ lúc tạo</span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
            <button
              type="button"
              onClick={() => handleOpenDetailModal(activeInvite.token)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-teal-700 hover:bg-white/80 rounded-lg transition-colors cursor-pointer"
            >
              Xem chi tiết
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleQuickDecline(activeInvite)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200/90 bg-white rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? 'Đang xử lý...' : 'Từ chối'}
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleQuickAccept(activeInvite)}
              className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm shadow-teal-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Chấp nhận</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <InvitationModal
        token={selectedToken}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </>
  );
}
