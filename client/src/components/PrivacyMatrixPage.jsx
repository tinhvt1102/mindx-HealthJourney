import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Shield, 
  Lock, 
  Users, 
  Heart, 
  Activity, 
  Droplet, 
  Scale, 
  Thermometer, 
  Wind, 
  Check, 
  X, 
  Save, 
  RotateCcw, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { familyService, policyService } from '../services/api';

// Cấu hình 6 loại chỉ số sức khỏe hiển thị trên ma trận
const HEALTH_METRICS = [
  {
    key: 'BLOOD_PRESSURE',
    label: 'Huyết áp',
    unit: 'mmHg',
    icon: Activity,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
  {
    key: 'HEART_RATE',
    label: 'Nhịp tim',
    unit: 'bpm',
    icon: Heart,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  {
    key: 'BLOOD_SUGAR',
    label: 'Đường huyết',
    unit: 'mg/dL',
    icon: Droplet,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    key: 'WEIGHT',
    label: 'Cân nặng',
    unit: 'kg',
    icon: Scale,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
  },
  {
    key: 'TEMPERATURE',
    label: 'Thân nhiệt',
    unit: '°C',
    icon: Thermometer,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  {
    key: 'SPO2',
    label: 'SpO2',
    unit: '%',
    icon: Wind,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
  },
];

export default function PrivacyMatrixPage({ currentUser, onBack }) {
  const [families, setFamilies] = useState([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [selectedFamilyName, setSelectedFamilyName] = useState('');
  
  // Ma trận quyền: Map viewerId -> Set/Array allowedMetrics
  const [matrix, setMatrix] = useState([]);
  const [originalMatrix, setOriginalMatrix] = useState([]);

  const [loading, setLoading] = useState(true);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 1. Tải danh sách nhóm gia đình của user
  useEffect(() => {
    const loadFamilies = async () => {
      try {
        setLoading(true);
        const res = await familyService.getMyFamilies();
        if (res.success && Array.isArray(res.families)) {
          setFamilies(res.families);
          if (res.families.length > 0) {
            setSelectedFamilyId(res.families[0]._id);
            setSelectedFamilyName(res.families[0].name);
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách gia đình:', err);
        setErrorMessage('Không thể tải danh sách gia đình.');
      } finally {
        setLoading(false);
      }
    };

    loadFamilies();
  }, []);

  // 2. Tải ma trận chính sách chia sẻ của nhóm đang chọn
  useEffect(() => {
    if (!selectedFamilyId) return;

    const loadPolicies = async () => {
      try {
        setMatrixLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        const res = await policyService.getPolicies(selectedFamilyId);
        if (res.success && Array.isArray(res.policies)) {
          // Sao chép deep copy để so sánh thay đổi
          setMatrix(JSON.parse(JSON.stringify(res.policies)));
          setOriginalMatrix(JSON.parse(JSON.stringify(res.policies)));
          setSelectedFamilyName(res.familyName || 'Nhóm gia đình');
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error('Lỗi khi tải ma trận quyền riêng tư:', err);
        setErrorMessage(
          err.response?.data?.message || 'Không thể tải chính sách chia sẻ của nhóm.'
        );
      } finally {
        setMatrixLoading(false);
      }
    };

    loadPolicies();
  }, [selectedFamilyId]);

  // Kiểm tra có thay đổi chưa lưu không
  const checkChanges = (current) => {
    const isDifferent = JSON.stringify(current) !== JSON.stringify(originalMatrix);
    setHasUnsavedChanges(isDifferent);
  };

  // Toggle bật/tắt một metric cho một viewer cụ thể
  const handleToggleMetric = (viewerId, metricKey) => {
    setMatrix((prev) => {
      const updated = prev.map((item) => {
        if (item.viewerId !== viewerId) return item;
        const currentList = item.allowedMetrics || [];
        const isAllowed = currentList.includes(metricKey);
        const newList = isAllowed
          ? currentList.filter((m) => m !== metricKey)
          : [...currentList, metricKey];
        return { ...item, allowedMetrics: newList };
      });
      checkChanges(updated);
      return updated;
    });
  };

  // Bật tất cả các chỉ số cho một người
  const handleAllowAllForViewer = (viewerId) => {
    setMatrix((prev) => {
      const updated = prev.map((item) => {
        if (item.viewerId !== viewerId) return item;
        return {
          ...item,
          allowedMetrics: HEALTH_METRICS.map((m) => m.key),
        };
      });
      checkChanges(updated);
      return updated;
    });
  };

  // Thu hồi tất cả các chỉ số của một người (Default Deny)
  const handleRevokeAllForViewer = (viewerId) => {
    setMatrix((prev) => {
      const updated = prev.map((item) => {
        if (item.viewerId !== viewerId) return item;
        return { ...item, allowedMetrics: [] };
      });
      checkChanges(updated);
      return updated;
    });
  };

  // Bật tất cả cho mọi người
  const handleAllowAllGlobal = () => {
    setMatrix((prev) => {
      const updated = prev.map((item) => ({
        ...item,
        allowedMetrics: HEALTH_METRICS.map((m) => m.key),
      }));
      checkChanges(updated);
      return updated;
    });
  };

  // Đặt lại toàn bộ về Default Deny (Tắt hết)
  const handleResetToDefaultDeny = () => {
    setMatrix((prev) => {
      const updated = prev.map((item) => ({
        ...item,
        allowedMetrics: [],
      }));
      checkChanges(updated);
      return updated;
    });
  };

  // Hủy các thay đổi chưa lưu
  const handleDiscardChanges = () => {
    setMatrix(JSON.parse(JSON.stringify(originalMatrix)));
    setHasUnsavedChanges(false);
  };

  // Lưu ma trận phân quyền lên máy chủ (Batch PUT)
  const handleSaveMatrix = async () => {
    if (!selectedFamilyId) return;

    try {
      setSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const payload = {
        policies: matrix.map((p) => ({
          viewerId: p.viewerId,
          allowedMetrics: p.allowedMetrics || [],
        })),
      };

      const res = await policyService.updatePolicies(selectedFamilyId, payload);
      if (res.success) {
        setSuccessMessage('Đã lưu thành công cài đặt quyền riêng tư!');
        setOriginalMatrix(JSON.parse(JSON.stringify(matrix)));
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Lỗi khi lưu chính sách:', err);
      setErrorMessage(
        err.response?.data?.message || 'Không thể lưu cài đặt quyền riêng tư.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-xs shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                Ma trận quyền riêng tư (Privacy Matrix)
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed max-w-2xl">
              Chủ động phân quyền xem từng loại chỉ số sức khỏe cho từng người thân trong gia đình.
              Áp dụng nguyên tắc <strong>Từ chối mặc định (Default Deny)</strong> nhằm bảo vệ dữ liệu tối đa.
            </p>
          </div>
        </div>

        {/* Action Button: Lưu ma trận */}
        <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy thay đổi
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveMatrix}
            disabled={saving || !hasUnsavedChanges}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/25 animate-pulse'
                : 'bg-slate-100 text-slate-400 border border-slate-200/80 cursor-not-allowed shadow-none'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Lưu cài đặt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Thông báo Feedback */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 animate-in fade-in">
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
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 animate-in fade-in">
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

      {/* Selector chọn nhóm gia đình (nếu có nhiều nhóm) */}
      {families.length > 1 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 overflow-x-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
            Chọn nhóm:
          </span>
          {families.map((fam) => (
            <button
              key={fam._id}
              type="button"
              onClick={() => setSelectedFamilyId(fam._id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedFamilyId === fam._id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {fam.name}
            </button>
          ))}
        </div>
      )}

      {/* Main Privacy Matrix Table */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
          <p className="text-sm font-medium">Đang tải danh sách thành viên...</p>
        </div>
      ) : families.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200/80 text-center space-y-4">
          <Users className="w-12 h-12 mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-900">Bạn chưa tham gia nhóm gia đình nào</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Vui lòng tạo hoặc tham gia một nhóm gia đình để cài đặt quyền riêng tư với các thành viên.
          </p>
        </div>
      ) : matrixLoading ? (
        <div className="py-16 text-center text-slate-500 space-y-3 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
          <p className="text-sm font-medium">Đang tải ma trận phân quyền...</p>
        </div>
      ) : matrix.length === 0 ? (
        /* Nhóm chỉ có 1 mình owner, chưa có thành viên khác */
        <div className="bg-white rounded-2xl p-10 border border-slate-200/80 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
            <Users className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-bold text-slate-900">
              Nhóm "{selectedFamilyName}" chưa có thành viên nào khác
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bạn hiện là thành viên duy nhất trong nhóm này. Hãy vào mục <strong>Gia đình</strong> để gửi lời mời người thân, sau đó quay lại đây để phân quyền chia sẻ chỉ số.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quick batch action toolbar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <Shield className="w-4 h-4 text-teal-600" />
              <span>
                Đang thiết lập quyền cho <strong>{matrix.length}</strong> thành viên trong nhóm{' '}
                <strong className="text-slate-900">"{selectedFamilyName}"</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAllowAllGlobal}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer transition-colors"
              >
                Cho phép tất cả
              </button>
              <button
                type="button"
                onClick={handleResetToDefaultDeny}
                className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold cursor-pointer transition-colors"
              >
                Tắt toàn bộ (Default Deny)
              </button>
            </div>
          </div>

          {/* Ma trận dạng Card (Mobile) và Bảng (Desktop) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-4 px-6 min-w-[200px]">Thành viên gia đình</th>
                    {HEALTH_METRICS.map((metric) => {
                      const IconComponent = metric.icon;
                      return (
                        <th key={metric.key} className="py-4 px-4 text-center min-w-[110px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`p-1.5 rounded-lg ${metric.bgColor} ${metric.color}`}>
                              <IconComponent className="w-4 h-4" />
                            </span>
                            <span className="font-bold text-slate-800 text-[11px]">
                              {metric.label}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="py-4 px-4 text-center min-w-[120px]">Thao tác nhanh</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">
                  {matrix.map((member) => {
                    const currentAllowed = member.allowedMetrics || [];
                    const isAllAllowed = HEALTH_METRICS.every((m) =>
                      currentAllowed.includes(m.key)
                    );
                    const isAllDenied = currentAllowed.length === 0;

                    return (
                      <tr key={member.viewerId} className="hover:bg-slate-50/60 transition-colors">
                        {/* Cột 1: Thông tin người xem */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                              {(member.viewerName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">
                                {member.viewerName}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {member.viewerEmail}
                              </div>
                              <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                {member.role === 'ADMIN' ? 'Trưởng nhóm' : 'Thành viên'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Cột 2-7: 6 công tắc Switch cho từng loại chỉ số */}
                        {HEALTH_METRICS.map((metric) => {
                          const isEnabled = currentAllowed.includes(metric.key);

                          return (
                            <td key={metric.key} className="py-4 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleMetric(member.viewerId, metric.key)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
                                  isEnabled ? 'bg-teal-600' : 'bg-slate-200'
                                }`}
                                role="switch"
                                aria-checked={isEnabled}
                                title={`${isEnabled ? 'Đang cho phép' : 'Đang chặn'}: ${metric.label}`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    isEnabled ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </td>
                          );
                        })}

                        {/* Cột 8: Thao tác nhanh cho hàng này */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAllowAllForViewer(member.viewerId)}
                              disabled={isAllAllowed}
                              className="px-2 py-1 rounded text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              title="Bật toàn bộ chỉ số cho người này"
                            >
                              Tất cả
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeAllForViewer(member.viewerId)}
                              disabled={isAllDenied}
                              className="px-2 py-1 rounded text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                              title="Thu hồi toàn bộ chỉ số của người này"
                            >
                              Tắt hết
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chú thích nguyên tắc bảo mật Default Deny */}
          <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex items-start gap-3.5 text-xs text-teal-900 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-teal-950 mb-0.5">
                Cơ chế bảo vệ dữ liệu sức khỏe (Default Deny)
              </h4>
              <p className="text-teal-800">
                Khi bất kỳ thành viên nào tham gia vào nhóm gia đình của bạn, hệ thống luôn thiết lập mặc định là <strong>không chia sẻ bất kỳ chỉ số nào</strong>. Chỉ khi bạn chủ động gạt công tắc màu xanh tại đây và bấm <strong>"Lưu cài đặt"</strong>, người thân đó mới có thể xem được dữ liệu tương ứng.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
