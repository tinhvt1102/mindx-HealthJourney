import React, { useState } from 'react';
import { 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  HeartHandshake, 
  ShieldAlert,
  Loader2,
  Calendar
} from 'lucide-react';
import { aiService } from '../services/api';

/**
 * Component Trợ lý AI Tóm tắt & Phân tích Xu hướng Sức khỏe (Jira SCRUM-54 / E6-S1)
 * Đáp ứng các tiêu chí:
 * - AC1: Nút tạo tóm tắt -> Backend gom dữ liệu được phép xem -> gọi Gemini API / Fallback engine
 * - AC2: Hiển thị Markdown tiếng Việt: Xu hướng chính, Điểm tích cực, Lưu ý sinh hoạt
 * - AC3: Footer Disclaimer bắt buộc: Không thay thế cho chẩn đoán của bác sĩ chuyên khoa
 * - AC4: Bắt buộc tối thiểu 3 bản ghi dữ liệu đo lường
 */
export default function AiSummaryCard({ memberId, familyId, memberName = 'bạn', isSelfView = true }) {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [error, setError] = useState(null);
  const [insufficientData, setInsufficientData] = useState(null);

  const fetchSummary = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      setInsufficientData(null);

      const payload = { forceRefresh };
      if (memberId) payload.memberId = memberId;
      if (familyId) payload.familyId = familyId;

      const res = await aiService.summarizeTrends(payload);

      if (res.success) {
        setSummaryData(res);
      } else {
        setError(res.message || 'Không thể tạo tóm tắt sức khỏe');
      }
    } catch (err) {
      console.error('Lỗi khi lấy tóm tắt AI:', err);
      const data = err.response?.data;
      if (data?.code === 'INSUFFICIENT_DATA') {
        setInsufficientData({
          recordCount: data.recordCount || 0,
          minRequired: data.minRequired || 3,
          message: data.message,
        });
      } else if (data?.code === 'ACCESS_DENIED') {
        setError('Bị chặn bởi Privacy Matrix (Default Deny): Thành viên chưa chia sẻ dữ liệu chỉ số cho bạn.');
      } else {
        setError(data?.message || 'Có lỗi xảy ra khi tạo tóm tắt AI. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper render các đoạn văn từ Markdown của AI
  const renderFormattedMarkdown = (markdown) => {
    if (!markdown) return null;

    // Tách các đoạn bằng tiêu đề ###
    const sections = markdown.split(/(?=###\s+)/);

    return (
      <div className="space-y-4 text-sm leading-relaxed text-slate-700">
        {sections.map((section, idx) => {
          const trimmed = section.trim();
          if (!trimmed) return null;

          // Bỏ qua disclaimer markdown nếu đã có footer component riêng
          if (trimmed.includes('Lưu ý y tế:') || trimmed.includes('Bản tóm tắt chỉ mang tính chất tham khảo')) {
            return null;
          }

          let title = '';
          let body = trimmed;
          let icon = <TrendingUp className="w-4 h-4 text-emerald-600" />;

          if (trimmed.startsWith('### 1.') || trimmed.includes('Xu hướng chính')) {
            title = '1. Xu hướng chính';
            body = trimmed.replace(/^###.*?\n/, '');
            icon = <TrendingUp className="w-4 h-4 text-sky-600" />;
          } else if (trimmed.startsWith('### 2.') || trimmed.includes('Điểm tích cực')) {
            title = '2. Điểm tích cực';
            body = trimmed.replace(/^###.*?\n/, '');
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
          } else if (trimmed.startsWith('### 3.') || trimmed.includes('Lưu ý sinh hoạt')) {
            title = '3. Lưu ý sinh hoạt & Đề xuất';
            body = trimmed.replace(/^###.*?\n/, '');
            icon = <HeartHandshake className="w-4 h-4 text-amber-600" />;
          }

          const lines = body.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('---'));

          return (
            <div key={idx} className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              {title && (
                <div className="flex items-center gap-2 font-semibold text-slate-900 mb-2">
                  {icon}
                  <span>{title}</span>
                </div>
              )}
              <div className="space-y-1.5 pl-6 text-slate-600">
                {lines.map((line, lIdx) => {
                  const cleaned = line.replace(/^-\s+/, '').trim();
                  // Xử lý in đậm đơn giản
                  const parts = cleaned.split(/(\*\*.*?\*\*)/g);
                  return (
                    <div key={lIdx} className="list-disc list-item marker:text-slate-400">
                      {parts.map((p, pIdx) => {
                        if (p.startsWith('**') && p.endsWith('**')) {
                          return <strong key={pIdx} className="font-semibold text-slate-800">{p.slice(2, -2)}</strong>;
                        }
                        return p;
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 rounded-2xl border border-emerald-100 p-5 shadow-xs transition-all">
      {/* Header card */}
      <div className="flex items-center justify-between pb-3 border-b border-emerald-100/70">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-2xs">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span>Trợ lý AI Tóm tắt Xu hướng</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                Gemini Health
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Phân tích chỉ số 30 ngày qua của {isSelfView ? 'bạn' : memberName}
            </p>
          </div>
        </div>

        <div>
          {summaryData ? (
            <button
              onClick={() => fetchSummary(true)}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Phân tích lại dữ liệu mới nhất"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          ) : (
            <button
              onClick={() => fetchSummary(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang phân tích...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tạo tóm tắt AI</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Body content */}
      <div className="mt-4">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 py-3 animate-pulse">
            <div className="h-4 bg-emerald-100/60 rounded-md w-3/4"></div>
            <div className="h-4 bg-emerald-100/40 rounded-md w-full"></div>
            <div className="h-4 bg-emerald-100/40 rounded-md w-5/6"></div>
            <div className="flex items-center gap-2 pt-2 text-xs text-emerald-700">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Đang đọc dữ liệu đo lường và tham vấn trợ lý Gemini AI...</span>
            </div>
          </div>
        )}

        {/* Chưa yêu cầu tạo tóm tắt */}
        {!loading && !summaryData && !insufficientData && !error && (
          <div className="py-4 text-center">
            <p className="text-xs text-slate-500 mb-3">
              Nhấn nút <strong>"Tạo tóm tắt AI"</strong> để xem phân tích tự động về diễn biến huyết áp, nhịp tim, đường huyết và lời khuyên sinh hoạt.
            </p>
            <button
              onClick={() => fetchSummary(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all cursor-pointer border border-emerald-200 shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Bắt đầu phân tích xu hướng</span>
            </button>
          </div>
        )}

        {/* Cảnh báo thiếu dữ liệu (AC4 SCRUM-54: < 3 records) */}
        {insufficientData && (
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950 mb-1">Cần thêm dữ liệu đo lường</p>
              <p className="text-amber-800 leading-relaxed mb-2">
                Hệ thống cần tối thiểu <strong>{insufficientData.minRequired} bản ghi</strong> để nhận diện chính xác xu hướng sức khỏe.
                Hiện tại {isSelfView ? 'bạn' : memberName} mới có <strong>{insufficientData.recordCount} bản ghi</strong> được ghi nhận.
              </p>
              <p className="text-[11px] text-amber-700 font-medium">
                👉 Vui lòng ghi thêm các chỉ số huyết áp, nhịp tim hoặc cân nặng để sử dụng tính năng này.
              </p>
            </div>
          </div>
        )}

        {/* Lỗi */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Nội dung kết quả phân tích thành công */}
        {summaryData && !loading && (
          <div className="space-y-4">
            {/* Meta bar */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 bg-white/60 px-3 py-1.5 rounded-lg border border-slate-100">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Dữ liệu: {summaryData.recordCount} lần đo</span>
              </span>
              {summaryData.fromCache && (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <span>(Kết quả đã lưu trong ngày)</span>
                </span>
              )}
            </div>

            {/* Markdown rendered sections */}
            {renderFormattedMarkdown(summaryData.summary)}

            {/* Mandatory Disclaimer footer (AC3 SCRUM-54) */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-amber-800 font-medium">
                <strong>Lưu ý y tế:</strong> {summaryData.disclaimer || 'Bản tóm tắt chỉ mang tính chất tham khảo, không thay thế cho chẩn đoán của bác sĩ chuyên khoa.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
