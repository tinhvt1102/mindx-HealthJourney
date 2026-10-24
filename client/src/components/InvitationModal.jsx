import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Clock, 
  ShieldCheck, 
  X,
  ExternalLink
} from 'lucide-react';
import { invitationService } from '../services/api';

/**
 * Modal duyệt chi tiết lời mời tham gia nhóm gia đình
 * Cho phép xem chi tiết người mời, hạn 48h và thực hiện Accept / Decline
 */
export default function InvitationModal({ 
  token, 
  isOpen, 
  onClose, 
  onSuccess 
}) {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState(null);

  useEffect(() => {
    if (isOpen && token) {
      fetchInvitationDetails(token);
    } else {
      setInvitation(null);
      setError('');
      setResultMessage(null);
    }
  }, [isOpen, token]);

  const fetchInvitationDetails = async (invitationToken) => {
    try {
      setLoading(true);
      setError('');
      const res = await invitationService.getByToken(invitationToken);
      if (res.success && res.invitation) {
        setInvitation(res.invitation);
      } else {
        setError(res.message || 'Không thể lấy thông tin lời mời');
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin lời mời:', err);
      setError(
        err.response?.data?.message || 
        'Lời mời không tồn tại hoặc đã hết hạn.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;
    try {
      setProcessing(true);
      setError('');
      const res = await invitationService.accept(token);
      setResultMessage({
        type: 'success',
        text: res.message || 'Bạn đã chấp nhận lời mời và gia nhập gia đình thành công!'
      });
      if (onSuccess) {
        onSuccess({ type: 'accepted', family: res.family });
      }
    } catch (err) {
      console.error('Lỗi khi chấp nhận lời mời:', err);
      setError(err.response?.data?.message || 'Không thể chấp nhận lời mời');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    try {
      setProcessing(true);
      setError('');
      const res = await invitationService.decline(token);
      setResultMessage({
        type: 'declined',
        text: res.message || 'Bạn đã từ chối lời mời tham gia nhóm.'
      });
      if (onSuccess) {
        onSuccess({ type: 'declined' });
      }
    } catch (err) {
      console.error('Lỗi khi từ chối lời mời:', err);
      setError(err.response?.data?.message || 'Không thể từ chối lời mời');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Lời mời tham gia gia đình</h3>
              <p className="text-xs text-slate-500">Mời gia nhập không gian sức khỏe gia đình</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              <p className="text-sm font-medium">Đang tải thông tin lời mời...</p>
            </div>
          ) : error ? (
            <div className="py-6 space-y-4">
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-900">Không thể xử lý lời mời</h4>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Đóng lại
                </button>
              </div>
            </div>
          ) : resultMessage ? (
            <div className="py-6 space-y-4 text-center">
              <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
                resultMessage.type === 'success' 
                  ? 'bg-emerald-100 text-emerald-600' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {resultMessage.type === 'success' ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <XCircle className="w-8 h-8" />
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900">
                  {resultMessage.type === 'success' ? 'Tham gia thành công!' : 'Đã từ chối lời mời'}
                </h4>
                <p className="text-sm text-slate-600 max-w-sm mx-auto">
                  {resultMessage.text}
                </p>
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-sm cursor-pointer"
                >
                  Hoàn tất
                </button>
              </div>
            </div>
          ) : invitation ? (
            <div className="space-y-5">
              {/* Card thông tin gia đình & người mời */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-50/70 via-white to-slate-50 border border-teal-100 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">Tên nhóm gia đình</span>
                    <h4 className="text-xl font-bold text-slate-900 mt-0.5">{invitation.familyName}</h4>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    invitation.status === 'PENDING' && !invitation.isExpired
                      ? 'bg-amber-100 text-amber-800'
                      : invitation.status === 'ACCEPTED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {invitation.isExpired 
                      ? 'Đã hết hạn' 
                      : invitation.status === 'PENDING' 
                      ? 'Đang chờ duyệt' 
                      : invitation.status === 'ACCEPTED'
                      ? 'Đã tham gia'
                      : 'Đã từ chối'}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {(invitation.inviterName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 font-medium">Người gửi lời mời:</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">{invitation.inviterName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>
                    Hết hạn: {invitation.expiresAt 
                      ? new Date(invitation.expiresAt).toLocaleString('vi-VN') 
                      : 'Trong vòng 48 giờ'}
                  </span>
                </div>
              </div>

              {/* Thông báo quyền riêng tư */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <p>
                  Khi tham gia, bạn và người thân có thể cùng nhau theo dõi sức khỏe. Bạn có toàn quyền chọn những chỉ số muốn chia sẻ.
                </p>
              </div>

              {/* Actions */}
              {invitation.status === 'PENDING' && !invitation.isExpired ? (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={processing}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Từ chối lời mời
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={processing}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Chấp nhận gia nhập</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    Đóng lại
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
