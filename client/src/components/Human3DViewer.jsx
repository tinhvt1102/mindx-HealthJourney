import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  RotateCw, 
  Sparkles, 
  Activity, 
  Heart, 
  Thermometer, 
  Scale, 
  Flame, 
  Plus, 
  ChevronRight,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

/**
 * 3D Human Anatomy Avatar (Three.js WebGL)
 * Hiển thị hình dáng người Nam / Nữ thực thụ (Organic Human Character)
 * Kèm HUD hiển thị trực quan: Nhiệt độ, Huyết áp, Nhịp tim, Cân nặng & BMI
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

  // References cho Three.js
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const humanGroupRef = useRef(null);
  const heartMeshRef = useRef(null);
  const heartLightRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  // Trích xuất các chỉ số mới nhất (nếu có từ nhật ký hoặc dùng giá trị tham chiếu)
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

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0.85, 3.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Hệ thống ánh sáng Studio
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
    mainLight.position.set(3, 8, 5);
    scene.add(mainLight);

    const backRimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    backRimLight.position.set(-4, 5, -4);
    scene.add(backRimLight);

    const warmFill = new THREE.PointLight(0xffedd5, 0.8, 8);
    warmFill.position.set(2, 0, 3);
    scene.add(warmFill);

    // Bục đứng phát sáng (Circular Hologram Pedestal)
    const pedestalGeo = new THREE.CylinderGeometry(0.65, 0.75, 0.06, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.8,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.92;
    scene.add(pedestal);

    const ringGeo = new THREE.RingGeometry(0.68, 0.74, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0d9488,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.88;
    scene.add(ring);

    // Grid sàn mờ tinh tế
    const grid = new THREE.GridHelper(3.5, 14, 0x0d9488, 0x1e293b);
    grid.position.y = -0.93;
    scene.add(grid);

    // Khởi tạo nhóm người 3D
    const humanGroup = new THREE.Group();
    scene.add(humanGroup);
    humanGroupRef.current = humanGroup;

    // Dựng hình người 3D Nam / Nữ thực thụ
    buildHumanModel(humanGroup, gender, heightCm);

    // Xử lý sự kiện kéo xoay chuột / chạm
    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current || !humanGroupRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      humanGroupRef.current.rotation.y += deltaX * 0.01;
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
      humanGroupRef.current.rotation.y += deltaX * 0.01;
      previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('touchstart', handleTouchStart);
    dom.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    // Vòng lặp Render & Animation
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Tự động xoay người nhẹ nhàng
      if (isAutoRotating && !isDraggingRef.current && humanGroupRef.current) {
        humanGroupRef.current.rotation.y += 0.006;
      }

      // Trái tim đập phát sáng nhịp nhàng
      if (heartMeshRef.current && heartLightRef.current) {
        const pulse = Math.sin(elapsed * 4.2) * 0.5 + 0.5;
        const scale = 1 + pulse * 0.28;
        heartMeshRef.current.scale.set(scale, scale, scale);
        heartLightRef.current.intensity = 1.0 + pulse * 1.6;
      }

      // Nhịp thở ngực nhẹ nhàng
      if (humanGroupRef.current) {
        humanGroupRef.current.position.y = Math.sin(elapsed * 1.6) * 0.012;
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
  }, []);

  // Cập nhật khi Giới tính hoặc Chiều cao thay đổi
  useEffect(() => {
    if (humanGroupRef.current) {
      buildHumanModel(humanGroupRef.current, gender, heightCm);
    }
  }, [gender, heightCm]);

  // Xây dựng mô hình 3D người thật (Nam / Nữ) với vóc dáng, tóc và trang phục thể thao
  const buildHumanModel = (group, userGender, userHeight) => {
    // Dọn dẹp mesh cũ
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    }

    const isFemale = userGender === 'FEMALE';

    // Bảng màu & vật liệu da người thật (Realistic Warm Skin Tone)
    const skinTone = isFemale ? 0xfcd5b5 : 0xf2be96;
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: skinTone,
      roughness: 0.55,
      metalness: 0.05,
    });

    // Màu tóc
    const hairColor = isFemale ? 0x271911 : 0x1e293b;
    const hairMaterial = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.7,
      metalness: 0.1,
    });

    // Trang phục thể thao (Fitness Sportswear)
    // Nam: Áo thể thao Teal đậm + Quần thể thao Charcoal
    // Nữ: Áo thể thao Nữ Hồng/Magenta + Quần legging Indigo thon gọn
    const topColor = isFemale ? 0xdb2777 : 0x0f766e;
    const bottomColor = isFemale ? 0x1e1b4b : 0x334155;

    const shirtMaterial = new THREE.MeshStandardMaterial({
      color: topColor,
      roughness: 0.65,
      metalness: 0.1,
    });

    const pantsMaterial = new THREE.MeshStandardMaterial({
      color: bottomColor,
      roughness: 0.6,
      metalness: 0.1,
    });

    const shoesMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.2,
    });

    // Tỷ lệ khung người (Nam vai rộng chữ V, Nữ eo thon hông nở)
    const shoulderWidth = isFemale ? 0.36 : 0.46;
    const chestWidth = isFemale ? 0.32 : 0.40;
    const waistWidth = isFemale ? 0.22 : 0.30;
    const hipWidth = isFemale ? 0.36 : 0.32;

    // Co dãn tỷ lệ chiều cao theo cm thực tế
    const heightRatio = Math.max(0.7, Math.min(1.4, (userHeight || 170) / 170));
    group.scale.set(heightRatio, heightRatio, heightRatio);

    // ==========================================
    // 1. ĐẦU VÀ KHUÔN MẶT (Head & Face)
    // ==========================================
    const headGeo = new THREE.SphereGeometry(0.125, 32, 24);
    headGeo.scale(1, 1.25, 1.05);
    const head = new THREE.Mesh(headGeo, skinMaterial);
    head.position.y = 1.35;
    group.add(head);

    // Mắt / Kính thể thao phong cách y tế
    const eyeBandGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 24, 1, false, 0, Math.PI);
    const eyeBandMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.2,
      metalness: 0.8,
    });
    const eyeBand = new THREE.Mesh(eyeBandGeo, eyeBandMat);
    eyeBand.rotation.y = Math.PI / 2;
    eyeBand.position.set(0, 1.36, 0.04);
    group.add(eyeBand);

    // ==========================================
    // 2. TÓC THẬT (Realistic Hair Styling)
    // ==========================================
    if (isFemale) {
      // Tóc Nữ: Mái vòm tự nhiên + Đuôi ngựa (Ponytail)
      const femaleHairGeo = new THREE.SphereGeometry(0.138, 24, 16);
      femaleHairGeo.scale(1.02, 1.2, 1.15);
      const femaleHair = new THREE.Mesh(femaleHairGeo, hairMaterial);
      femaleHair.position.set(0, 1.38, -0.02);
      group.add(femaleHair);

      // Đuôi tóc cột cao (Ponytail)
      const ponytailGeo = new THREE.CylinderGeometry(0.04, 0.015, 0.35, 16);
      const ponytail = new THREE.Mesh(ponytailGeo, hairMaterial);
      ponytail.rotation.x = 0.45;
      ponytail.position.set(0, 1.32, -0.16);
      group.add(ponytail);

      // Dây cột tóc màu hồng
      const tieGeo = new THREE.TorusGeometry(0.04, 0.015, 12, 24);
      const tieMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
      const tie = new THREE.Mesh(tieGeo, tieMat);
      tie.rotation.x = Math.PI / 3;
      tie.position.set(0, 1.42, -0.12);
      group.add(tie);
    } else {
      // Tóc Nam: Tóc vuốt ngắn thời trang, ôm gọn theo hộp sọ
      const maleHairGeo = new THREE.SphereGeometry(0.135, 24, 16);
      maleHairGeo.scale(1.04, 1.18, 1.08);
      const maleHair = new THREE.Mesh(maleHairGeo, hairMaterial);
      maleHair.position.set(0, 1.41, -0.01);
      group.add(maleHair);
    }

    // ==========================================
    // 3. CỔ (Neck)
    // ==========================================
    const neckGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.1, 16);
    const neck = new THREE.Mesh(neckGeo, skinMaterial);
    neck.position.y = 1.19;
    group.add(neck);

    // ==========================================
    // 4. THÂN TRÊN & ÁO THỂ THAO (Upper Torso & Shirt)
    // ==========================================
    const torsoGeo = new THREE.CylinderGeometry(
      chestWidth / 2,
      waistWidth / 2,
      0.34,
      24
    );
    torsoGeo.scale(1, 1, 0.85);
    const torso = new THREE.Mesh(torsoGeo, shirtMaterial);
    torso.position.y = 0.98;
    group.add(torso);

    // Riêng Nữ: Chi tiết vòng 1 đường cong thanh thoát
    if (isFemale) {
      [-0.065, 0.065].forEach((offset) => {
        const bustGeo = new THREE.SphereGeometry(0.065, 16, 16);
        const bust = new THREE.Mesh(bustGeo, shirtMaterial);
        bust.position.set(offset, 1.02, 0.09);
        group.add(bust);
      });
    }

    // ==========================================
    // 5. TRÁI TIM PHÁT SÁNG NHỊP ĐẬP (Pulsing Heart)
    // ==========================================
    const heartGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.position.set(0.05, 1.04, 0.1);
    group.add(heartMesh);
    heartMeshRef.current = heartMesh;

    const heartLight = new THREE.PointLight(0xff1744, 2.0, 1.2);
    heartLight.position.set(0.05, 1.04, 0.14);
    group.add(heartLight);
    heartLightRef.current = heartLight;

    // ==========================================
    // 6. THÂN DƯỚI & QUẦN (Pelvis & Pants/Leggings)
    // ==========================================
    const pelvisGeo = new THREE.CylinderGeometry(
      waistWidth / 2,
      hipWidth / 2,
      0.22,
      24
    );
    const pelvis = new THREE.Mesh(pelvisGeo, pantsMaterial);
    pelvis.position.y = 0.72;
    group.add(pelvis);

    const hipsGeo = new THREE.SphereGeometry(hipWidth / 2, 24, 16);
    hipsGeo.scale(1, 0.65, 0.85);
    const hips = new THREE.Mesh(hipsGeo, pantsMaterial);
    hips.position.y = 0.62;
    group.add(hips);

    // ==========================================
    // 7. CÁNH TAY & BÀN TAY (Organic Arms & Hands)
    // ==========================================
    [-1, 1].forEach((side) => {
      // Ống tay áo (Shirt Sleeve)
      const sleeveGeo = new THREE.CylinderGeometry(0.058, 0.052, 0.12, 16);
      const sleeve = new THREE.Mesh(sleeveGeo, shirtMaterial);
      sleeve.position.set(side * (shoulderWidth / 2 + 0.03), 1.08, 0);
      sleeve.rotation.z = side * -0.2;
      group.add(sleeve);

      // Cánh tay da (Arm)
      const armGeo = new THREE.CylinderGeometry(0.046, 0.036, 0.42, 16);
      const arm = new THREE.Mesh(armGeo, skinMaterial);
      arm.position.set(side * (shoulderWidth / 2 + 0.07), 0.82, 0.02);
      arm.rotation.z = side * -0.16;
      group.add(arm);

      // Bàn tay (Hand)
      const handGeo = new THREE.SphereGeometry(0.04, 16, 16);
      handGeo.scale(0.8, 1.2, 0.5);
      const hand = new THREE.Mesh(handGeo, skinMaterial);
      hand.position.set(side * (shoulderWidth / 2 + 0.1), 0.56, 0.04);
      group.add(hand);
    });

    // ==========================================
    // 8. ĐÔI CHÂN & GIÀY THỂ THAO (Legs & Athletic Sneakers)
    // ==========================================
    [-1, 1].forEach((side) => {
      const legX = side * (hipWidth / 3.4);

      // Chân quần (Pants Leg)
      const legGeo = new THREE.CylinderGeometry(0.07, 0.045, 0.95, 16);
      const leg = new THREE.Mesh(legGeo, pantsMaterial);
      leg.position.set(legX, 0.12, 0);
      group.add(leg);

      // Giày thể thao (Sneaker)
      const shoeGeo = new THREE.BoxGeometry(0.08, 0.07, 0.18);
      const shoe = new THREE.Mesh(shoeGeo, shoesMaterial);
      shoe.position.set(legX, -0.38, 0.03);
      group.add(shoe);
    });
  };

  // Điều khiển góc nhìn
  const handleResetView = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = 0;
  };
  const handleTurnBack = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = Math.PI;
  };

  const isFemale = gender === 'FEMALE';
  const genderTitle = isFemale ? 'Nữ giới' : 'Nam giới';

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-teal-950 rounded-3xl p-5 text-white shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Top Header Card */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-teal-400" />
            Nhân trắc học 3D
          </div>
          <h3 className="text-base font-bold text-white mt-1">
            {fullName || 'Người dùng'}
          </h3>
          <p className="text-xs text-slate-400">
            Dáng người {genderTitle} • {heightCm} cm
          </p>
        </div>

        {/* Nút bật/tắt tự xoay */}
        <button
          type="button"
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            isAutoRotating
              ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
          }`}
          title={isAutoRotating ? 'Dừng tự động xoay' : 'Bật tự động xoay'}
        >
          <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
        </button>
      </div>

      {/* 3D WebGL Canvas Container + HUD CHỈ SỐ Y TẾ GẮN TRỰC DIỆN */}
      <div className="relative my-2 w-full h-[400px] sm:h-[450px] flex items-center justify-center cursor-grab active:cursor-grabbing">
        <div ref={mountRef} className="w-full h-full" />

        {/* Thước đo Laser chiều cao bên trái */}
        <div className="absolute left-2 top-10 bottom-14 flex flex-col justify-between text-[10px] font-mono text-teal-400/80 pointer-events-none border-l border-teal-500/30 pl-1.5">
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 200 cm
          </span>
          <span className="flex items-center gap-1 font-bold text-teal-300 bg-teal-950/70 px-1 py-0.2 rounded border border-teal-500/40">
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
        {/* HUD CHỈ SỐ 1: NHIỆT ĐỘ THÂN THỂ (GẮN Ở VÙNG TRÁN / ĐẦU)      */}
        {/* ============================================================== */}
        <div className="absolute right-3 top-6 p-2.5 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-orange-500/30 shadow-lg text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105">
          <div className="flex items-center gap-1.5 text-orange-400 font-bold text-[11px]">
            <Thermometer className="w-3.5 h-3.5 text-orange-400" />
            <span>Thân nhiệt</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-white">{tempDisplay}</span>
            <span className="text-[10px] text-slate-400">°C</span>
          </div>
          <span className="inline-block text-[9px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded">
            Bình thường
          </span>
        </div>

        {/* ============================================================== */}
        {/* HUD CHỈ SỐ 2: HUYẾT ÁP & NHỊP TIM (GẮN Ở VÙNG LỒNG NGỰC/TIM)  */}
        {/* ============================================================== */}
        <div className="absolute right-3 top-32 p-2.5 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-rose-500/30 shadow-lg text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105">
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
        {/* HUD CHỈ SỐ 3: CÂN NẶNG & CHỈ SỐ BMI (GẮN Ở VÙNG EO/THỂ TRẠNG) */}
        {/* ============================================================== */}
        <div className="absolute left-10 bottom-12 p-2.5 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-teal-500/30 shadow-lg text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105">
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
          <span className="inline-block text-[9px] font-semibold text-teal-300 bg-teal-950/80 px-1.5 py-0.2 rounded">
            Thể trạng cân đối
          </span>
        </div>

        {/* Chỉ dẫn xoay chuột */}
        <div className="absolute bottom-2 text-center w-full pointer-events-none">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] text-slate-400 border border-white/10">
            Kéo chuột để xoay 360°
          </span>
        </div>
      </div>

      {/* Bottom Bar: Nút xoay & Gọi Modal ghi chỉ số */}
      <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
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

        {onOpenLogModal && (
          <button
            type="button"
            onClick={onOpenLogModal}
            className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ghi chỉ số</span>
          </button>
        )}
      </div>
    </div>
  );
}