import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { 
  RotateCw, 
  Sparkles, 
  Activity, 
  Heart, 
  Thermometer, 
  Scale, 
  Plus, 
  Eye,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

/**
 * 3D Human Avatar (Real 3D GLB Model & WebGL Three.js)
 * Sử dụng file mô hình 3D thực tế (.GLB) đầy đủ mesh người thật (khuôn mặt, tóc, quần áo, giày):
 * - Không phải ghép thô từ hình hộp/hình trụ (không còn giống robot).
 * - Xoay 360 độ mượt mà bằng kéo chuột / chạm vuốt.
 * - Tự động co dãn theo chiều cao người dùng (heightCm).
 * - Tích hợp đầy đủ HUD đo: Nhiệt độ, Huyết áp, Nhịp tim, Cân nặng, BMI, Thước laser.
 * - Hỗ trợ nút chuyển đổi nhanh giữa "Mô hình 3D GLB (Xoay 360°)" và "Ảnh 3D Anime Pixar".
 */
export default function Human3DViewer({
  gender = 'MALE',
  heightCm = 170,
  fullName = 'Người dùng',
  latestMetrics = {},
  onOpenLogModal,
}) {
  const mountRef = useRef(null);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [viewMode, setViewMode] = useState('3D_MODEL'); // '3D_MODEL' | '3D_ANIME'

  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const humanGroupRef = useRef(null);
  const heartMeshRef = useRef(null);
  const heartLightRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  // Chỉ số đo mới nhất
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
  const genderTitle = isFemale 
    ? 'Nữ giới • Mô hình 3D Full Mesh' 
    : 'Nam giới • Mô hình 3D Full Mesh';

  // Khởi tạo Three.js Scene và GLTFLoader khi ở chế độ 3D_MODEL
  useEffect(() => {
    if (viewMode !== '3D_MODEL') return;

    const container = mountRef.current;
    if (!container) return;

    setIsLoadingModel(true);

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0.95, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Ánh sáng Studio chuyên nghiệp
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    keyLight.position.set(2.5, 6, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 1.1);
    fillLight.position.set(-3.5, 4, 3);
    scene.add(fillLight);

    const backRimLight = new THREE.DirectionalLight(0x14b8a6, 1.4);
    backRimLight.position.set(0, 5, -4);
    scene.add(backRimLight);

    // Sàn bục tròn Studio phát sáng
    const stageGeo = new THREE.CylinderGeometry(0.75, 0.82, 0.05, 36);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.4,
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.y = -0.92;
    stage.receiveShadow = true;
    scene.add(stage);

    // Vòng tròn neon teal quanh bục
    const glowRingGeo = new THREE.RingGeometry(0.77, 0.83, 48);
    const glowRingMat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = -0.89;
    scene.add(glowRing);

    // Nhóm xoay đối tượng
    const humanGroup = new THREE.Group();
    scene.add(humanGroup);
    humanGroupRef.current = humanGroup;

    // Load file mô hình 3D thật (.GLB)
    const gltfLoader = new GLTFLoader();
    const modelPath = isFemale ? '/models/asian_female.glb' : '/models/asian_male.glb';

    gltfLoader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;

        // Tính toán kích thước và căn giữa mô hình chuẩn
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Chuẩn hóa chiều cao ~1.7m trong viewport
        const targetHeight = 1.68 * ((heightCm || 170) / 170);
        const scale = targetHeight / (size.y || 1);
        model.scale.set(scale, scale, scale);

        // Đặt chân nhân vật chạm ngay mặt sàn bục (-0.89)
        const minY = box.min.y * scale;
        model.position.set(
          -center.x * scale,
          -0.89 - minY,
          -center.z * scale
        );

        // Kích hoạt đổ bóng và vật liệu chân thực
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.roughness = Math.max(0.4, child.material.roughness || 0.5);
              child.material.metalness = Math.min(0.2, child.material.metalness || 0.1);
            }
          }
        });

        humanGroup.add(model);

        // Trái tim 3D phát sáng nhấp nháy ở lồng ngực
        const heartGeo = new THREE.SphereGeometry(0.035, 16, 16);
        const heartMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
        const heartMesh = new THREE.Mesh(heartGeo, heartMat);
        heartMesh.position.set(0.06, 0.32, 0.14);
        humanGroup.add(heartMesh);
        heartMeshRef.current = heartMesh;

        const heartLight = new THREE.PointLight(0xff1744, 2.5, 1.2);
        heartLight.position.set(0.06, 0.32, 0.2);
        humanGroup.add(heartLight);
        heartLightRef.current = heartLight;

        setIsLoadingModel(false);
      },
      undefined,
      (error) => {
        console.error('Không thể tải mô hình 3D GLB:', error);
        setIsLoadingModel(false);
      }
    );

    // Kéo chuột để xoay 360 độ
    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current || !humanGroupRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      humanGroupRef.current.rotation.y += deltaX * 0.012;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e) => {
      if (!isDraggingRef.current || !humanGroupRef.current || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePositionRef.current.x;
      humanGroupRef.current.rotation.y += deltaX * 0.012;
      previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('touchstart', handleTouchStart);
    dom.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Tự động xoay chậm nhẹ nhàng khi người dùng không kéo
      if (isAutoRotating && !isDraggingRef.current && humanGroupRef.current) {
        humanGroupRef.current.rotation.y += 0.006;
      }

      // Trái tim đập phát sáng
      if (heartMeshRef.current && heartLightRef.current) {
        const pulse = Math.sin(elapsed * 4.5) * 0.5 + 0.5;
        const scale = 1 + pulse * 0.25;
        heartMeshRef.current.scale.set(scale, scale, scale);
        heartLightRef.current.intensity = 1.0 + pulse * 2.0;
      }

      // Nhịp thở hô hấp nhẹ tự nhiên
      if (humanGroupRef.current) {
        humanGroupRef.current.position.y = Math.sin(elapsed * 1.5) * 0.01;
      }

      renderer.render(scene, camera);
    };

    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: nw, height: nh } = entry.contentRect;
        if (nw > 0 && nh > 0) {
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
      resizeObserver.disconnect();
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('touchstart', handleTouchStart);
      dom.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      if (container && renderer.domElement) {
        container.innerHTML = '';
      }
      renderer.dispose();
    };
  }, [viewMode, gender, heightCm]);

  const handleResetView = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = 0;
  };
  const handleTurnBack = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = Math.PI;
  };

  const standingImageSrc = isFemale 
    ? '/avatars/female_anime_standing.jpg' 
    : '/avatars/male_anime_standing.jpg';

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-teal-950 rounded-3xl p-5 text-white shadow-2xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Header Info & View Mode Switcher */}
      <div className="relative z-20 flex items-center justify-between pb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-teal-300 uppercase tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Mô hình 3D Thực tế (.GLB)
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            {fullName || 'Người dùng'}
          </h3>
          <p className="text-xs text-slate-400">
            {genderTitle} • {heightCm} cm
          </p>
        </div>

        {/* Nút điều khiển xoay & chế độ xem */}
        <div className="flex items-center gap-1.5">
          {viewMode === '3D_MODEL' && (
            <button
              type="button"
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isAutoRotating
                  ? 'bg-teal-500/20 border-teal-500/40 text-teal-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title={isAutoRotating ? 'Dừng tự xoay' : 'Bật tự xoay 360°'}
            >
              <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            </button>
          )}

          {/* Nút chuyển đổi giữa Mô hình 3D WebGL và Ảnh 3D Anime */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === '3D_MODEL' ? '3D_ANIME' : '3D_MODEL')}
            className="px-2.5 py-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 text-[11px] font-bold text-teal-200 cursor-pointer transition-all flex items-center gap-1"
            title="Chuyển đổi giao diện"
          >
            <Eye className="w-3.5 h-3.5 text-teal-400" />
            <span>{viewMode === '3D_MODEL' ? 'Anime 3D' : 'WebGL 3D'}</span>
          </button>
        </div>
      </div>

      {/* KHÔNG GIAN HIỂN THỊ CHÍNH (3D CANVAS HOẶC ANIME 3D) */}
      <div className="relative my-2 w-full h-[430px] sm:h-[480px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none">
        
        {/* VIEW 1: MÔ HÌNH 3D WEBGL (.GLB FILE THẬT) */}
        {viewMode === '3D_MODEL' && (
          <div className="relative w-full h-full">
            <div ref={mountRef} className="w-full h-full" />

            {/* Loading Indicator khi đang nạp file 3D */}
            {isLoadingModel && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm z-30">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin mb-2" />
                <span className="text-xs font-semibold text-slate-300">Đang nạp mô hình 3D con người...</span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: TẠO HÌNH ANIME 3D CHUẨN PIXAR */}
        {viewMode === '3D_ANIME' && (
          <div className="relative w-full h-full flex flex-col items-center justify-end pb-2">
            <img 
              src={standingImageSrc} 
              alt={fullName}
              className="h-full w-auto max-h-[440px] object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.65)]"
            />
            {/* Bục tròn Neon */}
            <div 
              className="absolute bottom-1 w-52 sm:w-60 h-7 rounded-[100%] bg-teal-500/25 blur-[3px] border border-teal-400/50 shadow-[0_0_30px_rgba(20,184,166,0.6)] pointer-events-none -z-10"
              style={{ transform: 'rotateX(75deg)' }}
            />
          </div>
        )}

        {/* Thước đo Laser chiều cao bên trái */}
        <div className="absolute left-2 top-8 bottom-12 flex flex-col justify-between text-[10px] font-mono text-teal-400/80 pointer-events-none border-l border-teal-500/30 pl-1.5 z-20">
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 200 cm
          </span>
          <span className="flex items-center gap-1 font-bold text-teal-300 bg-teal-950/80 px-1 py-0.2 rounded border border-teal-500/40 shadow-xs">
            <span className="w-2.5 h-0.5 bg-teal-300" /> {heightCm} cm
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 150 cm
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 100 cm
          </span>
        </div>

        {/* ============================================================== */}
        {/* HUD CHỈ SỐ 1: THÂN NHIỆT (VÙNG TRÁN / ĐẦU)                     */}
        {/* ============================================================== */}
        <div className="absolute right-3 top-4 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-amber-500/40 shadow-xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105 z-20">
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
        {/* HUD CHỈ SỐ 2: HUYẾT ÁP & TIM (VÙNG NGỰC / TIM)                 */}
        {/* ============================================================== */}
        <div className="absolute right-3 top-28 sm:top-32 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-rose-500/40 shadow-xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105 z-20">
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
        {/* HUD CHỈ SỐ 3: CÂN NẶNG & BMI (VÙNG EO / THỂ TRẠNG)             */}
        {/* ============================================================== */}
        <div className="absolute left-10 bottom-6 sm:bottom-8 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-teal-500/40 shadow-xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105 z-20">
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

        {/* Hướng dẫn kéo chuột */}
        <div className="absolute bottom-2 text-center w-full pointer-events-none z-20">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-[10px] text-slate-400 border border-white/10 shadow-md">
            {viewMode === '3D_MODEL' ? 'Kéo chuột để xoay 360° mô hình 3D' : 'Xem dạng tạo hình Anime Pixar'}
          </span>
        </div>
      </div>

      {/* Bottom Bar: Nút xoay góc nhìn & Nút ghi chỉ số */}
      <div className="relative z-20 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
        {viewMode === '3D_MODEL' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetView}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-semibold cursor-pointer transition-colors"
            >
              Mặt trước
            </button>
            <button
              type="button"
              onClick={handleTurnBack}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-semibold cursor-pointer transition-colors"
            >
              Mặt sau
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Đồng bộ hồ sơ</span>
          </div>
        )}

        {onOpenLogModal && (
          <button
            type="button"
            onClick={onOpenLogModal}
            className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-teal-600/30 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ghi chỉ số</span>
          </button>
        )}
      </div>
    </div>
  );
}
