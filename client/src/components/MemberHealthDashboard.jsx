import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Activity, 
  Heart, 
  Droplet, 
  Scale, 
  Lock, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  AlertOctagon, 
  CheckCircle2, 
  RefreshCw, 
  Loader2, 
  User, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Info,
  SlidersHorizontal,
  Thermometer,
  Wind
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { familyService } from '../services/api';
import HealthAlertBadge from './HealthAlertBadge';
import AiSummaryCard from './AiSummaryCard';

const METRIC_CONFIGS = {
  BLOOD_PRESSURE: {
    label: 'Huyết áp',
    unit: 'mmHg',
    icon: Activity,
    color: 'rose',
    primaryColor: '#e11d48',
    secondaryColor: '#0284c7',
  },
  HEART_RATE: {
    label: 'Nhịp tim',
    unit: 'bpm',
    icon: Heart,
    color: 'rose',
    primaryColor: '#f43f5e',
  },
  BLOOD_SUGAR: {
    label: 'Đường huyết',
    unit: 'mg/dL',
    icon: Droplet,
    color: 'amber',
    primaryColor: '#d97706',
  },
  WEIGHT: {
    label: 'Cân nặng & BMI',
    unit: 'kg',
    icon: Scale,
    color: 'teal',
    primaryColor: '#0d9488',
  },
  TEMPERATURE: {
    label: 'Thân nhiệt',
    unit: '°C',
    icon: Thermometer,
    color: 'orange',
    primaryColor: '#ea580c',
  },
  SPO2: {
    label: 'Nồng độ Oxy (SpO2)',
    unit: '%',
    icon: Wind,
    color: 'sky',
    primaryColor: '#0284c7',
  },
};

/**
 * Bảng điều khiển sức khỏe thành viên theo phân quyền (Jira SCRUM-49 / SCRUM-51 / SCRUM-52 / SCRUM-54)
 */
export default function MemberHealthDashboard({
  familyId,
  memberId,
  memberName,
  currentUser,
  onBack,
  onOpenPrivacy
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await familyService.getMemberHealthOverview(familyId, memberId);
      if (res.success) {
        setData(res);
      } else {
        setError(res.message || 'Không thể tải tổng quan sức khỏe thành viên.');
      }
    } catch (err) {
      console.error('Lỗi khi tải tổng quan sức khỏe:', err);
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (familyId && memberId) {
      fetchOverview();
    }
  }, [familyId, memberId]);

  const formatChartData = (type, history = []) => {
    return history.map((item) => {
      const dateStr = item.recordedAt 
        ? new Date(item.recordedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        : '';

      if (type === 'BLOOD_PRESSURE') {
        return {
          date: dateStr,
          'Tâm thu': item.systolic || item.values?.systolic || 0,
          'Tâm trương': item.diastolic || item.values?.diastolic || 0,
        };
      }
      if (type === 'WEIGHT') {
        return {
          date: dateStr,
          'Cân nặng': item.value || item.values?.value || 0,
          BMI: item.bmi || item.values?.bmi || 0,
        };
      }
      return {
        date: dateStr,
        [METRIC_CONFIGS[type]?.label || 'Giá trị']: item.value || item.values?.value || 0,
      };
    });
  };

  const getOverallStatusBadge = (status) => {
    switch (status) {
      case 'DANGER':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
            <span>Nguy cơ cao (Cần chú ý)</span>
          </div>
        );
      case 'WARNING':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Cảnh báo chỉ số (Theo dõi)</span>
          </div>
        );
      case 'NORMAL':
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Thể trạng ổn định</span>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium text-sm">Đang tải bảng điều khiển sức khỏe của người thân...</p>
        <p className="text-slate-400 text-xs mt-1">Đang áp dụng bộ lọc quyền riêng tư (Default Deny)...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">Không thể hiển thị bảng điều khiển</h3>
        <p className="text-sm text-slate-500 mb-4">{error || 'Không tìm thấy dữ liệu sức khỏe của thành viên.'}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            Quay lại
          </button>
          <button
            onClick={fetchOverview}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const { member, isSelfView, overallStatus, metrics, recentHistory } = data;
  const targetName = member?.name || member?.fullName || memberName || 'Thành viên';

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
              title="Quay lại danh sách gia đình"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              {member?.avatar ? (
                <img src={member.avatar} alt={targetName} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                targetName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">{targetName}</h2>
                {isSelfView ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-100 text-emerald-800">
                    Chính bạn
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-slate-100 text-slate-700">
                    Thành viên
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>{member?.email}</span>
                {member?.heightCm && <span>• Chiều cao: {member.heightCm} cm</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {getOverallStatusBadge(overallStatus)}
            {onOpenPrivacy && (
              <button
                onClick={onOpenPrivacy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer border border-slate-200"
                title="Cài đặt ma trận quyền riêng tư"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Phân quyền</span>
              </button>
            )}
            <button
              onClick={fetchOverview}
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Banner thông tin phân quyền */}
        {!isSelfView && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Dữ liệu được lọc theo <strong>Chính sách quyền riêng tư (Default Deny)</strong> được {targetName} cấp phép.
              </span>
            </div>
            <span className="font-semibold text-emerald-700">
              Được xem {data.allowedMetrics?.length || 0} chỉ số
            </span>
          </div>
        )}
      </div>

      {/* Grid các chỉ số sức khỏe (SCRUM-49 / SCRUM-51 / SCRUM-52) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {['BLOOD_PRESSURE', 'HEART_RATE', 'BLOOD_SUGAR', 'WEIGHT'].map((type) => {
          const cfg = METRIC_CONFIGS[type];
          const metricData = metrics?.[type];
          const hasAccess = metricData?.hasAccess;
          const latest = metricData?.latest;
          const evaluation = metricData?.evaluation;
          const history = recentHistory?.[type] || [];
          const chartData = hasAccess ? formatChartData(type, history) : [];
          const Icon = cfg.icon;

          return (
            <div
              key={type}
              className={`rounded-3xl border p-5 transition-all shadow-xs ${
                hasAccess
                  ? 'bg-white border-slate-200/90'
                  : 'bg-slate-50/80 border-dashed border-slate-300'
              }`}
            >
              {/* Header card chỉ số */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      hasAccess
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{cfg.label}</h4>
                    <span className="text-[11px] text-slate-400">Đơn vị: {cfg.unit}</span>
                  </div>
                </div>

                <div>
                  {hasAccess ? (
                    evaluation ? (
                      <HealthAlertBadge
                        metricType={type}
                        evaluation={evaluation}
                        size="sm"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">Chưa có dữ liệu</span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-600">
                      <Lock className="w-3 h-3 text-slate-500" />
                      <span>Được bảo vệ</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Nội dung card */}
              {hasAccess ? (
                latest ? (
                  <div className="mt-4 space-y-4">
                    {/* Giá trị đo gần nhất */}
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-slate-900 tracking-tight">
                            {type === 'BLOOD_PRESSURE'
                              ? `${latest.systolic || latest.values?.systolic}/${latest.diastolic || latest.values?.diastolic}`
                              : type === 'WEIGHT'
                              ? `${latest.value || latest.values?.value}`
                              : `${latest.value || latest.values?.value}`}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">{cfg.unit}</span>
                        </div>
                        {type === 'WEIGHT' && (latest.bmi || latest.values?.bmi) && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            Chỉ số BMI: <strong className="text-slate-800">{latest.bmi || latest.values?.bmi}</strong>
                          </div>
                        )}
                      </div>

                      <div className="text-right text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {latest.recordedAt
                            ? new Date(latest.recordedAt).toLocaleString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Mới đây'}
                        </span>
                      </div>
                    </div>

                    {/* Diễn giải ngưỡng y khoa (SCRUM-52 / SCRUM-53) */}
                    {evaluation?.description && (
                      <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-start gap-2 border border-slate-100">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{evaluation.description}</span>
                      </div>
                    )}

                    {/* Biểu đồ mini 30 ngày gần nhất */}
                    {chartData.length > 1 && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>Diễn biến 30 ngày qua</span>
                          </span>
                          <span>{chartData.length} lần đo</span>
                        </div>
                        <div className="w-full h-28">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" tickLine={false} stroke="#cbd5e1" fontSize={10} />
                              <YAxis tickLine={false} stroke="#cbd5e1" fontSize={10} domain={['auto', 'auto']} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#1e293b',
                                  borderRadius: '8px',
                                  border: 'none',
                                  color: '#fff',
                                  fontSize: '11px',
                                  padding: '6px 10px',
                                }}
                              />
                              {type === 'BLOOD_PRESSURE' ? (
                                <>
                                  <Line
                                    type="monotone"
                                    dataKey="Tâm thu"
                                    stroke={cfg.primaryColor}
                                    strokeWidth={2}
                                    dot={{ r: 2 }}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="Tâm trương"
                                    stroke={cfg.secondaryColor}
                                    strokeWidth={2}
                                    dot={{ r: 2 }}
                                  />
                                </>
                              ) : (
                                <Line
                                  type="monotone"
                                  dataKey={cfg.label}
                                  stroke={cfg.primaryColor}
                                  strokeWidth={2}
                                  dot={{ r: 2 }}
                                />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Chưa có bản ghi đo lường nào cho chỉ số này.
                  </div>
                )
              ) : (
                /* Card khi không có quyền xem (Default Deny - AC2 SCRUM-49 / SCRUM-51) */
                <div className="py-7 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-slate-200/70 text-slate-500 flex items-center justify-center mx-auto mb-2.5">
                    <Lock className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 mb-1">
                    Không có quyền xem
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-[260px] mx-auto leading-relaxed">
                    Chỉ số này được bảo vệ bởi Ma trận quyền riêng tư (Default Deny). {targetName} chưa cấp quyền xem cho bạn.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Trợ lý AI Tóm tắt & Phân tích Xu hướng (SCRUM-54) */}
      <AiSummaryCard
        memberId={memberId}
        familyId={familyId}
        memberName={targetName}
        isSelfView={isSelfView}
      />
    </div>
  );
}
