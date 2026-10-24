import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Heart,
  Droplet,
  Scale,
  Thermometer,
  Wind,
  Plus,
  Calendar,
  Clock,
  TrendingUp,
  FileText,
  Trash2,
  Edit2,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { healthRecordService } from '../services/api';
import HealthRecordModal from './HealthRecordModal';

const METRICS_META = {
  BLOOD_PRESSURE: {
    label: 'Huyết áp',
    unit: 'mmHg',
    icon: Activity,
    color: '#e11d48',
    secondaryColor: '#0284c7',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-700',
    normalText: 'Bình thường: ~120/80 mmHg',
  },
  HEART_RATE: {
    label: 'Nhịp tim',
    unit: 'bpm',
    icon: Heart,
    color: '#ef4444',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-600',
    normalText: 'Bình thường: 60 - 100 bpm',
  },
  BLOOD_SUGAR: {
    label: 'Đường huyết',
    unit: 'mg/dL',
    icon: Droplet,
    color: '#d97706',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    normalText: 'Lúc đói: 70 - 100 mg/dL',
  },
  WEIGHT: {
    label: 'Cân nặng',
    unit: 'kg',
    icon: Scale,
    color: '#0d9488',
    secondaryColor: '#6366f1',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-700',
    normalText: 'Kèm theo tính toán BMI cơ thể',
  },
  TEMPERATURE: {
    label: 'Thân nhiệt',
    unit: '°C',
    icon: Thermometer,
    color: '#f97316',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    normalText: 'Bình thường: 36.5 - 37.5 °C',
  },
  SPO2: {
    label: 'SpO2',
    unit: '%',
    icon: Wind,
    color: '#0284c7',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    textColor: 'text-sky-700',
    normalText: 'Mức an toàn: 95% - 100%',
  },
};

/**
 * Trang Nhật ký & Biểu đồ lịch sử chỉ số sức khỏe (SCRUM-24 & SCRUM-28)
 */
export default function HealthTrackerPage({ currentUser, onOpenLogModal }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('BLOOD_PRESSURE');
  const [filterDays, setFilterDays] = useState('7'); // '7' | '30' | 'all'
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Modal thêm/sửa chỉ số
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [initialModalType, setInitialModalType] = useState('BLOOD_PRESSURE');

  // Tải danh sách bản ghi theo filter
  const fetchRecords = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const params = {};
      if (filterDays !== 'all') {
        params.days = filterDays;
      }
      const res = await healthRecordService.getAll(params);
      if (res?.success && Array.isArray(res.data)) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải nhật ký sức khỏe:', err);
      setErrorMessage('Không thể tải nhật ký sức khỏe. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [filterDays]);

  // Xóa bản ghi
  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi chỉ số này không?')) return;
    try {
      const res = await healthRecordService.delete(id);
      if (res?.success) {
        setSuccessMessage('Đã xóa bản ghi chỉ số thành công!');
        fetchRecords();
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Không thể xóa bản ghi.');
    }
  };

  // Mở modal tạo mới
  const handleOpenCreateModal = (metricType = 'BLOOD_PRESSURE') => {
    setRecordToEdit(null);
    setInitialModalType(metricType);
    setIsModalOpen(true);
  };

  // Mở modal sửa
  const handleOpenEditModal = (rec) => {
    setRecordToEdit(rec);
    setInitialModalType(rec.type);
    setIsModalOpen(true);
  };

  // Bản ghi mới nhất của từng loại chỉ số (cho Cards tóm tắt)
  const latestByMetric = useMemo(() => {
    const map = {};
    // Sắp xếp giảm dần theo recordedAt để lấy mới nhất
    const sorted = [...records].sort(
      (a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)
    );
    sorted.forEach((r) => {
      if (!map[r.type]) {
        map[r.type] = r;
      }
    });
    return map;
  }, [records]);

  // Dữ liệu cho biểu đồ theo loại chỉ số đang chọn (Sắp xếp tăng dần theo thời gian)
  const chartData = useMemo(() => {
    const filtered = records
      .filter((r) => r.type === selectedMetric)
      .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

    return filtered.map((r) => {
      const d = new Date(r.recordedAt);
      const formattedDate = `${d.getDate()}/${d.getMonth() + 1}`;
      const formattedTime = `${String(d.getHours()).padStart(2, '0')}:${String(
        d.getMinutes()
      ).padStart(2, '0')}`;

      if (r.type === 'BLOOD_PRESSURE') {
        return {
          id: r._id || r.id,
          date: formattedDate,
          fullDate: `${formattedDate} ${formattedTime}`,
          rawDate: d,
          'Tâm thu': r.systolic,
          'Tâm trương': r.diastolic,
          note: r.note,
        };
      } else if (r.type === 'WEIGHT') {
        return {
          id: r._id || r.id,
          date: formattedDate,
          fullDate: `${formattedDate} ${formattedTime}`,
          rawDate: d,
          'Cân nặng': r.value,
          BMI: r.bmi,
          note: r.note,
        };
      } else {
        const meta = METRICS_META[r.type];
        return {
          id: r._id || r.id,
          date: formattedDate,
          fullDate: `${formattedDate} ${formattedTime}`,
          rawDate: d,
          [meta.label]: r.value,
          note: r.note,
        };
      }
    });
  }, [records, selectedMetric]);

  const activeMeta = METRICS_META[selectedMetric];

  // Tooltip tùy chỉnh cho biểu đồ Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      return (
        <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-slate-200/90 text-xs space-y-1.5 z-50">
          <p className="font-bold text-slate-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span>{dataPoint?.fullDate || label}</span>
          </p>
          <div className="pt-1 border-t border-slate-100 space-y-1">
            {payload.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <span className="font-medium text-slate-600 flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}:
                </span>
                <span className="font-extrabold text-slate-900">
                  {entry.value} {entry.name === 'BMI' ? 'kg/m²' : activeMeta.unit}
                </span>
              </div>
            ))}
          </div>
          {dataPoint?.note && (
            <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
              Ghi chú: {dataPoint.note}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-xs shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Nhật ký & Chỉ số sức khỏe
            </h1>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed max-w-2xl">
              Theo dõi diễn biến thể trạng, xem biểu đồ lịch sử và ghi nhận kết quả đo hàng ngày để phát hiện sớm các dấu hiệu bất thường.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreateModal(selectedMetric)}
          className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Ghi chỉ số mới</span>
        </button>
      </div>

      {/* Thông báo Feedback */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
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
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
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

      {/* 6 Thẻ tóm tắt các chỉ số gần nhất */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {Object.entries(METRICS_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const latest = latestByMetric[key];
          const isSelected = selectedMetric === key;

          let displayVal = 'Chưa đo';
          if (latest) {
            if (key === 'BLOOD_PRESSURE') {
              displayVal = `${latest.systolic}/${latest.diastolic}`;
            } else if (key === 'WEIGHT') {
              displayVal = `${latest.value}${latest.bmi ? ` (BMI ${latest.bmi})` : ''}`;
            } else {
              displayVal = `${latest.value}`;
            }
          }

          return (
            <div
              key={key}
              onClick={() => setSelectedMetric(key)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-white border-teal-500 ring-2 ring-teal-500/20 shadow-md'
                  : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">{meta.label}</span>
                <div className={`w-7 h-7 rounded-xl ${meta.bgColor} ${meta.textColor} flex items-center justify-center`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <div className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                  {displayVal}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {latest ? meta.unit : 'Chưa có dữ liệu'}
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 truncate">
                  {latest?.recordedAt
                    ? new Date(latest.recordedAt).toLocaleDateString('vi-VN')
                    : 'Nhấn để xem'}
                </span>
                <span className={`font-semibold ${isSelected ? 'text-teal-600' : 'text-slate-400'}`}>
                  {isSelected ? 'Đang chọn' : 'Xem'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Khối Biểu đồ lịch sử (SCRUM-28) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                Biểu đồ diễn biến {activeMeta.label}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${activeMeta.bgColor} ${activeMeta.textColor}`}>
                Đơn vị: {activeMeta.unit}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{activeMeta.normalText}</p>
          </div>

          {/* Bộ lọc 7 ngày / 30 ngày / Tất cả (AC1 SCRUM-28) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setFilterDays('7')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterDays === '7'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setFilterDays('30')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterDays === '30'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setFilterDays('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterDays === 'all'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
          </div>
        </div>

        {/* Khung vẽ biểu đồ Recharts */}
        {loading ? (
          <div className="py-24 text-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
            <p className="text-xs font-medium">Đang tải dữ liệu biểu đồ...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
              <TrendingUp className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Chưa có dữ liệu {activeMeta.label} trong khoảng thời gian này
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Hãy bấm vào nút bên dưới để ghi nhận kết quả đo đầu tiên của bạn.
            </p>
            <button
              type="button"
              onClick={() => handleOpenCreateModal(selectedMetric)}
              className="mt-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              + Ghi nhận chỉ số ngay
            </button>
          </div>
        ) : (
          <div className="w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  stroke="#94a3b8"
                  fontSize={12}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  stroke="#94a3b8"
                  fontSize={12}
                  tickMargin={8}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" />

                {selectedMetric === 'BLOOD_PRESSURE' ? (
                  <>
                    <ReferenceLine y={120} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Tâm thu chuẩn (120)', fill: '#f43f5e', fontSize: 10 }} />
                    <ReferenceLine y={80} stroke="#0ea5e9" strokeDasharray="3 3" label={{ value: 'Tâm trương chuẩn (80)', fill: '#0ea5e9', fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="Tâm thu"
                      stroke="#e11d48"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#e11d48' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Tâm trương"
                      stroke="#0284c7"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#0284c7' }}
                      activeDot={{ r: 6 }}
                    />
                  </>
                ) : selectedMetric === 'WEIGHT' ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey="Cân nặng"
                      stroke="#0d9488"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#0d9488' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="BMI"
                      stroke="#6366f1"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#6366f1' }}
                    />
                  </>
                ) : (
                  <Line
                    type="monotone"
                    dataKey={activeMeta.label}
                    stroke={activeMeta.color}
                    strokeWidth={3}
                    dot={{ r: 4, fill: activeMeta.color }}
                    activeDot={{ r: 6 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bảng danh sách các lần đo gần đây */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Lịch sử các lần ghi nhận gần đây ({records.length})
            </h3>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Chưa có bản ghi nào. Hãy bấm "+ Ghi chỉ số mới" để bắt đầu theo dõi sức khỏe của bạn.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Chỉ số</th>
                  <th className="py-3.5 px-4">Kết quả đo</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4">Ghi chú</th>
                  <th className="py-3.5 px-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records
                  .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
                  .map((rec) => {
                    const meta = METRICS_META[rec.type] || METRICS_META.BLOOD_PRESSURE;
                    const Icon = meta.icon;
                    const recId = rec._id || rec.id;

                    let resultText = '';
                    if (rec.type === 'BLOOD_PRESSURE') {
                      resultText = `${rec.systolic} / ${rec.diastolic} mmHg`;
                    } else if (rec.type === 'WEIGHT') {
                      resultText = `${rec.value} kg ${rec.bmi ? `(BMI ${rec.bmi})` : ''}`;
                    } else {
                      resultText = `${rec.value} ${meta.unit}`;
                    }

                    return (
                      <tr key={recId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl ${meta.bgColor} ${meta.textColor} flex items-center justify-center shrink-0`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-slate-800">{meta.label}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {resultText}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(rec.recordedAt).toLocaleString('vi-VN')}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {rec.note || <span className="text-slate-300 italic">Không có</span>}
                        </td>

                        <td className="py-3.5 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(rec)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors cursor-pointer"
                              title="Chỉnh sửa bản ghi"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(recId)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa bản ghi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal ghi/sửa chỉ số */}
      <HealthRecordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setSuccessMessage(
            recordToEdit ? 'Đã cập nhật chỉ số thành công!' : 'Đã lưu chỉ số sức khỏe mới!'
          );
          fetchRecords();
          setTimeout(() => setSuccessMessage(''), 3000);
        }}
        recordToEdit={recordToEdit}
        initialType={initialModalType}
        currentUserHeight={currentUser?.heightCm}
      />
    </div>
  );
}