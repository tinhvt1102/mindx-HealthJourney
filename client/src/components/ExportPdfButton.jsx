import React, { useState, useRef } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import MedicalReportTemplate from './MedicalReportTemplate';
import { exportMedicalReportToPdf, generateMedicalReportFileName } from '../utils/exportPdf';
import api, { healthRecordService, aiService } from '../services/api';

/**
 * Nút bấm Xuất báo cáo y tế PDF (SCRUM-72 / AC1 SCRUM-70)
 * Hỗ trợ xuất cho chính người dùng hoặc cho thành viên gia đình (tuân thủ SharingPolicy)
 *
 * @param {Object} props
 * @param {Object} props.user - Thông tin người dùng cần xuất báo cáo (name, fullName, gender, birthDate, heightCm, weight)
 * @param {string} [props.familyId] - ID nhóm gia đình (khi xuất cho thành viên khác)
 * @param {string} [props.targetUserId] - ID người dùng mục tiêu (nếu khác currentUser)
 * @param {string} [props.buttonText="Xuất báo cáo PDF"]
 * @param {string} [props.variant="primary"] - 'primary' | 'secondary' | 'outline' | 'subtle'
 * @param {string} [props.className]
 */
export default function ExportPdfButton({
  user,
  familyId,
  targetUserId,
  buttonText = 'Xuất báo cáo PDF',
  variant = 'primary',
  className = '',
}) {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [reportData, setReportData] = useState(null);
  const templateRef = useRef(null);

  const handleExport = async (e) => {
    e?.stopPropagation?.();
    if (loading) return;

    try {
      setLoading(true);
      setStatusText('Đang tổng hợp dữ liệu 30 ngày...');

      // 1. Tải dữ liệu 30 ngày qua (tự động phân quyền nếu xem người thân qua endpoint backend)
      let records = [];
      try {
        if (familyId && targetUserId) {
          const res = await api.get(`/families/${familyId}/members/${targetUserId}/health-records`, {
            params: { days: 30 },
          });
          records = res?.data?.data || [];
        } else {
          const res = await healthRecordService.getAll({ days: 30 });
          records = res?.data || [];
        }
      } catch (recErr) {
        console.warn('Không thể tải bản ghi sức khỏe:', recErr);
        records = [];
      }

      // 2. Tải bản tóm tắt AI (nếu có cache hoặc tạo mới; bỏ qua nếu lỗi/không đủ records)
      let aiSummary = null;
      try {
        setStatusText('Đang tích hợp đánh giá AI...');
        if (aiService?.summarizeTrends) {
          const aiRes = await aiService.summarizeTrends(targetUserId, familyId);
          if (aiRes?.success && aiRes?.summary) {
            aiSummary = aiRes.summary;
          }
        }
      } catch {
        // AI summary là tính năng bổ trợ, không block xuất báo cáo nếu thiếu data
        aiSummary = null;
      }

      // Chuẩn bị dữ liệu hiển thị trên Template
      const displayName = user?.fullName || user?.name || 'Thành viên';
      const cleanUser = {
        name: displayName,
        gender: user?.gender === 'MALE' ? 'Nam' : user?.gender === 'FEMALE' ? 'Nữ' : (user?.gender || '—'),
        age: user?.birthDate
          ? Math.floor((Date.now() - new Date(user.birthDate)) / 31557600000)
          : (user?.age ?? null),
        dateOfBirth: user?.birthDate,
        height: user?.heightCm || user?.height,
        weight: user?.weight,
        email: user?.email,
      };

      const reportId = `HJ-${Date.now().toString(36).toUpperCase()}`;

      setReportData({
        user: cleanUser,
        records,
        aiSummary,
        generatedDate: new Date(),
        reportId,
      });

      setStatusText('Đang tạo file PDF y tế...');

      // Đợi DOM cập nhật và render template trước khi html2canvas chụp
      await new Promise((resolve) => setTimeout(resolve, 400));

      if (!templateRef.current) {
        throw new Error('Không thể khởi tạo khung báo cáo');
      }

      const fileName = generateMedicalReportFileName(displayName);
      await exportMedicalReportToPdf(templateRef.current, fileName);

    } catch (err) {
      console.error('Lỗi khi xuất file PDF:', err);
      alert('Không thể tạo file PDF: ' + (err?.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
      setStatusText('');
      setReportData(null);
    }
  };

  // Kiểu dáng hiển thị nút bấm
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer select-none text-xs';
  const variantClasses = {
    primary: 'px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-600/20 active:scale-[0.98]',
    secondary: 'px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white active:scale-[0.98]',
    outline: 'px-3 py-1.5 rounded-lg border border-slate-300 hover:border-teal-500 hover:bg-teal-50 text-slate-700 hover:text-teal-700 active:scale-[0.98]',
    subtle: 'px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 active:scale-[0.98]',
  };

  return (
    <>
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        title="Tải xuống báo cáo sức khỏe 30 ngày định dạng PDF chuẩn in A4"
        className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${className} ${loading ? 'opacity-80 cursor-wait' : ''}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-current" />
            <span>{statusText || 'Đang tạo file PDF...'}</span>
          </>
        ) : (
          <>
            <FileDown className="w-4 h-4 text-current" />
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {/* Render Template ngoài màn hình để html2canvas chụp */}
      {reportData && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            opacity: 1,
            pointerEvents: 'none',
            zIndex: -9999,
            backgroundColor: '#ffffff',
            color: '#1e293b',
          }}
        >
          <MedicalReportTemplate
            ref={templateRef}
            user={reportData.user}
            records={reportData.records}
            aiSummary={reportData.aiSummary}
            generatedDate={reportData.generatedDate}
            reportId={reportData.reportId}
          />
        </div>
      )}
    </>
  );
}
