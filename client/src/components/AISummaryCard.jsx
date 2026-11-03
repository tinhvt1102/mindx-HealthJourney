import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Sparkles, 
  RotateCw, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  Info,
  Calendar,
  Layers
} from 'lucide-react';
import { aiService } from '../services/api';

/**
 * Component hiển thị thẻ AI Tóm tắt xu hướng sức khỏe (SCRUM-58)
 *
 * @param {Object} props
 * @param {string} [props.targetUserId] - ID người dùng được phân tích (để trống nếu tóm tắt cho chính mình)
 * @param {string} [props.familyId] - ID nhóm gia đình (bắt buộc khi xem người thân)
 * @param {string} [props.targetUserName] - Tên người dùng hiển thị
 * @param {boolean} [props.autoFetch=false] - Tự động tải tóm tắt khi mount component
 */
export default function AISummaryCard({ 
  targetUserId, 
  familyId, 
  targetUserName,
  autoFetch = false 
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [currentCount, setCurrentCount] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await aiService.summarizeTrends(targetUserId, familyId);
      if (res && res.success) {
        setData(res);
        setCurrentCount(res.recordCount || null);
      } else {
        setError(res?.message || 'Không thể lấy bản tóm tắt xu hướng');
      }
    } catch (err) {
      const errRes = err?.response?.data;
      if (errRes?.currentCount !== undefined) {
        setCurrentCount(errRes.currentCount);
      }
      setError(
        errRes?.message || 
        err?.message || 
        'Đã xảy ra lỗi khi tạo tóm tắt xu hướng sức khỏe'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchSummary();
    }
  }, [targetUserId, familyId, autoFetch]);

  // Kiểm tra lỗi có phải do thiếu dữ liệu (< 3 bản ghi) không
  const isInsufficientData = 
    error && (error.includes('tối thiểu 3 bản ghi') || (currentCount !== null && currentCount < 3));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-200">
      {/* Top Header Card */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-50/60 via-indigo-50/40 to-teal-50/40">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 fill-white/20 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-lg leading-tight">
                Tóm tắt xu hướng AI
              </h3>
              <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                Gemini
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {targetUserName 
                ? `Phân tích biến thiên chỉ số sức khỏe của ${targetUserName}` 
                : 'Trợ lý AI phân tích biến thiên các chỉ số theo dòng thời gian'}
            </p>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer shadow-sm ${
              loading
                ? 'bg-purple-100 text-purple-400 cursor-not-allowed'
                : data
                ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-purple-300'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-indigo-500/20'
            }`}
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>
              {loading 
                ? 'Đang phân tích...' 
                : data 
                ? 'Làm mới' 
                : 'Tạo tóm tắt'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 sm:p-6">
        {/* TRẠNG THÁI 1: ĐANG LOADING */}
        {loading && (
          <div className="space-y-4 py-3 animate-pulse">
            <div className="flex items-center gap-3 text-purple-700 text-sm font-medium">
              <RotateCw className="w-4 h-4 animate-spin text-purple-600" />
              <span>AI đang phân tích xu hướng sức khỏe... Vui lòng chờ giây lát</span>
            </div>

            {/* Skeleton lines */}
            <div className="space-y-2.5 pt-2">
              <div className="h-4 bg-slate-200/70 rounded-md w-3/4" />
              <div className="h-4 bg-slate-200/70 rounded-md w-full" />
              <div className="h-4 bg-slate-200/70 rounded-md w-5/6" />
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="h-4 bg-slate-200/70 rounded-md w-2/5" />
              <div className="h-4 bg-slate-200/70 rounded-md w-11/12" />
              <div className="h-4 bg-slate-200/70 rounded-md w-4/5" />
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="h-4 bg-slate-200/70 rounded-md w-1/3" />
              <div className="h-4 bg-slate-200/70 rounded-md w-full" />
              <div className="h-4 bg-slate-200/70 rounded-md w-3/5" />
            </div>
          </div>
        )}

        {/* TRẠNG THÁI 2: LỖI THIẾU DỮ LIỆU (< 3 bản ghi) */}
        {!loading && isInsufficientData && (
          <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-start gap-3.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-semibold text-amber-900">
                Chưa đủ dữ liệu để phân tích xu hướng
              </h4>
              <p className="text-amber-800 mt-1 leading-relaxed">
                Cần tối thiểu <strong>3 bản ghi</strong> chỉ số sức khỏe để kích hoạt tóm tắt AI.
                {currentCount !== null && (
                  <span className="block mt-0.5 font-medium">
                    (Hiện có: {currentCount} bản ghi)
                  </span>
                )}
              </p>
              <p className="text-xs text-amber-700 mt-2">
                💡 Hãy ghi nhận thêm các chỉ số hàng ngày (huyết áp, nhịp tim, cân nặng...) để AI có thể đánh giá tính liên tục và biến thiên chính xác.
              </p>
            </div>
          </div>
        )}

        {/* TRẠNG THÁI 3: LỖI KHÁC (Quyền hạn, mạng, ...) */}
        {!loading && error && !isInsufficientData && (
          <div className="p-5 rounded-xl border border-rose-200 bg-rose-50/60 flex items-start gap-3.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-semibold text-rose-900">
                Không thể tải tóm tắt xu hướng
              </h4>
              <p className="text-rose-700 mt-1 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* TRẠNG THÁI 4: CHƯA CÓ KẾT QUẢ VÀ CHƯA GỌI */}
        {!loading && !data && !error && (
          <div className="text-center py-8 px-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7" />
            </div>
            <h4 className="font-semibold text-slate-800 text-base">
              Khám phá xu hướng sức khỏe với Gemini AI
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Hệ thống tự động tổng hợp các lần đo gần đây, phát hiện điểm tích cực và gợi ý thói quen sinh hoạt phù hợp.
            </p>
            <button
              type="button"
              onClick={fetchSummary}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-md shadow-purple-600/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Bắt đầu phân tích ngay</span>
            </button>
          </div>
        )}

        {/* TRẠNG THÁI 5: ĐÃ CÓ KẾT QUẢ TÓM TẮT */}
        {!loading && data && data.summary && (
          <div className="space-y-4">
            {/* Meta Tags: Huy hiệu Cache & Chế độ */}
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
              {data.fromCache ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Được tạo từ dữ liệu ngày hôm nay (Cached)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Vừa tạo mới từ Gemini AI
                </span>
              )}

              {data.isFallback && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  Phân tích nhanh (Chế độ dự phòng)
                </span>
              )}

              {data.cacheDate && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-slate-500 bg-slate-100">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {data.cacheDate}
                </span>
              )}

              {data.recordCount && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-slate-500 bg-slate-100">
                  <Layers className="w-3 h-3 text-slate-400" />
                  {data.recordCount} bản ghi
                </span>
              )}
            </div>

            {/* Nội dung Markdown */}
            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed space-y-3 prose-headings:font-bold prose-headings:text-slate-900 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-slate-900">
              <ReactMarkdown>{data.summary}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Footer Disclaimer bắt buộc */}
      <div className="px-5 py-3.5 sm:px-6 bg-slate-50/80 border-t border-slate-100 flex items-start sm:items-center gap-2.5 text-slate-500 text-xs">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5 sm:mt-0" />
        <p className="leading-snug">
          <strong>Lưu ý y tế:</strong> Tóm tắt này được tạo bởi AI nhằm mục đích tham khảo và theo dõi xu hướng, không có giá trị thay thế chẩn đoán hoặc chỉ định từ bác sĩ chuyên khoa.
        </p>
      </div>
    </div>
  );
}
