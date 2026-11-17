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
  Calendar,
  Utensils,
  Dumbbell,
  CalendarCheck,
} from 'lucide-react';
import { aiService, habitService } from '../services/api';

const SECTION_MATCHERS = [
  {
    match: (text) => text.startsWith('### 1.') || text.includes('Xu hướng chính'),
    title: '1. Xu hướng chính',
    icon: TrendingUp,
    iconClass: 'text-sky-600 dark:text-sky-400',
    cardClass: 'bg-slate-50/80 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700/70',
  },
  {
    match: (text) => text.startsWith('### 2.') || text.includes('Điểm tích cực'),
    title: '2. Điểm tích cực',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    cardClass: 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40',
  },
  {
    match: (text) => text.includes('Quy trình ăn uống') || text.includes('ăn uống'),
    title: '3. Quy trình ăn uống phù hợp',
    icon: Utensils,
    iconClass: 'text-orange-600 dark:text-orange-400',
    cardClass: 'bg-orange-50/40 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/40',
  },
  {
    match: (text) => text.includes('Quy trình tập luyện') || text.includes('tập luyện'),
    title: '4. Quy trình tập luyện phù hợp',
    icon: Dumbbell,
    iconClass: 'text-teal-600 dark:text-teal-400',
    cardClass: 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/40',
  },
  {
    match: (text) => text.startsWith('### 3.') || text.includes('Lưu ý sinh hoạt'),
    title: '5. Lưu ý sinh hoạt & khuyến nghị theo dõi',
    icon: HeartHandshake,
    iconClass: 'text-amber-600 dark:text-amber-400',
    cardClass: 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40',
  },
];

/**
 * Component Trợ lý AI Tóm tắt Xu hướng & Gợi ý Quy trình Ăn uống / Tập luyện
 */
export default function AiSummaryCard({ memberId, familyId, memberName = 'bạn', isSelfView = true, onOpenHabits = null }) {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [error, setError] = useState(null);
  const [insufficientData, setInsufficientData] = useState(null);
  const [syncingHabit, setSyncingHabit] = useState(false);
  const [syncedSuccess, setSyncedSuccess] = useState(false);

  const handleSyncToHabitBoard = async () => {
    if (!summaryData?.summary) return;
    try {
      setSyncingHabit(true);
      await habitService.syncFromAi({ summaryText: summaryData.summary });
      setSyncedSuccess(true);
      if (onOpenHabits) {
        onOpenHabits();
      }
    } catch (err) {
      console.error('Lỗi chuyển thành kế hoạch tuần:', err);
    } finally {
      setSyncingHabit(false);
    }
  };

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

    const sections = markdown.split(/(?=###\s+)/);

    return (
      <div className="space-y-3.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {sections.map((section, idx) => {
          const trimmed = section.trim();
          if (!trimmed) return null;

          if (trimmed.includes('Lưu ý y tế:') || trimmed.includes('Bản tóm tắt chỉ mang tính chất tham khảo')) {
            return null;
          }

          const matched = SECTION_MATCHERS.find((item) => item.match(trimmed));
          const title = matched ? matched.title : '';
          const body = matched ? trimmed.replace(/^###.*?\n/, '') : trimmed;
          const IconComponent = matched ? matched.icon : TrendingUp;
          const iconClass = matched ? matched.iconClass : 'text-emerald-600 dark:text-emerald-400';
          const cardClass = matched
            ? matched.cardClass
            : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700/70';

          const lines = body.split('\n').filter((l) => l.trim().length > 0 && !l.startsWith('---'));

          return (
            <div key={idx} className={`p-3.5 rounded-xl border ${cardClass}`}>
              {title && (
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white mb-2">
                  <IconComponent className={`w-4 h-4 shrink-0 ${iconClass}`} />
                  <span>{title}</span>
                </div>
              )}
              <div className="space-y-1.5 pl-6 text-slate-600 dark:text-slate-300">
                {lines.map((line, lIdx) => {
                  const cleaned = line.replace(/^-\s+/, '').trim();
                  const parts = cleaned.split(/(\*\*.*?\*\*)/g);
                  return (
                    <div key={lIdx} className="list-disc list-item marker:text-slate-400 dark:marker:text-slate-500">
                      {parts.map((p, pIdx) => {
                        if (p.startsWith('**') && p.endsWith('**')) {
                          return (
                            <strong key={pIdx} className="font-semibold text-slate-800 dark:text-slate-100">
                              {p.slice(2, -2)}
                            </strong>
                          );
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
    <div className="bg-linear-to-br from-white via-emerald-50/20 to-teal-50/30 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-slate-700 p-5 shadow-xs transition-all">
      {/* Header card */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-emerald-100/70 dark:border-slate-700/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-2xs shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
              <span>Trợ lý AI Phân tích & Lộ trình Sức khỏe</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-full">
                Gemini Health
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Xu hướng chỉ số & gợi ý ăn uống, tập luyện phù hợp cho {isSelfView ? 'bạn' : memberName}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {summaryData ? (
            <button
              onClick={() => fetchSummary(true)}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Phân tích lại dữ liệu mới nhất"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          ) : (
            <button
              onClick={() => fetchSummary(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang phân tích...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tạo phân tích AI</span>
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
            <div className="h-4 bg-emerald-100/60 dark:bg-slate-700 rounded-md w-3/4"></div>
            <div className="h-4 bg-emerald-100/40 dark:bg-slate-700/70 rounded-md w-full"></div>
            <div className="h-4 bg-emerald-100/40 dark:bg-slate-700/70 rounded-md w-5/6"></div>
            <div className="flex items-center gap-2 pt-2 text-xs text-emerald-700 dark:text-emerald-400">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span>Đang đọc dữ liệu và thiết kế thực đơn / bài tập phù hợp...</span>
            </div>
          </div>
        )}

        {/* Chưa yêu cầu tạo tóm tắt */}
        {!loading && !summaryData && !insufficientData && !error && (
          <div className="py-4 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-xl mx-auto">
              Nhấn nút <strong>"Tạo phân tích AI"</strong> để AI đánh giá diễn biến chỉ số sức khỏe và đề xuất{' '}
              <strong>quy trình ăn uống</strong>, <strong>lịch tập luyện</strong> phù hợp với thể trạng hiện tại.
            </p>
            <button
              onClick={() => fetchSummary(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition-all cursor-pointer border border-emerald-200 dark:border-emerald-800 shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Bắt đầu phân tích & nhận lộ trình</span>
            </button>
          </div>
        )}

        {/* Cảnh báo thiếu dữ liệu (AC4 SCRUM-54: < 3 records) */}
        {insufficientData && (
          <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-100 mb-1">Cần thêm dữ liệu đo lường</p>
              <p className="text-amber-800 dark:text-amber-200/90 leading-relaxed mb-2">
                Hệ thống cần tối thiểu <strong>{insufficientData.minRequired} bản ghi</strong> để nhận diện chính xác xu hướng và gợi ý quy trình ăn uống/tập luyện.
                Hiện tại {isSelfView ? 'bạn' : memberName} mới có <strong>{insufficientData.recordCount} bản ghi</strong> được ghi nhận.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                👉 Vui lòng ghi thêm các chỉ số huyết áp, nhịp tim hoặc cân nặng để sử dụng tính năng này.
              </p>
            </div>
          </div>
        )}

        {/* Lỗi */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Nội dung kết quả phân tích thành công */}
        {summaryData && !loading && (
          <div className="space-y-4">
            {/* Meta bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Dữ liệu: {summaryData.recordCount} lần đo</span>
                {summaryData.fromCache && (
                  <span className="text-slate-400 ml-1">(Kết quả lưu trong ngày)</span>
                )}
              </span>

              {isSelfView && (
                <button
                  type="button"
                  onClick={handleSyncToHabitBoard}
                  disabled={syncingHabit}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/80 rounded-lg border border-teal-200 dark:border-teal-800 transition-all cursor-pointer shadow-2xs"
                >
                  <CalendarCheck className={`w-3.5 h-3.5 text-teal-600 dark:text-teal-400 ${syncingHabit ? 'animate-spin' : ''}`} />
                  <span>
                    {syncedSuccess
                      ? 'Đã chuyển thành Kế hoạch tuần ✓'
                      : syncingHabit
                      ? 'Đang chuyển đổi...'
                      : 'Chuyển thành Kế hoạch tuần để tick'}
                  </span>
                </button>
              )}
            </div>

            {/* Markdown rendered sections */}
            {renderFormattedMarkdown(summaryData.summary)}

            {/* Mandatory Disclaimer footer */}
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200/90 font-medium">
                <strong>Lưu ý y tế:</strong>{' '}
                {summaryData.disclaimer ||
                  'Bản tóm tắt chỉ mang tính chất tham khảo, không thay thế cho chẩn đoán của bác sĩ chuyên khoa.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
