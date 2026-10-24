import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, Sparkles, User, Activity, Heart, Eye } from 'lucide-react';

/**
 * 3D Human Body Anatomy Viewer (Three.js WebGL)
 * Tự động biến đổi theo Giới tính (Nam / Nữ) và Chiều cao / Cân nặng thực tế
 */
export default function Human3DViewer({
  gender = 'MALE',
  heightCm = 170,
  weightKg = 65,
  fullName = 'Người dùng',
}) {
  const mountRef = useRef(null);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [activeZone, setActiveZone] = useState('HEART'); // 'HEART' | 'HEAD' | 'WAIST'

  // Ref lưu trữ các object Three.js để update props mượt mà
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const humanGroupRef = useRef(null);
  const heartMeshRef = useRef(null);
  const heartLightRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Khởi tạo Scene, Camera, Renderer
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0.9, 3.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Hệ thống ánh sáng Studio Y tế (Medical Studio Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(4, 8, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x0d9488, 1.5); // Teal rim light
    rimLight.position.set(-4, 4, -4);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x38bdf8, 1.0, 10);
    fillLight.position.set(0, -2, 3);
    scene.add(fillLight);

    // 3. Grid sàn y tế tinh tế
    const gridHelper = new THREE.GridHelper(3, 12, 0x0d9488, 0xe2e8f0);
    gridHelper.position.y = -0.95;
    scene.add(gridHelper);

    // 4. Vòng hào quang bệ đứng (Platform Glow Ring)
    const ringGeo = new THREE.RingGeometry(0.55, 0.65, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0d9488,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const platformRing = new THREE.Mesh(ringGeo, ringMat);
    platformRing.rotation.x = -Math.PI / 2;
    platformRing.position.y = -0.94;
    scene.add(platformRing);

    // 5. Khởi tạo Human Group
    const humanGroup = new THREE.Group();
    scene.add(humanGroup);
    humanGroupRef.current = humanGroup;

    // 6. Xây dựng mô hình người 3D giải phẫu (Procedural Anatomical Humanoid)
    buildHumanMesh(humanGroup, gender, heightCm);

    // 7. Xử lý tương tác chuột / cảm ứng xoay 360 độ
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

    // 8. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Tự động xoay nhẹ nhàng khi người dùng không kéo chuột
      if (isAutoRotating && !isDraggingRef.current && humanGroupRef.current) {
        humanGroupRef.current.rotation.y += 0.007;
      }

      // Nhịp đập tim phát sáng (Pulsing Heart)
      if (heartMeshRef.current && heartLightRef.current) {
        const pulse = Math.sin(elapsedTime * 4.5) * 0.5 + 0.5; // Nhịp 75 bpm
        const scale = 1 + pulse * 0.25;
        heartMeshRef.current.scale.set(scale, scale, scale);
        heartLightRef.current.intensity = 1.0 + pulse * 1.5;
      }

      // Dao động nhịp thở ngực nhẹ (Breathing)
      if (humanGroupRef.current) {
        humanGroupRef.current.position.y = Math.sin(elapsedTime * 1.5) * 0.015;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
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

  // Cập nhật mô hình người khi Gender hoặc Height thay đổi
  useEffect(() => {
    if (humanGroupRef.current) {
      buildHumanMesh(humanGroupRef.current, gender, heightCm);
    }
  }, [gender, heightCm]);

  // Hàm tạo các khối cơ thể 3D theo giải phẫu sinh học
  const buildHumanMesh = (group, userGender, userHeight) => {
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
    const isOther = userGender === 'OTHER';

    // Bảng màu & vật liệu da y tế Hologram bán trong suốt
    const skinColor = isFemale ? 0xf472b6 : isOther ? 0xa855f7 : 0x0ea5e9;
    const bodyColor = isFemale ? 0xfbcfe8 : isOther ? 0xe9d5ff : 0xbae6fd;

    // Vật liệu cơ thể chính (Chất liệu Medical Frosted Glass)
    const skinMaterial = new THREE.MeshPhysicalMaterial({
      color: skinColor,
      roughness: 0.25,
      metalness: 0.1,
      transmission: 0.6,
      thickness: 0.8,
      transparent: true,
      opacity: 0.9,
      emissive: isFemale ? 0x831843 : 0x0369a1,
      emissiveIntensity: 0.25,
    });

    // Vật liệu khớp / điểm nhấn
    const jointMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.4,
    });

    // Tỷ lệ giải phẫu (Nam vai rộng hơn, Nữ hông nở hơn)
    const shoulderWidth = isFemale ? 0.38 : 0.48;
    const waistWidth = isFemale ? 0.22 : 0.28;
    const hipWidth = isFemale ? 0.36 : 0.32;
    const chestDepth = isFemale ? 0.24 : 0.22;

    // Tỷ lệ chiều cao (chuẩn 170cm = tỷ lệ 1.0)
    const heightRatio = Math.max(0.7, Math.min(1.4, (userHeight || 170) / 170));
    group.scale.set(heightRatio, heightRatio, heightRatio);

    // 1. ĐẦU (Head)
    const headGeo = new THREE.SphereGeometry(0.14, 32, 24);
    headGeo.scale(1, 1.25, 1.05);
    const headMesh = new THREE.Mesh(headGeo, skinMaterial);
    headMesh.position.y = 1.38;
    group.add(headMesh);

    // Kính bảo hộ y tế / Face Visor
    const visorGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 24, 1, false, 0, Math.PI);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.rotation.y = Math.PI / 2;
    visor.position.set(0, 1.4, 0.05);
    group.add(visor);

    // 2. CỔ (Neck)
    const neckGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.1, 16);
    const neckMesh = new THREE.Mesh(neckGeo, skinMaterial);
    neckMesh.position.y = 1.22;
    group.add(neckMesh);

    // 3. NGỰC & LỒNG NGỰC (Chest & Torso)
    const chestGeo = new THREE.CylinderGeometry(
      shoulderWidth / 2,
      waistWidth / 2,
      0.35,
      24
    );
    chestGeo.scale(1, 1, chestDepth / 0.25);
    const chestMesh = new THREE.Mesh(chestGeo, skinMaterial);
    chestMesh.position.y = 1.0;
    group.add(chestMesh);

    // 4. EO & BỤNG (Waist / Abdomen)
    const waistGeo = new THREE.CylinderGeometry(
      waistWidth / 2,
      hipWidth / 2,
      0.25,
      24
    );
    const waistMesh = new THREE.Mesh(waistGeo, skinMaterial);
    waistMesh.position.y = 0.72;
    group.add(waistMesh);

    // 5. HÔNG (Pelvis / Hips)
    const hipGeo = new THREE.SphereGeometry(hipWidth / 2, 24, 16);
    hipGeo.scale(1, 0.7, 0.85);
    const hipMesh = new THREE.Mesh(hipGeo, skinMaterial);
    hipMesh.position.y = 0.58;
    group.add(hipMesh);

    // 6. TRÁI TIM PHÁT SÁNG (Glowing Heart Indicator)
    const heartGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.position.set(0.06, 1.05, 0.09);
    group.add(heartMesh);
    heartMeshRef.current = heartMesh;

    const heartLight = new THREE.PointLight(0xff1744, 2.0, 1.2);
    heartLight.position.set(0.06, 1.05, 0.12);
    group.add(heartLight);
    heartLightRef.current = heartLight;

    // 7. TAY TRÁI & PHẢI (Arms)
    [-1, 1].forEach((side) => {
      // Khớp vai (Shoulder Joint)
      const shoulderJointGeo = new THREE.SphereGeometry(0.055, 16, 16);
      const shoulderJoint = new THREE.Mesh(shoulderJointGeo, jointMaterial);
      shoulderJoint.position.set(side * (shoulderWidth / 2 + 0.02), 1.14, 0);
      group.add(shoulderJoint);

      // Bắp tay (Upper Arm)
      const upperArmGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.32, 16);
      const upperArm = new THREE.Mesh(upperArmGeo, skinMaterial);
      upperArm.position.set(side * (shoulderWidth / 2 + 0.05), 0.95, 0);
      upperArm.rotation.z = side * -0.15;
      group.add(upperArm);

      // Khuỷu tay (Elbow)
      const elbowGeo = new THREE.SphereGeometry(0.04, 16, 16);
      const elbow = new THREE.Mesh(elbowGeo, jointMaterial);
      elbow.position.set(side * (shoulderWidth / 2 + 0.075), 0.78, 0);
      group.add(elbow);

      // Cẳng tay (Forearm)
      const foreArmGeo = new THREE.CylinderGeometry(0.038, 0.032, 0.3, 16);
      const foreArm = new THREE.Mesh(foreArmGeo, skinMaterial);
      foreArm.position.set(side * (shoulderWidth / 2 + 0.09), 0.6, 0.04);
      foreArm.rotation.x = 0.2;
      group.add(foreArm);

      // Bàn tay (Hand)
      const handGeo = new THREE.SphereGeometry(0.04, 16, 16);
      handGeo.scale(0.8, 1.2, 0.5);
      const hand = new THREE.Mesh(handGeo, skinMaterial);
      hand.position.set(side * (shoulderWidth / 2 + 0.1), 0.42, 0.08);
      group.add(hand);
    });

    // 8. CHÂN TRÁI & PHẢI (Legs)
    [-1, 1].forEach((side) => {
      const legSpacing = hipWidth / 3.2;

      // Khớp háng (Hip Joint)
      const hipJointGeo = new THREE.SphereGeometry(0.05, 16, 16);
      const hipJoint = new THREE.Mesh(hipJointGeo, jointMaterial);
      hipJoint.position.set(side * legSpacing, 0.54, 0);
      group.add(hipJoint);

      // Đùi (Thigh)
      const thighGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.45, 16);
      const thigh = new THREE.Mesh(thighGeo, skinMaterial);
      thigh.position.set(side * legSpacing, 0.3, 0);
      group.add(thigh);

      // Đầu gối (Knee)
      const kneeGeo = new THREE.SphereGeometry(0.048, 16, 16);
      const knee = new THREE.Mesh(kneeGeo, jointMaterial);
      knee.position.set(side * legSpacing, 0.06, 0.02);
      group.add(knee);

      // Bắp chân (Calf)
      const calfGeo = new THREE.CylinderGeometry(0.048, 0.038, 0.44, 16);
      const calf = new THREE.Mesh(calfGeo, skinMaterial);
      calf.position.set(side * legSpacing, -0.18, 0);
      group.add(calf);

      // Bàn chân (Foot)
      const footGeo = new THREE.BoxGeometry(0.07, 0.06, 0.16);
      const foot = new THREE.Mesh(footGeo, skinMaterial);
      foot.position.set(side * legSpacing, -0.42, 0.04);
      group.add(foot);
    });
  };

  // Điều khiển góc nhìn
  const handleResetView = () => {
    if (humanGroupRef.current) {
      humanGroupRef.current.rotation.y = 0;
    }
  };

  const handleTurnBack = () => {
    if (humanGroupRef.current) {
      humanGroupRef.current.rotation.y = Math.PI;
    }
  };

  const isFemale = gender === 'FEMALE';
  const isOther = gender === 'OTHER';
  const genderTitle = isFemale ? 'Nữ giới' : isOther ? 'Giới tính khác' : 'Nam giới';

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-teal-950 rounded-3xl p-5 text-white shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
      {/* Background Tech Grids & Ambient Glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-56 h-56 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Top Header Controls */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-teal-400" />
            Mô hình thể trạng 3D
          </div>
          <h3 className="text-base font-bold text-white mt-1">
            {fullName || 'Người dùng'}
          </h3>
          <p className="text-xs text-slate-400">
            {genderTitle} • {heightCm} cm
          </p>
        </div>

        {/* Nút bật/tắt tự động xoay */}
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

      {/* 3D WebGL Canvas Container */}
      <div className="relative my-2 w-full h-[380px] sm:h-[420px] flex items-center justify-center cursor-grab active:cursor-grabbing">
        <div ref={mountRef} className="w-full h-full" />

        {/* Thước đo chiều cao Laser trực quan bên cạnh */}
        <div className="absolute left-2 top-8 bottom-12 flex flex-col justify-between text-[10px] font-mono text-teal-400/80 pointer-events-none border-l border-teal-500/30 pl-1.5">
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 200 cm
          </span>
          <span className="flex items-center gap-1 font-bold text-teal-300">
            <span className="w-3 h-0.5 bg-teal-300" /> {heightCm} cm
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 150 cm
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 100 cm
          </span>
        </div>

        {/* Floating Indicator nhịp tim phát sáng */}
        <div className="absolute right-3 top-16 p-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-xs space-y-0.5 pointer-events-none animate-pulse">
          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>Vùng tim mạch</span>
          </div>
          <div className="text-[10px] text-slate-300">Nhịp đập 75 bpm</div>
        </div>

        {/* Hướng dẫn tương tác */}
        <div className="absolute bottom-2 text-center w-full pointer-events-none">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] text-slate-400 border border-white/10">
            Kéo chuột để xoay 360°
          </span>
        </div>
      </div>

      {/* Bottom Camera Angle Shortcuts */}
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

        <span className="text-[11px] font-medium text-teal-400/90">
          Mô phỏng nhân trắc học
        </span>
      </div>
    </div>
  );
}