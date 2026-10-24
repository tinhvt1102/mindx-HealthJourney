import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Activity, 
  Heart, 
  Thermometer, 
  Scale, 
  Plus, 
  RotateCw,
  Eye,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

/**
 * 3D Anime Character Avatar & Interactive Biometric HUD
 * Hiển thị nhân vật 3D phong cách Pixar / Anime (Nam / Nữ)
 * Tương tác Parallax 3D xoay góc nhìn theo chuột và hiển thị HUD Y tế
 */
export default function Human3DViewer({
  gender = 'MALE',
  heightCm = 170,
  fullName = 'Người dùng',
  latestMetrics = {},
  onOpenLogModal,
}) {
  const cardRef = useRef(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [is3DActive, setIs3DActive] = useState(true);

  // Dữ liệu chỉ số sức khỏe thực tế
  const bpData = latestMetrics?.bloodPressure;
  const tempData = latestMetrics?.temperature;
  const weightData = latestMetrics?.weight;
  const heartData = latestMetrics?.heartRate;

  const bpDisplay = bpData ? `${bpData.systolic}/${bpData.diastolic}` : '120/80';
  const tempDisplay = tempData ? `${tempData.value}` : '36.8';
  const weightDisplay = weightData ? `${weightData.value}` : '65';
  const bmiDisplay = weightData?.bmi 
    ? weightData.bmi 
    : heightCm && weightDisplay 
    ? (Number(weightDisplay) / Math.pow(Number(heightCm) / 100, 2)).toFixed(1)
    : '22.5';
  const hrDisplay = heartData ? `${heartData.value}` : '75';

  const isFemale = gender === 'FEMALE';
  const avatarImageSrc = isFemale ? '/avatars/female_anime_3d.jpg' : '/avatars/male_anime_3d.jpg';
  const genderTitle = isFemale ? 'Nữ giới (Anime 3D)' : 'Nam giới (Anime 3D)';

  // Xử lý hiệu ứng 3D Parallax Tilt theo tọa độ chuột
  const handleMouseMove = (e) => {
    if (!cardRef.current || !is3DActive) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Giới hạn góc nghiêng 3D trong khoảng [-14, 14] độ
    const rY = ((x - centerX) / centerX) * 12;
    const rX = -((y - centerY) / centerY) * 12;

    setRotateX(rX);
    setRotateY(rY);

    // Vị trí ánh sáng phản chiếu (Glare shine)
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlarePos({ x: glareX, y: glareY, opacity: 0.25 });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div 
      className="bg-gradient-to-b from-slate-900 via-slate-900 to-teal-950 rounded-3xl p-5 text-white shadow-2xl border border-slate-800 relative overflow-hidden flex flex-col justify-between"
      style={{ perspective: '1200px' }}
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="relative z-20 flex items-center justify-between pb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-teal-300 uppercase tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-spin" style={{ animationDuration: '4s' }} />
            Mô hình Anime 3D
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            {fullName || 'Người dùng'}
          </h3>
          <p className="text-xs text-slate-300 font-medium">
            {genderTitle} • {heightCm} cm
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRotateX(0);
            setRotateY(0);
          }}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors cursor-pointer"
          title="Khôi phục góc nhìn thẳng"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* 3D PARALLAX CONTAINER VỚI NHÂN VẬT ANIME 3D & HUD CHỈ SỐ */}
      <div 
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative my-2 w-full h-[420px] sm:h-[460px] rounded-2xl overflow-hidden cursor-pointer transition-transform duration-100 ease-out flex items-center justify-center select-none"
        style={{
          transform: is3DActive 
            ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)` 
            : 'none',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Hình ảnh nhân vật 3D Anime chất lượng cao */}
        <div className="absolute inset-0 w-full h-full overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center">
          <img
            src={avatarImageSrc}
            alt={genderTitle}
            className="w-full h-full object-cover object-center transition-all duration-500 transform hover:scale-105"
            style={{
              filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.5))',
            }}
          />

          {/* Vầng sáng Gradient viền & Đổ bóng tạo chiều sâu */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/30 pointer-events-none" />

          {/* Hiệu ứng tia sáng phản chiếu (Specular Glare) */}
          <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity}) 0%, transparent 60%)`,
            }}
          />
        </div>

        {/* Thước đo Laser Chiều cao bên trái */}
        <div 
          className="absolute left-2.5 top-8 bottom-12 flex flex-col justify-between text-[10px] font-mono text-teal-300 pointer-events-none border-l-2 border-teal-400/50 pl-1.5 z-20"
          style={{ transform: 'translateZ(30px)' }}
        >
          <span className="flex items-center gap-1 drop-shadow-sm">
            <span className="w-2.5 h-0.5 bg-teal-400" /> 200 cm
          </span>
          <span className="flex items-center gap-1 font-extrabold text-teal-200 bg-teal-900/90 px-1.5 py-0.5 rounded border border-teal-400 shadow-md">
            <span className="w-3 h-0.5 bg-teal-300" /> {heightCm} cm
          </span>
          <span className="flex items-center gap-1 drop-shadow-sm">
            <span className="w-2.5 h-0.5 bg-teal-400" /> 150 cm
          </span>
          <span className="flex items-center gap-1 drop-shadow-sm">
            <span className="w-2.5 h-0.5 bg-teal-400" /> 100 cm
          </span>
        </div>

        {/* ============================================================== */}
        {/* HUD CHỈ SỐ 1: NHIỆT ĐỘ THÂN THỂ (GẮN VÙNG ĐẦU / TRÁN)        */}
        {/* ============================================================== */}
        <div 
          className="absolute right-3 top-4 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-orange-500/50 shadow-2xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105 z-20"
          style={{ transform: 'translateZ(40px)' }}
        >
          <div className="flex items-center gap-1.5 text-orange-400 font-bold text-[11px]">
            <Thermometer className="w-3.5 h-3.5 text-orange-400" />
            <span>Thân nhiệt</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-white">{tempDisplay}</span>
            <span className="text-[10px] text-slate-400">°C</span>
          </div>
          <span className="inline-block text-[9px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/30">
            Thân nhiệt ổn định
          </span>
        </div>

        {/* ============================================================== */}
        {/* HUD CHỈ SỐ 2: HUYẾT ÁP & NHỊP TIM (GẮN VÙNG NGỰC / TIM)       */}
        {/* ============================================================== */}
        <div 
          className="absolute right-3 top-28 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-rose-500/50 shadow-2xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105 z-20"
          style={{ transform: 'translateZ(45px)' }}
        >
          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
            <span>Huyết áp & Tim</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-white">{bpDisplay}</span>
            <span className="text-[10px] text-slate-400">mmHg</span>
          </div>
          <div className="text-[10px] text-slate-300 flex items-center gap-1 pt-0.5">
            <Activity className="w-3 h-3 text-teal-400" />
            <span>Nhịp tim: <strong>{hrDisplay} bpm</strong></span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* HUD CHỈ SỐ 3: CÂN NẶNG & BMI (GẮN VÙNG THỂ TRẠNG)            */}
        {/* ============================================================== */}
        <div 
          className="absolute left-10 bottom-6 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-teal-500/50 shadow-2xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105 z-20"
          style={{ transform: 'translateZ(40px)' }}
        >
          <div className="flex items-center gap-1.5 text-teal-300 font-bold text-[11px]">
            <Scale className="w-3.5 h-3.5 text-teal-400" />
            <span>Cân nặng & BMI</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-white">{weightDisplay}</span>
            <span className="text-[10px] text-slate-400">kg</span>
            <span className="text-[11px] text-teal-400 font-bold ml-1">
              (BMI {bmiDisplay})
            </span>
          </div>
          <span className="inline-block text-[9px] font-semibold text-teal-300 bg-teal-950/80 px-1.5 py-0.2 rounded border border-teal-500/30">
            Thể trạng cân đối
          </span>
        </div>

        {/* Hướng dẫn tương tác 3D */}
        <div className="absolute bottom-2 text-center w-full pointer-events-none z-20">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] text-slate-300 border border-white/15 shadow-sm">
            Rê chuột để nghiêng góc 3D
          </span>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="relative z-20 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-teal-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            Phong cách Pixar / Anime 3D
          </span>
        </div>

        {onOpenLogModal && (
          <button
            type="button"
            onClick={onOpenLogModal}
            className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-teal-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ghi chỉ số</span>
          </button>
        )}
      </div>
    </div>
  );
}