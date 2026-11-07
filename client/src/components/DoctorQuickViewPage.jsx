import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  Lock, 
  KeyRound, 
  AlertCircle, 
  Calendar, 
  Activity, 
  Heart, 
  User, 
  FileText, 
  Printer, 
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { doctorShareService } from '../services/api';

export default function DoctorQuickViewPage({ token, onBack }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!pin || pin.length !== 4) {
      setError('Vui lòng nhập đúng 4 chữ số mã PIN');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await doctorShareService.verifyPin(token, pin);
      if (res?.data) {
        setReportData(res.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Mã PIN không chính xác hoặc link đã hết hạn'
      );
    } finally {
      setLoading(false);
    }
  };

  // Màn hình nhập mã PIN bảo mật
  if (!reportData) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/90 backdrop-blur rounded-3xl p-8 border border-slate-700 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/20 text-teal-400 mx-auto flex items-center justify-center mb-4">
            <Stethoscope className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            Hồ Sơ Y Tế Chia Sẻ Cho Bác Sĩ
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Hồ sơ này được bảo vệ bởi mã PIN 4 số do người bệnh thiết lập. Vui lòng nhập mã PIN để mở dữ liệu sức khỏe 30 ngày.
          </p>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="relative">
              <KeyRound className="w-5 h-5 absolute left-4 top-3 text-slate-400" />
              <input
                type="password"
                maxLength={4}
                autoFocus
                placeholder="Nhập 4 số PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-700 text-center font-mono text-2xl tracking-[0.5em] text-teal-400 focus:outline-teal-500 focus:border-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || pin.length !== 4}
              className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm transition-all shadow-lg shadow-teal-600/30 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Đang xác thực...' : 'Mở Hồ Sơ Bệnh Án'}
            </button>
          </form>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-4 text-xs text-slate-400 hover:text-slate-200"
            >
              ← Quay lại trang chủ
            </button>
          )}
        </div>
      </div>
    );
  }

  const { patient, records = [], stats = {}, doctorNotes, expiresAt } = reportData;

  // Lọc dữ liệu huyết áp cho biểu đồ
  const bpChartData = records
    .filter((r) => r.type === 'BLOOD_PRESSURE')
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.recordedAt).toLocaleDateString('vi-VN', {
        month: 'numeric',
        day: 'numeric',
      }),
      systolic: r.systolic,
      diastolic: r.diastolic,
    }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-8 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-teal-600 font-bold uppercase tracking-wider block">
                HealthJourney Medical Quick-View
              </span>
              <h1 className="text-xl font-extrabold text-slate-900">
                Hồ Sơ Sức Khỏe 30 Ngày (Bác Sĩ Xem Nhanh)
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> In Báo Cáo
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            )}
          </div>
        </div>

        {/* Thông tin bệnh nhân */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
            <User className="w-4 h-4" /> Thông tin bệnh nhân
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div>
              <span className="text-[11px] text-slate-400 block">Họ và tên</span>
              <span className="text-sm font-bold text-slate-900">{patient.name}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Giới tính / Nhóm máu</span>
              <span className="text-sm font-bold text-slate-900">
                {patient.gender === 'MALE' ? 'Nam' : patient.gender === 'FEMALE' ? 'Nữ' : 'Khác'} • {patient.bloodType || 'Chưa rõ'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Chiều cao / Cân nặng</span>
              <span className="text-sm font-bold text-slate-900">
                {patient.heightCm} cm • {patient.weightKg || '--'} kg
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Chỉ số thể trạng (BMI)</span>
              <span className="text-sm font-bold text-teal-600">
                {patient.bmi ? `${patient.bmi} kg/m²` : '--'}
              </span>
            </div>
          </div>

          {doctorNotes && (
            <div className="mt-4 pt-4 border-t border-slate-100 bg-amber-50/60 rounded-xl p-3 border-amber-200">
              <span className="text-xs font-bold text-amber-900 block mb-1">
                📝 Lời nhắn gửi từ bệnh nhân:
              </span>
              <p className="text-xs text-amber-950 italic">{doctorNotes}</p>
            </div>
          )}
        </div>

        {/* Thẻ thống kê 30 ngày */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 block mb-1">
              Huyết áp Trung bình (30 ngày)
            </span>
            <div className="text-2xl font-black text-slate-900">
              {stats.BLOOD_PRESSURE ? (
                `${stats.BLOOD_PRESSURE.avgSystolic}/${stats.BLOOD_PRESSURE.avgDiastolic} mmHg`
              ) : (
                'Chưa có dữ liệu'
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Dựa trên {stats.BLOOD_PRESSURE?.count || 0} lần đo
            </span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 block mb-1">
              Nhịp tim Trung bình
            </span>
            <div className="text-2xl font-black text-rose-600">
              {stats.HEART_RATE ? `${stats.HEART_RATE.avgValue} bpm` : 'Chưa có dữ liệu'}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Dựa trên {stats.HEART_RATE?.count || 0} lần đo
            </span>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 block mb-1">
              Đường huyết Trung bình
            </span>
            <div className="text-2xl font-black text-amber-600">
              {stats.BLOOD_SUGAR ? `${stats.BLOOD_SUGAR.avgValue} mg/dL` : 'Chưa có dữ liệu'}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Dựa trên {stats.BLOOD_SUGAR?.count || 0} lần đo
            </span>
          </div>
        </div>

        {/* Biểu đồ diễn biến huyết áp */}
        {bpChartData.length > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Diễn Biến Huyết Áp 30 Ngày Gần Nhất (mmHg)
              </h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bpChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={[50, 200]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="systolic"
                    name="Tâm thu"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="diastolic"
                    name="Tâm trương"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bảng nhật ký chi tiết */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-900 mb-4">
            Nhật Ký Các Lần Đo Gần Nhất ({records.length} bản ghi)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Loại chỉ số</th>
                  <th className="py-2.5 px-3">Kết quả đo</th>
                  <th className="py-2.5 px-3">Đánh giá y tế</th>
                  <th className="py-2.5 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const evalRes = r.evaluation;
                  return (
                    <tr key={r._id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(r.recordedAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {r.type}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {r.type === 'BLOOD_PRESSURE'
                          ? `${r.systolic}/${r.diastolic} mmHg`
                          : `${r.value} ${r.unit || ''}`}
                      </td>
                      <td className="py-2.5 px-3">
                        {evalRes && (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              evalRes.level === 'DANGER'
                                ? 'bg-rose-100 text-rose-700'
                                : evalRes.level === 'WARNING'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {evalRes.label}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 italic">
                        {r.note || '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer bảo mật */}
        <div className="text-center text-xs text-slate-400 py-4 print:text-slate-600">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Liên kết được mã hóa bảo mật bởi nền tảng HealthJourney. Hết hạn lúc:{' '}
            {new Date(expiresAt).toLocaleString('vi-VN')}
          </p>
        </div>
      </div>
    </div>
  );
}
