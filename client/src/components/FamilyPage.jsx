import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Mail, 
  Copy, 
  Check, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Plus, 
  Calendar, 
  User, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { familyService, invitationService } from '../services/api';
import InvitationModal from './InvitationModal';

export default function FamilyPage({ currentUser, onBack, onNavigateToPrivacy }) {
  // Danh sách các nhóm gia đình của user
  const [families, setFamilies] = useState([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [currentFamily, setCurrentFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [familyLoading, setFamilyLoading] = useState(false);

  // Trạng thái form tạo nhóm gia đình
  const [isCreatingFamily, setIsCreatingFamily] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [creating, setCreating] = useState(false);

  // Trạng thái form gửi lời mời (cho Admin)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [lastSentInvitation, setLastSentInvitation] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Trạng thái duyệt lời mời bằng Token thủ công
  const [manualToken, setManualToken] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewToken, setReviewToken] = useState('');

  // Thông báo phản hồi
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Tải danh sách nhóm gia đình của user
  const fetchFamilies = async () => {
    try {
      setLoading(true);
      const res = await familyService.getMyFamilies();
      if (res.success && Array.isArray(res.families)) {
        setFamilies(res.families);
        if (res.families.length > 0) {
          // Mặc định chọn nhóm đầu tiên nếu chưa chọn
          if (!selectedFamilyId || !res.families.some(f => f._id === selectedFamilyId)) {
            setSelectedFamilyId(res.families[0]._id);
          }
        } else {
          setSelectedFamilyId(null);
          setCurrentFamily(null);
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách gia đình:', err);
      setErrorMessage('Không thể tải danh sách nhóm gia đình.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  // Tải chi tiết nhóm gia đình đang được chọn
  useEffect(() => {
    if (!selectedFamilyId) return;

    const fetchFamilyDetail = async () => {
      try {
        setFamilyLoading(true);
        const res = await familyService.getById(selectedFamilyId);
        if (res.success && res.family) {
          setCurrentFamily(res.family);
        }
      } catch (err) {
        console.error('Lỗi khi tải chi tiết gia đình:', err);
      } finally {
        setFamilyLoading(false);
      }
    };

    fetchFamilyDetail();
  }, [selectedFamilyId]);

  // Kiểm tra xem currentUser có phải là Admin của nhóm hiện tại không
  const isCurrentAdmin = () => {
    if (!currentFamily || !currentUser) return false;
    const currentUserId = currentUser._id || currentUser.id;
    const isCreator = currentFamily.createdBy?._id === currentUserId || currentFamily.createdBy === currentUserId;
    const memberObj = currentFamily.members?.find(
      (m) => (m.userId?._id || m.userId) === currentUserId
    );
    return isCreator || memberObj?.role === 'ADMIN';
  };

  // Xử lý tạo nhóm gia đình mới
  const handleCreateFamily = async (e) => {
    e.preventDefault();
    if (!newFamilyName.trim()) {
      setErrorMessage('Vui lòng nhập tên nhóm gia đình');
      return;
    }
    if (newFamilyName.trim().length < 3 || newFamilyName.trim().length > 50) {
      setErrorMessage('Tên nhóm gia đình phải từ 3 đến 50 ký tự');
      return;
    }

    try {
      setCreating(true);
      setErrorMessage('');
      setSuccessMessage('');
      const res = await familyService.create({ name: newFamilyName.trim() });
      if (res.success && res.family) {
        setSuccessMessage(`Đã tạo nhóm gia đình "${res.family.name}" thành công! Bạn là Trưởng nhóm.`);
        setNewFamilyName('');
        setIsCreatingFamily(false);
        await fetchFamilies();
        setSelectedFamilyId(res.family._id);
      }
    } catch (err) {
      console.error('Lỗi khi tạo nhóm:', err);
      setErrorMessage(err.response?.data?.message || 'Không thể tạo nhóm gia đình.');
    } finally {
      setCreating(false);
    }
  };

  // Xử lý gửi lời mời thành viên (dành cho Admin - SCRUM-39)
  const handleSendInvite = async (e) => {
    e.preventDefault();
    const emailToInvite = inviteEmail.trim().toLowerCase();

    if (!emailToInvite) {
      setErrorMessage('Vui lòng nhập địa chỉ email người thân');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToInvite)) {
      setErrorMessage('Địa chỉ email không đúng định dạng');
      return;
    }

    if (currentUser?.email && emailToInvite === currentUser.email.toLowerCase()) {
      setErrorMessage('Bạn không thể tự gửi lời mời cho chính mình');
      return;
    }

    // Kiểm tra xem đã là thành viên trong nhóm chưa
    const alreadyInGroup = currentFamily?.members?.some((m) => {
      const memEmail = m.userId?.email?.toLowerCase();
      return memEmail === emailToInvite;
    });

    if (alreadyInGroup) {
      setErrorMessage('Người này hiện đã là thành viên trong nhóm gia đình này rồi');
      return;
    }

    try {
      setInviting(true);
      setErrorMessage('');
      setSuccessMessage('');
      setLastSentInvitation(null);
      setCopiedLink(false);

      const res = await familyService.inviteMember(selectedFamilyId, emailToInvite);
      if (res.success && res.invitation) {
        setSuccessMessage(`Đã tạo lời mời thành công cho ${emailToInvite}!`);
        setLastSentInvitation(res.invitation);
        setInviteEmail('');
      }
    } catch (err) {
      console.error('Lỗi khi gửi lời mời:', err);
      setErrorMessage(err.response?.data?.message || 'Không thể gửi lời mời thành viên.');
    } finally {
      setInviting(false);
    }
  };

  // Sao chép liên kết lời mời vào clipboard
  const handleCopyInviteLink = () => {
    if (!lastSentInvitation?.token) return;
    const inviteUrl = `${window.location.origin}?inviteToken=${lastSentInvitation.token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Xử lý kiểm tra mã lời mời thủ công
  const handleReviewManualToken = (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setReviewToken(manualToken.trim());
    setIsReviewModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-xs shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Quản lý nhóm Gia đình</h1>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Mời người thân tham gia nhóm để cùng theo dõi sức khỏe và bảo vệ dữ liệu theo phân quyền.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {onNavigateToPrivacy && (
            <button
              type="button"
              onClick={onNavigateToPrivacy}
              className="px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-sm flex items-center gap-2 transition-colors cursor-pointer"
              title="Thiết lập quyền xem chỉ số cho các thành viên"
            >
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Phân quyền riêng tư</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCreatingFamily(true)}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm shadow-md shadow-teal-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo nhóm mới</span>
          </button>
        </div>
      </div>

      {/* Thông báo Feedback Alert */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-900">{successMessage}</p>
          </div>
          <button 
            type="button" 
            onClick={() => setSuccessMessage('')}
            className="text-emerald-500 hover:text-emerald-700 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-sm font-semibold text-rose-900">{errorMessage}</p>
          </div>
          <button 
            type="button" 
            onClick={() => setErrorMessage('')}
            className="text-rose-500 hover:text-rose-700 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal / Form tạo nhóm gia đình mới */}
      {isCreatingFamily && (
        <div className="p-6 rounded-2xl bg-white border border-teal-200 shadow-sm animate-in fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              <span>Thiết lập nhóm gia đình mới</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsCreatingFamily(false)}
              className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
            >
              Hủy bỏ
            </button>
          </div>
          <form onSubmit={handleCreateFamily} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên nhóm gia đình <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="Ví dụ: Gia đình Nguyễn Hoàng, Tổ ấm nhỏ..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all"
                maxLength={50}
              />
              <p className="text-xs text-slate-500 mt-1">Từ 3 đến 50 ký tự. Bạn sẽ tự động là Quản trị viên (Admin) của nhóm.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreatingFamily(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Tạo nhóm</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content: Selector nhóm & Chi tiết */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
          <p className="text-sm font-medium">Đang tải thông tin gia đình...</p>
        </div>
      ) : families.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl p-10 border border-slate-200/80 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
            <Users className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-slate-900">Bạn chưa tham gia nhóm gia đình nào</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Hãy tạo một nhóm gia đình mới để mời người thân, hoặc duyệt lời mời nếu bạn nhận được mã từ người khác.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingFamily(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-md shadow-teal-600/20 cursor-pointer"
            >
              + Tạo nhóm gia đình ngay
            </button>
          </div>

          {/* Ô nhập mã lời mời thủ công cho Member */}
          <div className="pt-8 border-t border-slate-100 max-w-md mx-auto text-left">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Bạn có mã token lời mời từ người thân?
            </label>
            <form onSubmit={handleReviewManualToken} className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Dán mã lời mời vào đây..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Kiểm tra
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Khi đã có nhóm gia đình */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột 1: Danh sách nhóm gia đình & Duyệt lời mời */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Nhóm gia đình của bạn ({families.length})
                </span>
              </div>

              <div className="space-y-2">
                {families.map((fam) => {
                  const isSelected = fam._id === selectedFamilyId;
                  const isCreator = fam.createdBy?._id === (currentUser?._id || currentUser?.id);
                  return (
                    <button
                      key={fam._id}
                      type="button"
                      onClick={() => setSelectedFamilyId(fam._id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-teal-50/80 border-teal-300 text-teal-900 shadow-xs'
                          : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{fam.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          <span>{fam.members?.length || 1} thành viên</span>
                          {isCreator && (
                            <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.2 rounded-sm ml-1">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ô duyệt mã lời mời bằng token trực tiếp */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Duyệt lời mời bằng mã Token
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Nếu bạn nhận được mã token từ liên kết mời hoặc qua tin nhắn, hãy dán vào đây:
              </p>
              <form onSubmit={handleReviewManualToken} className="space-y-2">
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Dán mã 64 ký tự hex..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
                <button
                  type="submit"
                  disabled={!manualToken.trim()}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Kiểm tra & Gia nhập
                </button>
              </form>
            </div>
          </div>

          {/* Cột 2 & 3: Chi tiết nhóm hiện tại & Giao diện mời thành viên (Admin) */}
          <div className="lg:col-span-2 space-y-6">
            {familyLoading ? (
              <div className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
                <p className="text-xs font-medium">Đang tải thông tin chi tiết nhóm...</p>
              </div>
            ) : currentFamily ? (
              <>
                {/* Family Info Header Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">{currentFamily.name}</h2>
                        {isCurrentAdmin() && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Bạn là Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Ngày tạo:{' '}
                        {currentFamily.createdAt
                          ? new Date(currentFamily.createdAt).toLocaleDateString('vi-VN')
                          : 'Mới tạo'}
                      </p>
                    </div>

                    <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 self-start sm:self-auto">
                      Tổng số: {currentFamily.members?.length || 0} thành viên
                    </div>
                  </div>

                  {/* Danh sách thành viên */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Thành viên trong nhóm
                    </h3>
                    <div className="divide-y divide-slate-100">
                      {currentFamily.members?.map((member, index) => {
                        const userObj = member.userId || {};
                        const displayName = userObj.name || userObj.fullName || userObj.email || 'Thành viên';
                        const isMemberAdmin = member.role === 'ADMIN';

                        return (
                          <div key={member._id || index} className="py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                                isMemberAdmin ? 'bg-teal-600' : 'bg-slate-600'
                              }`}>
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">
                                  {displayName}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {userObj.email || 'Chưa có email'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isMemberAdmin 
                                  ? 'bg-teal-50 text-teal-700 border border-teal-200' 
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {isMemberAdmin ? 'Trưởng nhóm' : 'Thành viên'}
                              </span>
                              <span className="text-[11px] text-slate-400 hidden sm:inline">
                                Tham gia: {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('vi-VN') : '—'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* GIAO DIỆN MỜI THÀNH VIÊN CHO ADMIN (Jira SCRUM-39) */}
                {isCurrentAdmin() ? (
                  <div className="bg-white rounded-2xl p-6 border border-teal-200/90 shadow-sm space-y-5">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">
                          Mời thành viên mới vào gia đình
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Gửi lời mời qua Email. Lời mời sẽ có hiệu lực trong vòng <strong>48 giờ</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Form gửi lời mời */}
                    <form onSubmit={handleSendInvite} className="space-y-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Địa chỉ Email người thân <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <div className="relative flex-1">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="Ví dụ: ong_ba@gmail.com, vo_chong@gmail.com..."
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm transition-all"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={inviting || !inviteEmail.trim()}
                            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {inviting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Đang gửi...</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4" />
                                <span>Gửi lời mời</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>

                    {/* Kết quả sau khi gửi lời mời thành công: Box sao chép liên kết */}
                    {lastSentInvitation && (
                      <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3 animate-in fade-in">
                        <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Lời mời đã được khởi tạo thành công!</span>
                        </div>
                        <p className="text-xs text-emerald-900 leading-relaxed">
                          Bạn có thể sao chép liên kết bên dưới để gửi trực tiếp cho người thân qua Zalo, Messenger hoặc tin nhắn:
                        </p>

                        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-200">
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}?inviteToken=${lastSentInvitation.token}`}
                            className="flex-1 text-xs text-slate-600 bg-transparent outline-none font-mono select-all px-1"
                          />
                          <button
                            type="button"
                            onClick={handleCopyInviteLink}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                              copiedLink
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                            }`}
                          >
                            {copiedLink ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Sao chép link</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Hạn chót: 48 giờ kể từ lúc tạo</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Với Member: Thông báo chỉ Admin mới có quyền gửi lời mời */
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-slate-400 shrink-0" />
                    <span>
                      Bạn đang là <strong>Thành viên</strong> của nhóm gia đình này. Chỉ Trưởng nhóm (Admin) mới có quyền gửi lời mời thành viên mới.
                    </span>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal duyệt lời mời bằng Token thủ công */}
      <InvitationModal
        token={reviewToken}
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewToken('');
        }}
        onSuccess={() => {
          fetchFamilies();
        }}
      />
    </div>
  );
}
