import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  RotateCw, 
  Sparkles, 
  Activity, 
  Heart, 
  Thermometer, 
  Scale, 
  Plus, 
  Minus,
  MoveVertical,
  CheckCircle2,
  Info
} from 'lucide-react';

/**
 * 3D Human Body Viewer (Three.js WebGL - Nâng cấp theo Three.js Skills)
 * 1. Raycasting & Vùng sinh trắc học tương tác (Đầu -> Thân nhiệt, Ngực -> Tim mạch, Eo -> Cân nặng/BMI).
 * 2. Vật liệu PBR & Ánh sáng 3-Point Studio (Key / Fill / Rim light) chuẩn tự nhiên.
 * 3. Chuyển động hô hấp sinh học (Biometric breathing) & Nhịp đập tim kép (Lub-dub pulse).
 * 4. Bục đứng năng lượng Neon xoay 360 độ mượt mà.
 * 5. Co dãn vóc dáng theo chiều cao thực tế (heightCm).
 * 6. Quản lý bộ nhớ Three.js triệt để (Không rò rỉ RAM).
 */
export default function Human3DViewer({
  gender = 'MALE',
  heightCm = 170,
  onHeightChange,
  fullName = 'Người dùng',
  latestMetrics = {},
  onOpenLogModal,
}) {
  const mountRef = useRef(null);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  // Vùng cơ thể đang được chọn / hover
  const [activeZone, setActiveZone] = useState(null); // 'HEAD' | 'CHEST' | 'WAIST' | null
  const activeZoneRef = useRef(null);

  // Tham chiếu Three.js
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const humanGroupRef = useRef(null);
  const bodyMeshGroupRef = useRef(null);
  const heartMeshRef = useRef(null);
  const heartLightRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const raycastTargetsRef = useRef([]);
  const energyRingRef = useRef(null);
  const chestMeshRef = useRef(null);

  // Dữ liệu chỉ số sức khỏe
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
  const genderTitle = isFemale ? 'Nữ giới (Mô hình 3D)' : 'Nam giới (Mô hình 3D)';

  // Cập nhật ref khi state đổi để loop animation dùng được ngay
  useEffect(() => {
    activeZoneRef.current = activeZone;
  }, [activeZone]);

  // Khởi tạo Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 480;

    // 1. SCENE & CAMERA (Chuẩn Perspective Camera)
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 1000);
    camera.position.set(0, 0.95, 3.35);
    cameraRef.current = camera;

    // 2. RENDERER (Khử răng cưa, Tone Mapping chuẩn PBR)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. HỆ THỐNG ÁNH SÁNG 3-POINT STUDIO CHUYÊN NGHIỆP
    // Ambient Light dịu nhẹ
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    // Key Light (Ánh sáng chính ấm áp giả lập đèn rọi Studio)
    const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.7);
    keyLight.position.set(2.5, 6, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Fill Light (Ánh sáng phụ tông xanh dịu lấp bóng tối)
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.0);
    fillLight.position.set(-3.5, 4, 3);
    scene.add(fillLight);

    // Rim Light (Đèn ven phía sau màu ngọc teal tạo đường viền cơ thể)
    const backRimLight = new THREE.DirectionalLight(0x14b8a6, 1.5);
    backRimLight.position.set(0, 5, -4.5);
    scene.add(backRimLight);

    // 4. BỤC ĐỨNG STUDIO PHÁT SÁNG NEON
    const stageGeo = new THREE.CylinderGeometry(0.75, 0.82, 0.05, 40);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.45,
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.y = -0.92;
    stage.receiveShadow = true;
    scene.add(stage);

    // Vòng tròn Neon teal ngoài bục
    const glowRingGeo = new THREE.RingGeometry(0.77, 0.83, 64);
    const glowRingMat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = -0.89;
    scene.add(glowRing);

    // Vòng sóng năng lượng xoay quanh bục (Energy Pulse Ring)
    const energyRingGeo = new THREE.RingGeometry(0.68, 0.72, 48);
    const energyRingMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const energyRing = new THREE.Mesh(energyRingGeo, energyRingMat);
    energyRing.rotation.x = -Math.PI / 2;
    energyRing.position.y = -0.888;
    scene.add(energyRing);
    energyRingRef.current = energyRing;

    // 5. NHÓM ĐỐI TƯỢNG NGƯỜI 3D
    const humanGroup = new THREE.Group();
    scene.add(humanGroup);
    humanGroupRef.current = humanGroup;

    const bodyMeshGroup = new THREE.Group();
    humanGroup.add(bodyMeshGroup);
    bodyMeshGroupRef.current = bodyMeshGroup;

    // Danh sách các mesh mục tiêu cho Raycasting
    raycastTargetsRef.current = [];

    // Dựng nhân vật người
    buildHumanCharacter(bodyMeshGroup, gender, heightCm);

    // 6. RAYCASTER BẮT SỰ KIỆN HOVER VÀ CLICK TỪNG BỘ PHẬN CƠ THỂ
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getRaycastIntersection = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(raycastTargetsRef.current, true);
      if (intersects.length > 0) {
        let currentObj = intersects[0].object;
        while (currentObj && !currentObj.userData?.zone && currentObj.parent) {
          currentObj = currentObj.parent;
        }
        return currentObj?.userData?.zone || null;
      }
      return null;
    };

    // Xử lý kéo chuột để xoay 360 độ và Raycast Hover
    let dragDistance = 0;

    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      dragDistance = 0;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (isDraggingRef.current && humanGroupRef.current) {
        const deltaX = e.clientX - previousMousePositionRef.current.x;
        dragDistance += Math.abs(deltaX);
        humanGroupRef.current.rotation.y += deltaX * 0.012;
        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      } else {
        // Kiểm tra vùng trỏ chuột (Raycasting Hover)
        const hitZone = getRaycastIntersection(e.clientX, e.clientY);
        if (hitZone) {
          renderer.domElement.style.cursor = 'pointer';
          setActiveZone(hitZone);
        } else {
          renderer.domElement.style.cursor = isDraggingRef.current ? 'grabbing' : 'grab';
          if (!activeZoneRef.currentLocked) {
            setActiveZone(null);
          }
        }
      }
    };

    const handleMouseUp = (e) => {
      isDraggingRef.current = false;
      // Nếu là click nhẹ (không phải kéo xoay), chọn vùng cơ thể
      if (dragDistance < 4) {
        const hitZone = getRaycastIntersection(e.clientX, e.clientY);
        setActiveZone(hitZone);
      }
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        dragDistance = 0;
        previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e) => {
      if (!isDraggingRef.current || !humanGroupRef.current || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePositionRef.current.x;
      dragDistance += Math.abs(deltaX);
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

    // 7. ANIMATION LOOP (Theo kỹ thuật Three.js Animation & Shaders)
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Tự động xoay chậm nhẹ nhàng khi không kéo
      if (isAutoRotating && !isDraggingRef.current && humanGroupRef.current) {
        humanGroupRef.current.rotation.y += 0.005;
      }

      // Vòng năng lượng bục quay chậm
      if (energyRingRef.current) {
        energyRingRef.current.rotation.z = elapsed * 0.4;
      }

      // NHỊP TIM SINH HỌC KÉP (Lub-Dub Pulse Pattern)
      if (heartMeshRef.current && heartLightRef.current) {
        const isChestFocused = activeZoneRef.current === 'CHEST';
        const beatRate = isChestFocused ? 6.5 : 4.6;
        
        // Mô phỏng nhịp đập tâm thu & tâm trương
        const rawPulse = Math.sin(elapsed * beatRate);
        const doubleBeat = Math.max(0, rawPulse) + Math.max(0, Math.sin(elapsed * beatRate + 0.35)) * 0.5;
        const scale = 1 + doubleBeat * (isChestFocused ? 0.35 : 0.22);
        
        heartMeshRef.current.scale.set(scale, scale, scale);
        heartLightRef.current.intensity = (isChestFocused ? 2.5 : 1.4) + doubleBeat * 2.5;
      }

      // NHỊP HÔ HẤP TỰ NHIÊN (Chest expands during breathing cycle)
      if (chestMeshRef.current) {
        const breath = Math.sin(elapsed * 1.6);
        const breathScaleZ = 1 + breath * 0.025;
        const breathScaleX = 1 + breath * 0.015;
        chestMeshRef.current.scale.set(breathScaleX, 1, breathScaleZ);
      }

      // Chuyển động phập phồng nhẹ nhàng toàn cơ thể
      if (bodyMeshGroupRef.current) {
        bodyMeshGroupRef.current.position.y = Math.sin(elapsed * 1.6) * 0.007;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 8. TỰ ĐỘNG RESPONSIVE THEO KÍCH THƯỚC CONTAINER
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

    // 9. QUẢN LÝ BỘ NHỚ TRIỆT ĐỂ (Lifecycle Cleanup chuẩn Three.js Skills)
    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
      resizeObserver.disconnect();
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('touchstart', handleTouchStart);
      dom.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);

      // Giải phóng tài nguyên Three.js sạch sẽ
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (container && renderer.domElement) {
        container.innerHTML = '';
      }
    };
  }, [gender]);

  // Cập nhật co dãn chiều cao
  useEffect(() => {
    if (bodyMeshGroupRef.current) {
      applyHeightScale(bodyMeshGroupRef.current, heightCm);
    }
  }, [heightCm]);

  const applyHeightScale = (group, currentHeight) => {
    const heightFactor = Math.max(0.72, Math.min(1.32, (Number(currentHeight) || 170) / 170));
    const scaleY = heightFactor;
    const scaleXZ = 1 + (heightFactor - 1) * 0.35;
    group.scale.set(scaleXZ, scaleY, scaleXZ);

    const floorY = -0.89;
    group.position.y = floorY * (1 - scaleY);
  };

  // =========================================================================
  // DỰNG MÔ HÌNH CON NGƯỜI CHÂN THỰC & GẮN VÙNG TƯƠNG TÁC (Raycasting Tags)
  // =========================================================================
  const buildHumanCharacter = (group, userGender, userHeight) => {
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    }

    const isFem = userGender === 'FEMALE';

    // 1. MÀU DA TỰ NHIÊN PBR (Soft Natural Human Skin)
    const skinMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0xfce5d4 : 0xf5cca9,
      roughness: 0.52,
      metalness: 0.04,
    });

    // 2. TÓC
    const hairMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0x241813 : 0x181615,
      roughness: 0.65,
      metalness: 0.1,
    });

    // 3. MẮT & MÔI
    const eyeIrisMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0x4c1d95 : 0x1e3a8a,
      roughness: 0.2,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lipMat = new THREE.MeshBasicMaterial({ color: isFem ? 0xf472b6 : 0xde8c7c });

    // 4. VẢI ÁO & QUẦN / VÁY
    const shirtMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0xf472b6 : 0x0f766e,
      roughness: 0.72,
      metalness: 0.05,
    });

    const collarMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0xfbcfe8 : 0x115e59,
      roughness: 0.6,
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75,
      metalness: 0.05,
    });

    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x312e81,
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const shoeMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0xec4899 : 0xffffff,
      roughness: 0.35,
      metalness: 0.15,
    });

    // ----------------------------------------------------
    // A. NHÓM ĐẦU & MẶT (GẮN VÙNG THÂN NHIỆT - HEAD)
    // ----------------------------------------------------
    const headGroup = new THREE.Group();
    headGroup.userData = { zone: 'HEAD' };

    const headGeo = new THREE.SphereGeometry(0.125, 32, 24);
    headGeo.scale(1, 1.22, 1.05);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.35;
    head.castShadow = true;
    head.userData = { zone: 'HEAD' };
    headGroup.add(head);

    // Mắt
    [-0.046, 0.046].forEach((xOffset) => {
      const scleraGeo = new THREE.SphereGeometry(0.02, 16, 16);
      scleraGeo.scale(1, 1.35, 0.4);
      const sclera = new THREE.Mesh(scleraGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      sclera.position.set(xOffset, 1.37, 0.118);
      headGroup.add(sclera);

      const irisGeo = new THREE.SphereGeometry(0.014, 16, 16);
      irisGeo.scale(1, 1.3, 0.3);
      const iris = new THREE.Mesh(irisGeo, eyeIrisMat);
      iris.position.set(xOffset, 1.37, 0.125);
      headGroup.add(iris);

      const pupilGeo = new THREE.SphereGeometry(0.007, 12, 12);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(xOffset, 1.37, 0.129);
      headGroup.add(pupil);

      const shineGeo = new THREE.SphereGeometry(0.005, 8, 8);
      const shine = new THREE.Mesh(shineGeo, shineMat);
      shine.position.set(xOffset + 0.004, 1.376, 0.131);
      headGroup.add(shine);

      const browGeo = new THREE.BoxGeometry(0.038, 0.006, 0.01);
      const brow = new THREE.Mesh(browGeo, hairMat);
      brow.position.set(xOffset, 1.412, 0.12);
      brow.rotation.z = (xOffset > 0 ? -1 : 1) * 0.08;
      headGroup.add(brow);
    });

    // Mũi & Miệng
    const noseGeo = new THREE.ConeGeometry(0.01, 0.02, 8);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.328, 0.134);
    headGroup.add(nose);

    const mouthGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.005, 16, 1, false, 0, Math.PI);
    const mouth = new THREE.Mesh(mouthGeo, lipMat);
    mouth.rotation.x = Math.PI / 2;
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 1.285, 0.122);
    headGroup.add(mouth);

    // Tai
    [-0.13, 0.13].forEach((earX) => {
      const earGeo = new THREE.SphereGeometry(0.028, 12, 12);
      earGeo.scale(0.5, 1, 0.8);
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(earX, 1.35, 0);
      headGroup.add(ear);
    });

    // Tóc
    if (isFem) {
      const femaleHairTop = new THREE.SphereGeometry(0.142, 24, 16);
      femaleHairTop.scale(1.02, 1.25, 1.15);
      const hairTop = new THREE.Mesh(femaleHairTop, hairMat);
      hairTop.position.set(0, 1.39, -0.01);
      headGroup.add(hairTop);

      [-0.11, 0.11].forEach((xSide) => {
        const sideHairGeo = new THREE.CylinderGeometry(0.045, 0.02, 0.35, 12);
        const sideHair = new THREE.Mesh(sideHairGeo, hairMat);
        sideHair.position.set(xSide, 1.18, 0.02);
        sideHair.rotation.z = (xSide > 0 ? -1 : 1) * 0.12;
        headGroup.add(sideHair);
      });

      const backHairGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.5, 16);
      const backHair = new THREE.Mesh(backHairGeo, hairMat);
      backHair.position.set(0, 1.12, -0.1);
      backHair.rotation.x = -0.12;
      headGroup.add(backHair);

      const bowGeo = new THREE.SphereGeometry(0.026, 12, 12);
      const bowMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
      const bow = new THREE.Mesh(bowGeo, bowMat);
      bow.position.set(0.095, 1.48, 0.06);
      headGroup.add(bow);
    } else {
      const maleHairGeo = new THREE.SphereGeometry(0.138, 24, 16);
      maleHairGeo.scale(1.05, 1.2, 1.1);
      const maleHair = new THREE.Mesh(maleHairGeo, hairMat);
      maleHair.position.set(0, 1.42, 0);
      headGroup.add(maleHair);

      [-0.05, 0.05].forEach((bangX) => {
        const bangPartGeo = new THREE.BoxGeometry(0.09, 0.06, 0.08);
        const bangPart = new THREE.Mesh(bangPartGeo, hairMat);
        bangPart.position.set(bangX, 1.46, 0.09);
        bangPart.rotation.z = (bangX > 0 ? -0.2 : 0.2);
        bangPart.rotation.x = 0.2;
        headGroup.add(bangPart);
      });
    }

    group.add(headGroup);
    raycastTargetsRef.current.push(head);

    // Cổ
    const neckGeo = new THREE.CylinderGeometry(0.052, 0.06, 0.1, 16);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = 1.19;
    group.add(neck);

    // ----------------------------------------------------
    // B. NHÓM LỒNG NGỰC & TIM (GẮN VÙNG HUYẾT ÁP & TIM - CHEST)
    // ----------------------------------------------------
    const chestGroup = new THREE.Group();
    chestGroup.userData = { zone: 'CHEST' };

    const shoulderWidth = isFem ? 0.38 : 0.48;
    const waistWidth = isFem ? 0.24 : 0.32;

    const shirtGeo = new THREE.CylinderGeometry(
      shoulderWidth / 2,
      waistWidth / 2,
      0.38,
      24
    );
    shirtGeo.scale(1, 1, 0.85);
    const shirt = new THREE.Mesh(shirtGeo, shirtMat);
    shirt.position.y = 0.98;
    shirt.castShadow = true;
    shirt.userData = { zone: 'CHEST' };
    chestGroup.add(shirt);
    chestMeshRef.current = shirt;

    const collarGeo = new THREE.TorusGeometry(0.08, 0.015, 12, 24);
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.16, 0.01);
    chestGroup.add(collar);

    if (isFem) {
      [-0.065, 0.065].forEach((offset) => {
        const bustGeo = new THREE.SphereGeometry(0.065, 16, 16);
        const bust = new THREE.Mesh(bustGeo, shirtMat);
        bust.position.set(offset, 1.02, 0.08);
        bust.userData = { zone: 'CHEST' };
        chestGroup.add(bust);
      });
    }

    // Trái tim 3D phát sáng nhấp nháy bên ngực trái
    const heartGeo = new THREE.SphereGeometry(0.038, 16, 16);
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.position.set(0.06, 1.04, 0.1);
    heartMesh.userData = { zone: 'CHEST' };
    chestGroup.add(heartMesh);
    heartMeshRef.current = heartMesh;

    const heartLight = new THREE.PointLight(0xff1744, 2.2, 1.4);
    heartLight.position.set(0.06, 1.04, 0.16);
    chestGroup.add(heartLight);
    heartLightRef.current = heartLight;

    group.add(chestGroup);
    raycastTargetsRef.current.push(shirt, heartMesh);

    // Cánh tay & Bàn tay
    [-1, 1].forEach((side) => {
      const sleeveGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.14, 16);
      const sleeve = new THREE.Mesh(sleeveGeo, shirtMat);
      sleeve.position.set(side * (shoulderWidth / 2 + 0.03), 1.07, 0);
      sleeve.rotation.z = side * -0.22;
      group.add(sleeve);

      const armGeo = new THREE.CylinderGeometry(0.044, 0.034, 0.44, 16);
      const arm = new THREE.Mesh(armGeo, skinMat);
      arm.position.set(side * (shoulderWidth / 2 + 0.075), 0.82, 0.02);
      arm.rotation.z = side * -0.16;
      group.add(arm);

      const handGeo = new THREE.SphereGeometry(0.038, 16, 16);
      handGeo.scale(0.8, 1.2, 0.5);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.set(side * (shoulderWidth / 2 + 0.1), 0.56, 0.04);
      group.add(hand);
    });

    // ----------------------------------------------------
    // C. NHÓM EO / BỤNG & CHI DƯỚI (GẮN VÙNG THỂ TRẠNG - WAIST)
    // ----------------------------------------------------
    const waistGroup = new THREE.Group();
    waistGroup.userData = { zone: 'WAIST' };

    if (isFem) {
      const waistBandGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.06, 24);
      const waistBandMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.5 });
      const waistBand = new THREE.Mesh(waistBandGeo, waistBandMat);
      waistBand.position.y = 0.76;
      waistBand.userData = { zone: 'WAIST' };
      waistGroup.add(waistBand);

      const skirtGeo = new THREE.CylinderGeometry(0.15, 0.38, 0.38, 32, 1, true);
      const skirt = new THREE.Mesh(skirtGeo, skirtMat);
      skirt.position.y = 0.56;
      skirt.castShadow = true;
      skirt.userData = { zone: 'WAIST' };
      waistGroup.add(skirt);
      raycastTargetsRef.current.push(skirt);

      [-1, 1].forEach((side) => {
        const legX = side * 0.085;
        const legGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.78, 16);
        const leg = new THREE.Mesh(legGeo, skinMat);
        leg.position.set(legX, 0.05, 0);
        leg.castShadow = true;
        waistGroup.add(leg);

        const shoeGeo = new THREE.BoxGeometry(0.075, 0.06, 0.15);
        const shoe = new THREE.Mesh(shoeGeo, shoeMat);
        shoe.position.set(legX, -0.38, 0.03);
        waistGroup.add(shoe);

        const shoeBowGeo = new THREE.SphereGeometry(0.012, 8, 8);
        const shoeBow = new THREE.Mesh(shoeBowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        shoeBow.position.set(legX, -0.34, 0.09);
        waistGroup.add(shoeBow);
      });
    } else {
      const pelvisGeo = new THREE.CylinderGeometry(0.165, 0.175, 0.18, 24);
      const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
      pelvis.position.y = 0.73;
      pelvis.userData = { zone: 'WAIST' };
      waistGroup.add(pelvis);
      raycastTargetsRef.current.push(pelvis);

      const beltGeo = new THREE.CylinderGeometry(0.168, 0.168, 0.035, 24);
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 });
      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.position.y = 0.79;
      waistGroup.add(belt);

      const buckleGeo = new THREE.BoxGeometry(0.04, 0.03, 0.015);
      const buckleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
      const buckle = new THREE.Mesh(buckleGeo, buckleMat);
      buckle.position.set(0, 0.79, 0.17);
      waistGroup.add(buckle);

      [-1, 1].forEach((side) => {
        const legX = side * 0.095;
        const pantsLegGeo = new THREE.CylinderGeometry(0.075, 0.055, 1.05, 16);
        const pantsLeg = new THREE.Mesh(pantsLegGeo, pantsMat);
        pantsLeg.position.set(legX, 0.15, 0);
        pantsLeg.castShadow = true;
        waistGroup.add(pantsLeg);

        const shoeGeo = new THREE.BoxGeometry(0.085, 0.075, 0.19);
        const shoe = new THREE.Mesh(shoeGeo, shoeMat);
        shoe.position.set(legX, -0.38, 0.03);
        waistGroup.add(shoe);

        const soleGeo = new THREE.BoxGeometry(0.088, 0.02, 0.195);
        const soleMat = new THREE.MeshStandardMaterial({ color: 0x0d9488 });
        const sole = new THREE.Mesh(soleGeo, soleMat);
        sole.position.set(legX, -0.41, 0.03);
        waistGroup.add(sole);
      });
    }

    group.add(waistGroup);

    applyHeightScale(group, userHeight);
  };

  const handleResetView = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = 0;
  };
  const handleTurnBack = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = Math.PI;
  };

  const handleAdjustHeight = (delta) => {
    const newH = Math.max(120, Math.min(220, (Number(heightCm) || 170) + delta));
    if (onHeightChange) {
      onHeightChange(newH);
    }
  };

  const laserPercentage = Math.max(12, Math.min(88, ((Number(heightCm) || 170) - 120) / (220 - 120) * 100));

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-teal-950 rounded-3xl p-5 text-white shadow-2xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="relative z-20 flex items-center justify-between pb-2">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-teal-300 uppercase tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            Mô hình 3D Sinh trắc học y tế
          </div>
          <h3 className="text-lg font-bold text-white mt-1">
            {fullName || 'Người dùng'}
          </h3>
          <p className="text-xs text-slate-400">
            {genderTitle} • <strong className="text-teal-300">{heightCm} cm</strong>
          </p>
        </div>

        {/* Nút bật/tắt tự động xoay */}
        <button
          type="button"
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            isAutoRotating
              ? 'bg-teal-500/20 border-teal-500/40 text-teal-300 shadow-sm'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
          }`}
          title={isAutoRotating ? 'Dừng tự xoay' : 'Bật tự xoay 360°'}
        >
          <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
        </button>
      </div>

      {/* KHÔNG GIAN 3D WEBGL CONTAINER */}
      <div className="relative my-2 w-full h-[430px] sm:h-[480px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none">
        <div ref={mountRef} className="w-full h-full" />

        {/* THƯỚC ĐO LASER CHIỀU CAO (BÊN TRÁI) */}
        <div className="absolute left-2 top-8 bottom-12 flex flex-col justify-between text-[10px] font-mono text-teal-400/80 pointer-events-none border-l border-teal-500/30 pl-1.5 z-20">
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 220 cm
          </span>

          {/* Dấu Laser động theo chiều cao */}
          <div 
            className="absolute left-0 -ml-[1px] transition-all duration-300 ease-out flex items-center gap-1.5 pointer-events-none"
            style={{ bottom: `${laserPercentage}%` }}
          >
            <span className="w-3.5 h-0.5 bg-teal-300 shadow-[0_0_10px_#2dd4bf]" />
            <span className="font-bold text-teal-200 bg-teal-950/90 px-1.5 py-0.5 rounded border border-teal-400/60 shadow-md text-[10px] whitespace-nowrap">
              {heightCm} cm
            </span>
          </div>

          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 170 cm
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 120 cm
          </span>
        </div>

        {/* ============================================================== */}
        {/* HUD CHỈ SỐ 1: THÂN NHIỆT (VÙNG ĐẦU / TRÁN)                     */}
        {/* ============================================================== */}
        <div 
          onClick={() => setActiveZone(activeZone === 'HEAD' ? null : 'HEAD')}
          className={`absolute right-3 top-4 p-2.5 rounded-2xl backdrop-blur-md shadow-xl text-xs space-y-0.5 pointer-events-auto transition-all duration-300 cursor-pointer ${
            activeZone === 'HEAD'
              ? 'bg-amber-950/90 border-2 border-amber-400 scale-105 shadow-amber-500/30 ring-2 ring-amber-400/20'
              : 'bg-slate-900/90 border border-amber-500/40 hover:scale-105'
          } z-20`}
        >
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
            <Thermometer className="w-3.5 h-3.5 text-amber-400" />
            <span>Nhiệt độ (Trán)</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-white">{tempDisplay}</span>
            <span className="text-[10px] text-slate-400">°C</span>
          </div>
          <span className="inline-block text-[9px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/20">
            {activeZone === 'HEAD' ? '● Đang xem vùng đầu' : 'Thân nhiệt ổn định'}
          </span>
        </div>

        {/* ============================================================== */}
        {/* HUD CHỈ SỐ 2: HUYẾT ÁP & TIM (VÙNG NGỰC / TIM)                 */}
        {/* ============================================================== */}
        <div 
          onClick={() => setActiveZone(activeZone === 'CHEST' ? null : 'CHEST')}
          className={`absolute right-3 top-28 sm:top-32 p-2.5 rounded-2xl backdrop-blur-md shadow-xl text-xs space-y-0.5 pointer-events-auto transition-all duration-300 cursor-pointer ${
            activeZone === 'CHEST'
              ? 'bg-rose-950/90 border-2 border-rose-400 scale-105 shadow-rose-500/30 ring-2 ring-rose-400/20'
              : 'bg-slate-900/90 border border-rose-500/40 hover:scale-105'
          } z-20`}
        >
          <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
            <span>Huyết áp & Tim (Ngực)</span>
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
        <div 
          onClick={() => setActiveZone(activeZone === 'WAIST' ? null : 'WAIST')}
          className={`absolute left-10 bottom-6 sm:bottom-8 p-2.5 rounded-2xl backdrop-blur-md shadow-xl text-xs space-y-0.5 pointer-events-auto transition-all duration-300 cursor-pointer ${
            activeZone === 'WAIST'
              ? 'bg-teal-950/90 border-2 border-teal-400 scale-105 shadow-teal-500/30 ring-2 ring-teal-400/20'
              : 'bg-slate-900/90 border border-teal-500/40 hover:scale-105'
          } z-20`}
        >
          <div className="flex items-center gap-1.5 text-teal-300 font-bold text-[11px]">
            <Scale className="w-3.5 h-3.5 text-teal-400" />
            <span>Cân nặng & BMI (Eo)</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-white">{weightDisplay}</span>
            <span className="text-[10px] text-slate-400">kg</span>
            <span className="text-[11px] text-teal-400 font-bold ml-1">
              (BMI {bmiDisplay})
            </span>
          </div>
          <span className="inline-block text-[9px] font-semibold text-teal-300 bg-teal-950/80 px-1.5 py-0.2 rounded border border-teal-500/20">
            {activeZone === 'WAIST' ? '● Đang xem vùng eo' : 'Thể trạng cân đối'}
          </span>
        </div>

        {/* Hướng dẫn tương tác Raycasting */}
        <div className="absolute bottom-2 text-center w-full pointer-events-none z-20">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-[10px] text-slate-300 border border-white/10 shadow-md">
            <Info className="w-3 h-3 text-teal-400" />
            <span>Rê chuột/chạm vào <strong>Đầu</strong>, <strong>Ngực</strong>, <strong>Eo</strong> để xem chỉ số tương ứng</span>
          </span>
        </div>
      </div>

      {/* THANH TƯƠNG TÁC CHIỀU CAO & ĐIỀU KHIỂN GÓC NHÌN */}
      <div className="relative z-20 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        {/* Bộ tương tác chiều cao trực tiếp */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-white/10">
          <MoveVertical className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-[11px] text-slate-300">Chiều cao:</span>
          <button
            type="button"
            onClick={() => handleAdjustHeight(-2)}
            className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer transition-all"
            title="Giảm 2cm"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="font-mono font-bold text-teal-300 text-xs px-1">
            {heightCm} cm
          </span>
          <button
            type="button"
            onClick={() => handleAdjustHeight(2)}
            className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer transition-all"
            title="Tăng 2cm"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Nút xoay góc nhìn & Ghi chỉ số */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleResetView}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-semibold cursor-pointer transition-colors"
          >
            Mặt trước
          </button>
          <button
            type="button"
            onClick={handleTurnBack}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-semibold cursor-pointer transition-colors"
          >
            Mặt sau
          </button>

          {onOpenLogModal && (
            <button
              type="button"
              onClick={onOpenLogModal}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-teal-600/30 active:scale-95 ml-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ghi chỉ số</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
