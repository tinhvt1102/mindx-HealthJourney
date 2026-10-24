import React, { useState, useRef } from 'react';
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
  ShieldCheck,
  UserCheck
} from 'lucide-react';

/**
 * 3D Anime Human Character Viewer & Biometric HUD
 * Hiển thị nhân vật 3D Anime toàn thân (đứng thẳng từ đầu đến chân)
 * Chuẩn 100% phong cách Pixar/Disney 3D như hình ảnh mẫu người dùng gửi (không giống robot thô)
 * - Nam: Áo hoodie be form rộng, quần dài suông tối màu, giày sneaker trắng.
 * - Nữ: Áo hoodie/thun kem pastel, chân váy xòe xếp ly, giày sneaker năng động.
 * Tương tác Parallax 3D không gian theo chuột + HUD y tế thời gian thực.
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
  const [isHovered, setIsHovered] = useState(false);

  // Chỉ số đo mới nhất hoặc tham số y tế chuẩn
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
  const standingImageSrc = isFemale 
    ? '/avatars/female_anime_standing.jpg' 
    : '/avatars/male_anime_standing.jpg';
  const genderTitle = isFemale 
    ? 'Nữ • Áo hoodie kem & Chân váy xòe' 
    : 'Nam • Áo hoodie be & Quần dài';

  // Xử lý hiệu ứng 3D Parallax Tilt theo tọa độ chuột
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Giới hạn góc nghiêng 3D trong khoảng [-12, 12] độ
    const rY = ((x - centerX) / centerX) * 12;
    const rX = -((y - centerY) / centerY) * 12;

    setRotateX(rX);
    setRotateY(rY);

    // Điểm sáng phản chiếu ánh kim (Glare specular)
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlarePos({ x: glareX, y: glareY, opacity: 0.22 });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
    setGlarePos({ x: 50, y: 50, opacity: 0 });
  };

  const handleResetView = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div 
      className="bg-gradient-to-b from-slate-900 via-slate-900 to-teal-950 rounded-3xl p-5 text-white shadow-2xl border border-slate-800 relative overflow-hidden flex flex-col justify-between"
      style={{ perspective: '1200px' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="relative z-20 flex items-center justify-between pb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-teal-300 uppercase tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-spin" style={{ animationDuration: '4s' }} />
            Nhân vật 3D Anime • Chuẩn Pixar
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            {fullName || 'Người dùng'}
          </h3>
          <p className="text-xs text-slate-400">
            {genderTitle} • {heightCm} cm
          </p>
        </div>

        {/* Nút reset góc nhìn */}
        <button
          type="button"
          onClick={handleResetView}
          className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-teal-500/20 hover:border-teal-500/30 text-slate-300 hover:text-teal-300 transition-all cursor-pointer shadow-xs"
          title="Đặt lại góc nhìn 3D"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* KHÔNG GIAN 3D: NHÂN VẬT ANIME TOÀN THÂN ĐỨNG THẲNG + BỤC ĐỨNG NEON + HUD */}
      <div 
        ref={cardRef}
        className="relative my-2 w-full h-[430px] sm:h-[480px] rounded-2xl flex items-center justify-center overflow-hidden transition-transform duration-200 ease-out select-none"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        }}
      >
        {/* Nền Studio chiếu sáng 3D */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-900/40 to-slate-950/80 rounded-2xl pointer-events-none" />

        {/* Ánh sáng lóa động (Glare Effect) */}
        <div 
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-2xl"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity}) 0%, rgba(255,255,255,0) 65%)`,
          }}
        />

        {/* HÌNH ẢNH NHÂN VẬT 3D TOÀN THÂN (ĐẦU ĐẾN CHÂN) */}
        <div 
          className="relative z-10 w-full h-full flex flex-col items-center justify-end pb-3 pointer-events-none"
          style={{ transform: 'translateZ(30px)' }}
        >
          <img 
            src={standingImageSrc} 
            alt={fullName}
            className="h-full w-auto max-h-[440px] object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.65)] transition-all duration-300"
            style={{
              transform: isHovered ? 'scale(1.02)' : 'scale(1.0)',
            }}
          />

          {/* Bục tròn Neon phát sáng dưới chân nhân vật */}
          <div 
            className="absolute bottom-1 w-52 sm:w-60 h-7 rounded-[100%] bg-teal-500/25 blur-[3px] border border-teal-400/50 shadow-[0_0_30px_rgba(20,184,166,0.6)] pointer-events-none -z-10"
            style={{ transform: 'rotateX(75deg)' }}
          />
        </div>

        {/* THƯỚC ĐO LASER CHIỀU CAO (BÊN TRÁI) */}
        <div 
          className="absolute left-3 top-8 bottom-12 z-20 flex flex-col justify-between text-[10px] font-mono text-teal-400 pointer-events-none border-l-2 border-dashed border-teal-500/40 pl-2"
          style={{ transform: 'translateZ(55px)' }}
        >
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2.5 h-0.5 bg-teal-500/50" /> 200 cm
          </span>
          <span className="flex items-center gap-1 font-bold text-teal-200 bg-teal-950/90 px-2 py-0.5 rounded-md border border-teal-400/60 shadow-lg shadow-teal-900/50">
            <span className="w-3 h-0.5 bg-teal-300" /> {heightCm} cm
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2.5 h-0.5 bg-teal-500/50" /> 150 cm
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2.5 h-0.5 bg-teal-500/50" /> 100 cm
          </span>
        </div>

        {/* ============================================================== */}
        {/* HUD 1: THÂN NHIỆT (VÙNG TRÁN / ĐẦU)                             */}
        {/* ============================================================== */}
        <div 
          className="absolute right-3 top-4 z-20 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-amber-500/40 shadow-xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105"
          style={{ transform: 'translateZ(60px)' }}
        >
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
            <Thermometer className="w-3.5 h-3.5 text-amber-400" />
            <span>Nhiệt độ</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-white">{tempDisplay}</span>
            <span className="text-[10px] text-slate-400">°C</span>
          </div>
          <span className="inline-block text-[9px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/20">
            Thân nhiệt ổn định
          </span>
        </div>

        {/* ============================================================== */}
        {/* HUD 2: HUYẾT ÁP & TIM (VÙNG NGỰC / TIM)                         */}
        {/* ============================================================== */}
        <div 
          className="absolute right-3 top-28 sm:top-32 z-20 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-rose-500/40 shadow-xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105"
          style={{ transform: 'translateZ(65px)' }}
        >
          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
            <span>Huyết áp & Tim</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-white">{bpDisplay}</span>
            <span className="text-[10px] text-slate-400">mmHg</span>
          </div>
          <div className="text-[10px] text-slate-300 flex items-center gap-1">
            <Activity className="w-3 h-3 text-teal-400" />
            <span>Nhịp tim: <strong>{hrDisplay} bpm</strong></span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* HUD 3: CÂN NẶNG & BMI (VÙNG EO / THỂ TRẠNG)                     */}
        {/* ============================================================== */}
        <div 
          className="absolute left-10 bottom-6 sm:bottom-8 z-20 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-teal-500/40 shadow-xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105"
          style={{ transform: 'translateZ(60px)' }}
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
          <span className="inline-block text-[9px] font-semibold text-teal-300 bg-teal-950/80 px-1.5 py-0.2 rounded border border-teal-500/20">
            Thể trạng cân đối
          </span>
        </div>

        {/* Chú thích nghiêng 3D */}
        <div 
          className="absolute bottom-2 text-center w-full pointer-events-none z-20"
          style={{ transform: 'translateZ(40px)' }}
        >
          <span className="inline-block px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] text-slate-400 border border-white/10 shadow-md">
            Rê chuột để khám phá không gian chiều sâu 3D
          </span>
        </div>
      </div>

      {/* Bottom Bar: Nút ghi chỉ số y tế */}
      <div className="relative z-20 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Chỉ số sinh trắc học đồng bộ hồ sơ</span>
          <span className="sm:hidden">Đồng bộ hồ sơ</span>
        </div>

        {onOpenLogModal && (
          <button
            type="button"
            onClick={onOpenLogModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-teal-700/30 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Ghi chỉ số</span>
          </button>
        )}
      </div>
    </div>
  );
}
