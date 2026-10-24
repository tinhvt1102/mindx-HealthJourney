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
  MoveVertical
} from 'lucide-react';

/**
 * 3D Human Body Viewer (Three.js WebGL)
 * Dựng hình người 3D chân thực, tự nhiên:
 * - Nam: Áo thun hiện đại, quần dài suông, giày sneakers, tóc nam gọn gàng.
 * - Nữ: Áo thun nữ tính, chân váy xòe / quần thanh lịch, tóc dài suông, giày búp bê.
 * - Tương tác co dãn chiều cao trực tiếp (heightCm).
 * - Bục đứng Studio phát sáng neon, xoay 360 độ mượt mà.
 * - Gắn đầy đủ thẻ HUD y tế: Thân nhiệt, Huyết áp, Nhịp tim, Cân nặng, BMI.
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

  // Tham chiếu Three.js
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const humanGroupRef = useRef(null);
  const bodyMeshGroupRef = useRef(null);
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
  const genderTitle = isFemale ? 'Nữ giới (Mô hình 3D)' : 'Nam giới (Mô hình 3D)';

  // Khởi tạo Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 1000);
    camera.position.set(0, 0.95, 3.35);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Ánh sáng Studio chuyên nghiệp làm nổi bật làn da và trang phục
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
    keyLight.position.set(2.5, 6, 4.5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 1.0);
    fillLight.position.set(-3.5, 4, 3);
    scene.add(fillLight);

    const backRimLight = new THREE.DirectionalLight(0x14b8a6, 1.3);
    backRimLight.position.set(0, 5, -4.5);
    scene.add(backRimLight);

    // Bục đứng tròn Studio phát sáng
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
      opacity: 0.8,
    });
    const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = -0.89;
    scene.add(glowRing);

    // Nhóm xoay đối tượng
    const humanGroup = new THREE.Group();
    scene.add(humanGroup);
    humanGroupRef.current = humanGroup;

    // Nhóm con chứa cơ thể (để co dãn chiều cao linh hoạt)
    const bodyMeshGroup = new THREE.Group();
    humanGroup.add(bodyMeshGroup);
    bodyMeshGroupRef.current = bodyMeshGroup;

    // Dựng nhân vật người thật
    buildHumanCharacter(bodyMeshGroup, gender, heightCm);

    // Xử lý kéo chuột để xoay 360 độ
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

      // Tự động xoay nhẹ nhàng
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

      // Nhịp thở phập phồng nhẹ nhàng
      if (bodyMeshGroupRef.current) {
        bodyMeshGroupRef.current.position.y = Math.sin(elapsed * 1.5) * 0.008;
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
  }, [gender]);

  // Khi chiều cao heightCm thay đổi, co dãn tỷ lệ trực tiếp
  useEffect(() => {
    if (bodyMeshGroupRef.current) {
      applyHeightScale(bodyMeshGroupRef.current, heightCm);
    }
  }, [heightCm]);

  // HÀM CO DÃN MÔ HÌNH 3D THEO CHIỀU CAO
  const applyHeightScale = (group, currentHeight) => {
    const heightFactor = Math.max(0.72, Math.min(1.32, (Number(currentHeight) || 170) / 170));
    
    // Tỷ lệ trục Y co dãn trực tiếp, trục X/Z nở nhẹ tự nhiên
    const scaleY = heightFactor;
    const scaleXZ = 1 + (heightFactor - 1) * 0.35;
    group.scale.set(scaleXZ, scaleY, scaleXZ);

    // Đảm bảo bàn chân luôn đứng cố định ngay trên mặt bục (-0.89)
    const floorY = -0.89;
    group.position.y = floorY * (1 - scaleY);
  };

  // =========================================================================
  // XÂY DỰNG MÔ HÌNH CON NGƯỜI CHÂN THỰC:
  // - Nam: Áo thun polo/hoodie gọn gàng, quần dài suông tối màu, giày sneaker
  // - Nữ: Áo thun xinh xắn, chân váy xòe xếp ly hoặc quần, giày búp bê
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

    // 1. MÀU DA TỰ NHIÊN (Warm soft skin tone)
    const skinMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0xfce5d4 : 0xf5cca9,
      roughness: 0.55,
      metalness: 0.05,
    });

    // 2. MÀU TÓC (Soft Dark Brown / Espresso)
    const hairMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0x261a15 : 0x1a1816,
      roughness: 0.65,
      metalness: 0.1,
    });

    // 3. MẮT & MẶT
    const eyeIrisMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0x581c87 : 0x1e3a8a,
      roughness: 0.2,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lipMat = new THREE.MeshBasicMaterial({ color: isFem ? 0xf472b6 : 0xde8c7c });

    // 4. TRANG PHỤC:
    // Nam: Áo thun xanh Teal / Kem ấm, Quần dài ống suông than đậm, Giày Sneaker
    // Nữ: Áo thun hồng pastel / kem, Chân váy xòe tím than / navy, Giày búp bê
    const shirtMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0xf472b6 : 0x0f766e,
      roughness: 0.7,
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
    // A. ĐẦU & KHUÔN MẶT CON NGƯỜI
    // ----------------------------------------------------
    const headGeo = new THREE.SphereGeometry(0.125, 32, 24);
    headGeo.scale(1, 1.22, 1.05);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    // Đôi mắt người có hồn
    [-0.046, 0.046].forEach((xOffset) => {
      // Lòng trắng
      const scleraGeo = new THREE.SphereGeometry(0.02, 16, 16);
      scleraGeo.scale(1, 1.35, 0.4);
      const sclera = new THREE.Mesh(scleraGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      sclera.position.set(xOffset, 1.37, 0.118);
      group.add(sclera);

      // Tròng mắt
      const irisGeo = new THREE.SphereGeometry(0.014, 16, 16);
      irisGeo.scale(1, 1.3, 0.3);
      const iris = new THREE.Mesh(irisGeo, eyeIrisMat);
      iris.position.set(xOffset, 1.37, 0.125);
      group.add(iris);

      // Con ngươi
      const pupilGeo = new THREE.SphereGeometry(0.007, 12, 12);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(xOffset, 1.37, 0.129);
      group.add(pupil);

      // Điểm phản chiếu ánh sáng trong mắt
      const shineGeo = new THREE.SphereGeometry(0.005, 8, 8);
      const shine = new THREE.Mesh(shineGeo, shineMat);
      shine.position.set(xOffset + 0.004, 1.376, 0.131);
      group.add(shine);

      // Lông mày
      const browGeo = new THREE.BoxGeometry(0.038, 0.006, 0.01);
      const brow = new THREE.Mesh(browGeo, hairMat);
      brow.position.set(xOffset, 1.412, 0.12);
      brow.rotation.z = (xOffset > 0 ? -1 : 1) * 0.08;
      group.add(brow);
    });

    // Mũi người
    const noseGeo = new THREE.ConeGeometry(0.01, 0.02, 8);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.328, 0.134);
    group.add(nose);

    // Nụ cười
    const mouthGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.005, 16, 1, false, 0, Math.PI);
    const mouth = new THREE.Mesh(mouthGeo, lipMat);
    mouth.rotation.x = Math.PI / 2;
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 1.285, 0.122);
    group.add(mouth);

    // Đôi tai
    [-0.13, 0.13].forEach((earX) => {
      const earGeo = new THREE.SphereGeometry(0.028, 12, 12);
      earGeo.scale(0.5, 1, 0.8);
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(earX, 1.35, 0);
      group.add(ear);
    });

    // ----------------------------------------------------
    // B. MÁI TÓC
    // ----------------------------------------------------
    if (isFem) {
      // Tóc Nữ: Dài mượt thả qua vai + Nơ
      const femaleHairTop = new THREE.SphereGeometry(0.142, 24, 16);
      femaleHairTop.scale(1.02, 1.25, 1.15);
      const hairTop = new THREE.Mesh(femaleHairTop, hairMat);
      hairTop.position.set(0, 1.39, -0.01);
      group.add(hairTop);

      [-0.11, 0.11].forEach((xSide) => {
        const sideHairGeo = new THREE.CylinderGeometry(0.045, 0.02, 0.35, 12);
        const sideHair = new THREE.Mesh(sideHairGeo, hairMat);
        sideHair.position.set(xSide, 1.18, 0.02);
        sideHair.rotation.z = (xSide > 0 ? -1 : 1) * 0.12;
        group.add(sideHair);
      });

      const backHairGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.5, 16);
      const backHair = new THREE.Mesh(backHairGeo, hairMat);
      backHair.position.set(0, 1.12, -0.1);
      backHair.rotation.x = -0.12;
      group.add(backHair);

      const bowGeo = new THREE.SphereGeometry(0.026, 12, 12);
      const bowMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
      const bow = new THREE.Mesh(bowGeo, bowMat);
      bow.position.set(0.095, 1.48, 0.06);
      group.add(bow);
    } else {
      // Tóc Nam: Tóc ngắn rẽ ngôi nam tính
      const maleHairGeo = new THREE.SphereGeometry(0.138, 24, 16);
      maleHairGeo.scale(1.05, 1.2, 1.1);
      const maleHair = new THREE.Mesh(maleHairGeo, hairMat);
      maleHair.position.set(0, 1.42, 0);
      group.add(maleHair);

      [-0.05, 0.05].forEach((bangX) => {
        const bangPartGeo = new THREE.BoxGeometry(0.09, 0.06, 0.08);
        const bangPart = new THREE.Mesh(bangPartGeo, hairMat);
        bangPart.position.set(bangX, 1.46, 0.09);
        bangPart.rotation.z = (bangX > 0 ? -0.2 : 0.2);
        bangPart.rotation.x = 0.2;
        group.add(bangPart);
      });
    }

    // ----------------------------------------------------
    // C. CỔ
    // ----------------------------------------------------
    const neckGeo = new THREE.CylinderGeometry(0.052, 0.06, 0.1, 16);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = 1.19;
    group.add(neck);

    // ----------------------------------------------------
    // D. THÂN ÁO (T-SHIRT / HOODIE)
    // ----------------------------------------------------
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
    group.add(shirt);

    // Viền cổ áo
    const collarGeo = new THREE.TorusGeometry(0.08, 0.015, 12, 24);
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.16, 0.01);
    group.add(collar);

    if (isFem) {
      [-0.065, 0.065].forEach((offset) => {
        const bustGeo = new THREE.SphereGeometry(0.065, 16, 16);
        const bust = new THREE.Mesh(bustGeo, shirtMat);
        bust.position.set(offset, 1.02, 0.08);
        group.add(bust);
      });
    }

    // Trái tim 3D phát sáng nhấp nháy ở lồng ngực trái
    const heartGeo = new THREE.SphereGeometry(0.038, 16, 16);
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.position.set(0.06, 1.04, 0.1);
    group.add(heartMesh);
    heartMeshRef.current = heartMesh;

    const heartLight = new THREE.PointLight(0xff1744, 2.2, 1.2);
    heartLight.position.set(0.06, 1.04, 0.16);
    group.add(heartLight);
    heartLightRef.current = heartLight;

    // ----------------------------------------------------
    // E. CÁNH TAY VÀ BÀN TAY
    // ----------------------------------------------------
    [-1, 1].forEach((side) => {
      // Ống tay áo ngắn
      const sleeveGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.14, 16);
      const sleeve = new THREE.Mesh(sleeveGeo, shirtMat);
      sleeve.position.set(side * (shoulderWidth / 2 + 0.03), 1.07, 0);
      sleeve.rotation.z = side * -0.22;
      group.add(sleeve);

      // Cánh tay
      const armGeo = new THREE.CylinderGeometry(0.044, 0.034, 0.44, 16);
      const arm = new THREE.Mesh(armGeo, skinMat);
      arm.position.set(side * (shoulderWidth / 2 + 0.075), 0.82, 0.02);
      arm.rotation.z = side * -0.16;
      group.add(arm);

      // Bàn tay
      const handGeo = new THREE.SphereGeometry(0.038, 16, 16);
      handGeo.scale(0.8, 1.2, 0.5);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.set(side * (shoulderWidth / 2 + 0.1), 0.56, 0.04);
      group.add(hand);
    });

    // ----------------------------------------------------
    // F. PHẦN DƯỚI: NỮ MẶC CHÂN VÁY - NAM MẶC QUẦN DÀI
    // ----------------------------------------------------
    if (isFem) {
      // Nữ: Cạp váy & Tùng váy xòe xếp ly
      const waistBandGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.06, 24);
      const waistBandMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.5 });
      const waistBand = new THREE.Mesh(waistBandGeo, waistBandMat);
      waistBand.position.y = 0.76;
      group.add(waistBand);

      const skirtGeo = new THREE.CylinderGeometry(0.15, 0.38, 0.38, 32, 1, true);
      const skirt = new THREE.Mesh(skirtGeo, skirtMat);
      skirt.position.y = 0.56;
      skirt.castShadow = true;
      group.add(skirt);

      // Đôi chân thon gọn
      [-1, 1].forEach((side) => {
        const legX = side * 0.085;

        const legGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.78, 16);
        const leg = new THREE.Mesh(legGeo, skinMat);
        leg.position.set(legX, 0.05, 0);
        leg.castShadow = true;
        group.add(leg);

        // Giày búp bê có nơ
        const shoeGeo = new THREE.BoxGeometry(0.075, 0.06, 0.15);
        const shoe = new THREE.Mesh(shoeGeo, shoeMat);
        shoe.position.set(legX, -0.38, 0.03);
        group.add(shoe);

        const shoeBowGeo = new THREE.SphereGeometry(0.012, 8, 8);
        const shoeBow = new THREE.Mesh(shoeBowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        shoeBow.position.set(legX, -0.34, 0.09);
        group.add(shoeBow);
      });
    } else {
      // Nam: Quần dài suông + Thắt lưng + Sneakers
      const pelvisGeo = new THREE.CylinderGeometry(0.165, 0.175, 0.18, 24);
      const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
      pelvis.position.y = 0.73;
      group.add(pelvis);

      const beltGeo = new THREE.CylinderGeometry(0.168, 0.168, 0.035, 24);
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 });
      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.position.y = 0.79;
      group.add(belt);

      const buckleGeo = new THREE.BoxGeometry(0.04, 0.03, 0.015);
      const buckleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
      const buckle = new THREE.Mesh(buckleGeo, buckleMat);
      buckle.position.set(0, 0.79, 0.17);
      group.add(buckle);

      // Hai ống quần dài suông xuống tận mắt cá
      [-1, 1].forEach((side) => {
        const legX = side * 0.095;

        const pantsLegGeo = new THREE.CylinderGeometry(0.075, 0.055, 1.05, 16);
        const pantsLeg = new THREE.Mesh(pantsLegGeo, pantsMat);
        pantsLeg.position.set(legX, 0.15, 0);
        pantsLeg.castShadow = true;
        group.add(pantsLeg);

        // Giày thể thao Sneakers
        const shoeGeo = new THREE.BoxGeometry(0.085, 0.075, 0.19);
        const shoe = new THREE.Mesh(shoeGeo, shoeMat);
        shoe.position.set(legX, -0.38, 0.03);
        group.add(shoe);

        const soleGeo = new THREE.BoxGeometry(0.088, 0.02, 0.195);
        const soleMat = new THREE.MeshStandardMaterial({ color: 0x0d9488 });
        const sole = new THREE.Mesh(soleGeo, soleMat);
        sole.position.set(legX, -0.41, 0.03);
        group.add(sole);
      });
    }

    // Áp dụng tỷ lệ chiều cao ban đầu
    applyHeightScale(group, userHeight);
  };

  const handleResetView = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = 0;
  };
  const handleTurnBack = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = Math.PI;
  };

  // Nút tăng giảm nhanh chiều cao trực tiếp
  const handleAdjustHeight = (delta) => {
    const newH = Math.max(120, Math.min(220, (Number(heightCm) || 170) + delta));
    if (onHeightChange) {
      onHeightChange(newH);
    }
  };

  // Tính vị trí vạch laser theo chiều cao
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
            Mô hình 3D Cơ thể người
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
            <span className="w-3 h-0.5 bg-teal-300 shadow-[0_0_8px_#2dd4bf]" />
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

        {/* Chú thích kéo chuột */}
        <div className="absolute bottom-2 text-center w-full pointer-events-none z-20">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-[10px] text-slate-400 border border-white/10 shadow-md">
            Kéo chuột để xoay 360° xung quanh cơ thể
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
