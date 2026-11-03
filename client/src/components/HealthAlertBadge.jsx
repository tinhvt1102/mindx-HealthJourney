import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { evaluateMedicalThreshold, RISK_LEVELS } from '../utils/healthThresholds';

/**
 * Component Badge cảnh báo trực quan theo ngưỡng y khoa (Jira SCRUM-53 / SCRUM-52)
 * Hiển thị huy hiệu màu:
 * - Xanh lá (NORMAL): Ổn định, an toàn
 * - Vàng (WARNING): Cần lưu ý, theo dõi
 * - Đỏ (DANGER): Nguy cơ cao, cần xử lý y tế
 */
export default function HealthAlertBadge({
  metricType,
  values,
  evaluation = null,
  showDescription = false,
  size = 'md',
}) {
  const result = evaluation || evaluateMedicalThreshold(metricType, values);

  const getIcon = () => {
    switch (result.level) {
      case RISK_LEVELS.DANGER:
        return <AlertOctagon className={size === 'sm' ? 'w-3 h-3 text-rose-600' : 'w-3.5 h-3.5 text-rose-600 animate-pulse'} />;
      case RISK_LEVELS.WARNING:
        return <AlertTriangle className={size === 'sm' ? 'w-3 h-3 text-amber-600' : 'w-3.5 h-3.5 text-amber-600'} />;
      case RISK_LEVELS.NORMAL:
      default:
        return <CheckCircle2 className={size === 'sm' ? 'w-3 h-3 text-emerald-600' : 'w-3.5 h-3.5 text-emerald-600'} />;
    }
  };

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px]' 
    : 'px-2.5 py-1 text-xs';

  return (
    <div className="inline-flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1.5 font-bold rounded-full border shadow-2xs transition-all ${sizeClasses} ${result.bgClass || 'bg-slate-50 text-slate-700 border-slate-200'}`}
        title={result.description}
      >
        {getIcon()}
        <span>{result.label}</span>
      </span>

      {showDescription && result.description && (
        <p className="text-[11px] text-slate-500 flex items-start gap-1 mt-0.5 leading-snug">
          <Info className="w-3 h-3 shrink-0 text-slate-400 mt-0.5" />
          <span>{result.description}</span>
        </p>
      )}
    </div>
  );
}
