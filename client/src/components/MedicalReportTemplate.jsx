import React from 'react';
import { Heart, AlertCircle } from 'lucide-react';

// --- Helpers ---
const METRIC_CONFIG = {
  BLOOD_PRESSURE: {
    label: 'Huyết áp',
    unit: 'mmHg',
    normalRange: '90-120 / 60-80',
    getDisplay: (v) => v?.systolic && v?.diastolic ? `${v.systolic}/${v.diastolic}` : (v?.value ?? '—'),
    getAvg: (vals) => {
      const sys = vals.map(v => v?.systolic ?? v?.value?.split?.('/')?.[0]).filter(Boolean).map(Number);
      const dia = vals.map(v => v?.diastolic ?? v?.value?.split?.('/')?.[1]).filter(Boolean).map(Number);
      if (!sys.length) return '—';
      const avgSys = Math.round(sys.reduce((a, b) => a + b, 0) / sys.length);
      const avgDia = dia.length ? Math.round(dia.reduce((a, b) => a + b, 0) / dia.length) : '—';
      return `${avgSys}/${avgDia}`;
    },
    checkStatus: (v) => {
      const sys = v?.systolic ?? Number(String(v?.value).split('/')[0]);
      const dia = v?.diastolic ?? Number(String(v?.value).split('/')[1]);
      if (!sys) return null;
      return (sys >= 90 && sys <= 120 && dia >= 60 && dia <= 80) ? 'normal' : 'warning';
    },
  },
  HEART_RATE: {
    label: 'Nhịp tim',
    unit: 'bpm',
    normalRange: '60–100',
    getDisplay: (v) => v?.value ?? '—',
    getAvg: (vals) => {
      const nums = vals.map(v => Number(v?.value)).filter(n => !isNaN(n));
      return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : '—';
    },
    checkStatus: (v) => {
      const n = Number(v?.value);
      return isNaN(n) ? null : (n >= 60 && n <= 100 ? 'normal' : 'warning');
    },
  },
  BLOOD_SUGAR: {
    label: 'Đường huyết',
    unit: 'mg/dL',
    normalRange: '70–99',
    getDisplay: (v) => v?.value ?? '—',
    getAvg: (vals) => {
      const nums = vals.map(v => Number(v?.value)).filter(n => !isNaN(n));
      return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : '—';
    },
    checkStatus: (v) => {
      const n = Number(v?.value);
      return isNaN(n) ? null : (n >= 70 && n <= 99 ? 'normal' : 'warning');
    },
  },
  WEIGHT: {
    label: 'Cân nặng',
    unit: 'kg',
    normalRange: 'BMI 18.5–24.9',
    getDisplay: (v) => v?.value ?? '—',
    getAvg: (vals) => {
      const nums = vals.map(v => Number(v?.value)).filter(n => !isNaN(n));
      return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—';
    },
    checkStatus: () => null,
  },
  TEMPERATURE: {
    label: 'Thân nhiệt',
    unit: '°C',
    normalRange: '36.1–37.2',
    getDisplay: (v) => v?.value ?? '—',
    getAvg: (vals) => {
      const nums = vals.map(v => Number(v?.value)).filter(n => !isNaN(n));
      return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—';
    },
    checkStatus: (v) => {
      const n = Number(v?.value);
      return isNaN(n) ? null : (n >= 36.1 && n <= 37.2 ? 'normal' : 'warning');
    },
  },
  SPO2: {
    label: 'SpO2',
    unit: '%',
    normalRange: '95–100',
    getDisplay: (v) => v?.value ?? '—',
    getAvg: (vals) => {
      const nums = vals.map(v => Number(v?.value)).filter(n => !isNaN(n));
      return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : '—';
    },
    checkStatus: (v) => {
      const n = Number(v?.value);
      return isNaN(n) ? null : (n >= 95 ? 'normal' : 'warning');
    },
  },
};

function calcBMI(weight, height) {
  if (!weight || !height) return null;
  const h = height / 100;
  return (weight / (h * h)).toFixed(1);
}

function bmiClass(bmi) {
  const b = Number(bmi);
  if (isNaN(b)) return '';
  if (b < 18.5) return 'Gầy';
  if (b < 25) return 'Bình thường';
  if (b < 30) return 'Thừa cân';
  return 'Béo phì';
}

function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s?/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^[-*+]\s/gm, '• ')
    .trim();
}

// --- Component ---
const MedicalReportTemplate = React.forwardRef(function MedicalReportTemplate(
  { user, records = [], aiSummary, generatedDate, reportId },
  ref
) {
  // Group records by type
  const grouped = {};
  (records || []).forEach((r) => {
    const type = r.type || r.metricType;
    if (!type) return;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(r);
  });

  // Sort each group by date desc
  Object.keys(grouped).forEach((k) => {
    grouped[k].sort((a, b) => new Date(b.recordedAt ?? b.createdAt) - new Date(a.recordedAt ?? a.createdAt));
  });

  const dateStr = generatedDate
    ? new Date(generatedDate).toLocaleDateString('vi-VN')
    : new Date().toLocaleDateString('vi-VN');

  const rid = reportId || `HJ-${Date.now().toString(36).toUpperCase()}`;

  const weight = user?.weight ?? (grouped.WEIGHT?.[0]?.value);
  const height = user?.height;
  const bmi = calcBMI(weight, height);

  const metricRows = Object.keys(METRIC_CONFIG).filter((k) => grouped[k]?.length);

  return (
    <div
      ref={ref}
      style={{
        width: '794px',
        minHeight: '1123px',
        padding: '40px 48px',
        background: '#ffffff',
        color: '#1e293b',
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        fontSize: '13px',
        lineHeight: '1.6',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '2px solid #0d9488', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: '#0d9488', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={22} color="#fff" fill="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '18px', color: '#0d9488', letterSpacing: '1px' }}>HEALTHJOURNEY</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Nền tảng theo dõi sức khỏe cá nhân</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>BÁO CÁO THEO DÕI SỨC KHỎE ĐỊNH KỲ</div>
          <div style={{ fontWeight: '700', fontSize: '12px', color: '#1e293b' }}>(30 NGÀY)</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Ngày xuất: {dateStr}</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Mã hồ sơ: <span style={{ fontWeight: '600', color: '#0d9488' }}>{rid}</span></div>
        </div>
      </div>

      {/* ── THÔNG TIN BỆNH NHÂN ── */}
      <div style={{ marginBottom: '20px' }}>
        <SectionTitle>I. THÔNG TIN NGƯỜI THEO DÕI</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <tbody>
            <InfoRow label="Họ và tên" value={user?.name || user?.fullName || '—'} label2="Giới tính" value2={user?.gender === 'male' ? 'Nam' : user?.gender === 'female' ? 'Nữ' : (user?.gender || '—')} />
            <InfoRow
              label="Ngày sinh"
              value={user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('vi-VN') : (user?.age ? `${user.age} tuổi` : '—')}
              label2="Tuổi"
              value2={user?.age ?? (user?.dateOfBirth ? Math.floor((Date.now() - new Date(user.dateOfBirth)) / 31557600000) : '—')}
            />
            <InfoRow
              label="Chiều cao"
              value={height ? `${height} cm` : '—'}
              label2="Cân nặng"
              value2={weight ? `${weight} kg` : '—'}
            />
            <InfoRow
              label="BMI"
              value={bmi ? `${bmi} (${bmiClass(bmi)})` : '—'}
              label2="Email"
              value2={user?.email || '—'}
            />
          </tbody>
        </table>
      </div>

      {/* ── BẢNG CHỈ SỐ ── */}
      <div style={{ marginBottom: '20px' }}>
        <SectionTitle>II. TỔNG HỢP CHỈ SỐ SINH HIỆU (30 NGÀY QUA)</SectionTitle>
        {metricRows.length === 0 ? (
          <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>Chưa có dữ liệu chỉ số sức khỏe trong 30 ngày qua.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f1fafa' }}>
                {['Chỉ số', 'Giá trị gần nhất', 'Trung bình 30 ngày', 'Khoảng an toàn', 'Trạng thái'].map((h) => (
                  <th key={h} style={{ padding: '7px 10px', border: '1px solid #cbd5e1', textAlign: 'left', fontWeight: '600', color: '#0f766e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRows.map((type, i) => {
                const cfg = METRIC_CONFIG[type];
                const vals = grouped[type];
                const latest = vals[0];
                const display = cfg.getDisplay(latest);
                const avg = cfg.getAvg(vals);
                const status = cfg.checkStatus(latest);
                return (
                  <tr key={type} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={td}><strong>{cfg.label}</strong></td>
                    <td style={td}>{display} {cfg.unit}</td>
                    <td style={td}>{avg} {avg !== '—' ? cfg.unit : ''}</td>
                    <td style={td}>{cfg.normalRange} {cfg.unit}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {status === 'normal' && <span style={{ color: '#16a34a', fontWeight: '700' }}>✓ Bình thường</span>}
                      {status === 'warning' && <span style={{ color: '#dc2626', fontWeight: '700' }}>⚠ Chú ý</span>}
                      {!status && <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── AI SUMMARY ── */}
      {aiSummary && (
        <div style={{ marginBottom: '20px' }}>
          <SectionTitle>III. ĐÁNH GIÁ XU HƯỚNG (AI)</SectionTitle>
          <div style={{ border: '1.5px dashed #0d9488', borderRadius: '8px', padding: '14px 16px', background: '#f0fdfa' }}>
            <div style={{ fontWeight: '600', fontSize: '12px', color: '#0f766e', marginBottom: '8px' }}>Phân tích xu hướng sức khỏe tổng quan:</div>
            <div style={{ fontSize: '12px', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: '1.7' }}>
              {stripMarkdown(typeof aiSummary === 'string' ? aiSummary : aiSummary?.summary)}
            </div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'flex-start', gap: '6px', background: '#fef3c7', borderRadius: '6px', padding: '8px 10px' }}>
              <AlertCircle size={14} color="#b45309" style={{ marginTop: '1px', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: '#92400e' }}>
                Nội dung này được tạo bởi AI và chỉ mang tính tham khảo. Không thay thế chẩn đoán và tư vấn y tế chuyên nghiệp.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── KHU VỰC CHỮ KÝ ── */}
      <div style={{ marginTop: '28px', marginBottom: '20px' }}>
        <SectionTitle>IV. XÁC NHẬN & CHỮ KÝ</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {['Người theo dõi', 'Bác sĩ tư vấn (nếu có)'].map((label) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '48px' }}>(Ký và ghi rõ họ tên)</div>
              <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '4px', fontSize: '11px', color: '#94a3b8' }}>Họ tên & chữ ký</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ position: 'absolute', bottom: '28px', left: '48px', right: '48px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
          <span>HealthJourney – Báo cáo sức khỏe cá nhân</span>
          <span>Trang 1/1 | Mã: {rid} | {dateStr}</span>
        </div>
        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px' }}>
          ⚠ Tài liệu này chỉ mang tính tham khảo cá nhân. Không dùng thay thế tư vấn y tế chuyên nghiệp từ bác sĩ có chuyên môn.
        </div>
      </div>
    </div>
  );
});

// ── Sub-components ──
function SectionTitle({ children }) {
  return (
    <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#0f766e', borderBottom: '1px solid #99f6e4', paddingBottom: '4px', marginBottom: '10px', letterSpacing: '0.3px' }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value, label2, value2 }) {
  const cell = { padding: '5px 10px', border: '1px solid #e2e8f0' };
  const lStyle = { ...cell, background: '#f8fafc', fontWeight: '600', color: '#475569', width: '20%' };
  const vStyle = { ...cell, color: '#1e293b', width: '30%' };
  return (
    <tr>
      <td style={lStyle}>{label}</td>
      <td style={vStyle}>{value}</td>
      <td style={lStyle}>{label2}</td>
      <td style={vStyle}>{value2}</td>
    </tr>
  );
}

const td = { padding: '6px 10px', border: '1px solid #e2e8f0' };

export default MedicalReportTemplate;
