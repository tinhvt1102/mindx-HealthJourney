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
  UserCheck
} from 'lucide-react';

/**
 * 3D Human Avatar (Three.js WebGL)
 * Tạo hình con người thật đầy đủ quần áo:
 * - Nam: Áo thun, quần dài, tóc ngắn thể thao, giày sneakers.
 * - Nữ: Áo thun, chân váy xòe nữ tính, tóc dài duyên dáng, giày búp bê.
 * Kèm HUD thông số y tế: Nhiệt độ, Huyết áp, Nhịp tim, Cân nặng & BMI.
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

  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const humanGroupRef = useRef(null);
  const heartMeshRef = useRef(null);
  const heartLightRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  // Lấy chỉ số mới nhất hoặc số chuẩn y tế
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

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 1000);
    camera.position.set(0, 0.9, 3.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Ánh sáng tự nhiên như studio chụp ảnh người thật
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
    keyLight.position.set(3, 7, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.9);
    fillLight.position.set(-4, 4, 3);
    scene.add(fillLight);

    const backRimLight = new THREE.DirectionalLight(0x0d9488, 1.0);
    backRimLight.position.set(0, 5, -5);
    scene.add(backRimLight);

    // Sàn bục gỗ / gạch studio sạch đẹp
    const stageGeo = new THREE.CylinderGeometry(0.72, 0.8, 0.05, 36);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.3,
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.y = -0.92;
    scene.add(stage);

    const glowRingGeo = new THREE.RingGeometry(0.74, 0.8, 48);
    const glowRingMat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const glowRing = new THREE.Mesh(glowRingGeo, glowRingMat);
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = -0.89;
    scene.add(glowRing);

    // Nhóm đối tượng người 3D
    const humanGroup = new THREE.Group();
    scene.add(humanGroup);
    humanGroupRef.current = humanGroup;

    // Dựng người thật Nam / Nữ
    buildRealisticPerson(humanGroup, gender, heightCm);

    // Kéo xoay 360 độ
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

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Tự động xoay nhẹ nhàng
      if (isAutoRotating && !isDraggingRef.current && humanGroupRef.current) {
        humanGroupRef.current.rotation.y += 0.005;
      }

      // Trái tim đập phát sáng
      if (heartMeshRef.current && heartLightRef.current) {
        const pulse = Math.sin(elapsed * 4.2) * 0.5 + 0.5;
        const scale = 1 + pulse * 0.25;
        heartMeshRef.current.scale.set(scale, scale, scale);
        heartLightRef.current.intensity = 1.0 + pulse * 1.5;
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
  }, []);

  // Cập nhật khi giới tính hoặc chiều cao đổi
  useEffect(() => {
    if (humanGroupRef.current) {
      buildRealisticPerson(humanGroupRef.current, gender, heightCm);
    }
  }, [gender, heightCm]);

  // =========================================================================
  // XÂY DỰNG MÔ HÌNH CON NGƯỜI THẬT:
  // - NAM: Áo thun (T-shirt), quần dài (trousers), tóc nam gọn gàng, giày sneakers
  // - NỮ: Áo thun (T-shirt), chân váy xòe (pleated skirt), tóc dài nữ tính, giày búp bê
  // =========================================================================
  const buildRealisticPerson = (group, userGender, userHeight) => {
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

    // 1. TONE DA NGƯỜI THỰC TẾ (Soft Natural Human Skin)
    const skinTone = isFemale ? 0xfce2ce : 0xf4caaa;
    const skinMat = new THREE.MeshStandardMaterial({
      color: skinTone,
      roughness: 0.6,
      metalness: 0.05,
    });

    // 2. MÀU TÓC (Natural Dark Chestnut / Black Hair)
    const hairColor = isFemale ? 0x2b1d14 : 0x1c1917;
    const hairMat = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.75,
      metalness: 0.1,
    });

    // 3. MẮT & MẶT
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const lipMat = new THREE.MeshBasicMaterial({ color: isFemale ? 0xf472b6 : 0xe09880 });

    // 4. TRANG PHỤC NGƯỜI THẬT:
    // Nam: Áo thun trắng/teal phối quần dài đen/xám than (jeans/chinos) + Sneaker
    // Nữ: Áo thun hồng pastel phối chân váy xòe xếp ly xanh navy/tím than + Giày búp bê
    const shirtColor = isFemale ? 0xf472b6 : 0x0f766e; // Nữ: áo thun hồng pastel, Nam: áo thun xanh teal
    const shirtMat = new THREE.MeshStandardMaterial({
      color: shirtColor,
      roughness: 0.7,
      metalness: 0.05,
    });

    const collarMat = new THREE.MeshStandardMaterial({
      color: isFemale ? 0xfbcfe8 : 0x115e59,
      roughness: 0.6,
    });

    const pantsColor = 0x1e293b; // Nam: Quần dài màu xanh than / jeans đậm
    const pantsMat = new THREE.MeshStandardMaterial({
      color: pantsColor,
      roughness: 0.75,
      metalness: 0.05,
    });

    const skirtColor = 0x312e81; // Nữ: Váy xòe màu tím than / xanh navy thanh lịch
    const skirtMat = new THREE.MeshStandardMaterial({
      color: skirtColor,
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const shoeMat = new THREE.MeshStandardMaterial({
      color: isFemale ? 0xec4899 : 0xffffff,
      roughness: 0.35,
      metalness: 0.2,
    });

    // Tỷ lệ vóc dáng theo chiều cao
    const heightRatio = Math.max(0.7, Math.min(1.4, (userHeight || 170) / 170));
    group.scale.set(heightRatio, heightRatio, heightRatio);

    // ==========================================
    // A. ĐẦU & KHUÔN MẶT CON NGƯỜI
    // ==========================================
    const headGeo = new THREE.SphereGeometry(0.125, 32, 24);
    headGeo.scale(1, 1.22, 1.05);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.35;
    group.add(head);

    // Đôi mắt tròn có hồn (Friendly stylized eyes)
    [-0.045, 0.045].forEach((xOffset) => {
      const eyeGeo = new THREE.SphereGeometry(0.016, 16, 16);
      eyeGeo.scale(1, 1.3, 0.5);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(xOffset, 1.37, 0.12);
      group.add(eye);

      // Điểm sáng trong mắt (Eye sparkle)
      const shineGeo = new THREE.SphereGeometry(0.005, 8, 8);
      const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const shine = new THREE.Mesh(shineGeo, shineMat);
      shine.position.set(xOffset + 0.004, 1.375, 0.127);
      group.add(shine);

      // Lông mày
      const browGeo = new THREE.BoxGeometry(0.035, 0.006, 0.01);
      const brow = new THREE.Mesh(browGeo, hairMat);
      brow.position.set(xOffset, 1.405, 0.12);
      brow.rotation.z = (xOffset > 0 ? -1 : 1) * 0.05;
      group.add(brow);
    });

    // Nụ cười thân thiện (Friendly Smile)
    const mouthGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.006, 16, 1, false, 0, Math.PI);
    const mouth = new THREE.Mesh(mouthGeo, lipMat);
    mouth.rotation.x = Math.PI / 2;
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 1.28, 0.122);
    group.add(mouth);

    // Mũi nhỏ xinh
    const noseGeo = new THREE.ConeGeometry(0.012, 0.025, 8);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.325, 0.135);
    group.add(nose);

    // Đôi tai người
    [-0.13, 0.13].forEach((earX) => {
      const earGeo = new THREE.SphereGeometry(0.028, 12, 12);
      earGeo.scale(0.5, 1, 0.8);
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.position.set(earX, 1.35, 0);
      group.add(ear);
    });

    // ==========================================
    // B. TÓC NGƯỜI THẬT
    // ==========================================
    if (isFemale) {
      // Tóc Nữ: Mái tóc bồng bềnh dài qua vai + Bờ tóc phía sau
      const femaleHairTop = new THREE.SphereGeometry(0.142, 24, 16);
      femaleHairTop.scale(1.02, 1.25, 1.15);
      const hairTop = new THREE.Mesh(femaleHairTop, hairMat);
      hairTop.position.set(0, 1.39, -0.01);
      group.add(hairTop);

      // Lọn tóc dài thả 2 bên vai
      [-0.1, 0.1].forEach((xSide) => {
        const sideHairGeo = new THREE.CylinderGeometry(0.045, 0.02, 0.32, 12);
        const sideHair = new THREE.Mesh(sideHairGeo, hairMat);
        sideHair.position.set(xSide, 1.2, 0.02);
        sideHair.rotation.z = (xSide > 0 ? -1 : 1) * 0.1;
        group.add(sideHair);
      });

      // Tóc đuôi dài sau lưng
      const backHairGeo = new THREE.CylinderGeometry(0.11, 0.07, 0.45, 16);
      const backHair = new THREE.Mesh(backHairGeo, hairMat);
      backHair.position.set(0, 1.15, -0.1);
      backHair.rotation.x = -0.15;
      group.add(backHair);

      // Kẹp nơ xinh xắn trên tóc
      const bowGeo = new THREE.SphereGeometry(0.025, 12, 12);
      const bowMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e });
      const bow = new THREE.Mesh(bowGeo, bowMat);
      bow.position.set(0.09, 1.48, 0.06);
      group.add(bow);
    } else {
      // Tóc Nam: Tóc ngắn rẽ ngôi thể thao nam tính
      const maleHairGeo = new THREE.SphereGeometry(0.138, 24, 16);
      maleHairGeo.scale(1.05, 1.2, 1.1);
      const maleHair = new THREE.Mesh(maleHairGeo, hairMat);
      maleHair.position.set(0, 1.42, 0);
      group.add(maleHair);

      // Lớp mái vuốt phía trước
      const bangsGeo = new THREE.BoxGeometry(0.18, 0.05, 0.06);
      const bangs = new THREE.Mesh(bangsGeo, hairMat);
      bangs.position.set(0, 1.48, 0.08);
      bangs.rotation.x = 0.2;
      group.add(bangs);
    }

    // ==========================================
    // C. CỔ
    // ==========================================
    const neckGeo = new THREE.CylinderGeometry(0.052, 0.06, 0.1, 16);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = 1.19;
    group.add(neck);

    // ==========================================
    // D. ÁO THUN (T-SHIRT) CHO CẢ NAM VÀ NỮ
    // ==========================================
    const shoulderWidth = isFemale ? 0.38 : 0.48;
    const waistWidth = isFemale ? 0.24 : 0.32;

    // Thân áo thun (T-shirt Body)
    const shirtGeo = new THREE.CylinderGeometry(
      shoulderWidth / 2,
      waistWidth / 2,
      0.38,
      24
    );
    shirtGeo.scale(1, 1, 0.85);
    const shirt = new THREE.Mesh(shirtGeo, shirtMat);
    shirt.position.y = 0.98;
    group.add(shirt);

    // Viền cổ áo thun tròn (Crew Neck Collar)
    const collarGeo = new THREE.TorusGeometry(0.08, 0.015, 12, 24);
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.16, 0.01);
    group.add(collar);

    // Riêng Nữ: Đường cong ngực áo thun nữ tính
    if (isFemale) {
      [-0.065, 0.065].forEach((offset) => {
        const bustGeo = new THREE.SphereGeometry(0.065, 16, 16);
        const bust = new THREE.Mesh(bustGeo, shirtMat);
        bust.position.set(offset, 1.02, 0.08);
        group.add(bust);
      });
    }

    // Trái tim phát sáng nhấp nháy bên ngực trái
    const heartGeo = new THREE.SphereGeometry(0.038, 16, 16);
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.position.set(0.06, 1.04, 0.1);
    group.add(heartMesh);
    heartMeshRef.current = heartMesh;

    const heartLight = new THREE.PointLight(0xff1744, 2.0, 1.2);
    heartLight.position.set(0.06, 1.04, 0.14);
    group.add(heartLight);
    heartLightRef.current = heartLight;

    // ==========================================
    // E. TAY ÁO THUN VÀ CÁNH TAY NGƯỜI
    // ==========================================
    [-1, 1].forEach((side) => {
      // Ống tay áo thun ngắn (Short Sleeves)
      const sleeveGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.14, 16);
      const sleeve = new THREE.Mesh(sleeveGeo, shirtMat);
      sleeve.position.set(side * (shoulderWidth / 2 + 0.03), 1.07, 0);
      sleeve.rotation.z = side * -0.22;
      group.add(sleeve);

      // Cánh tay da lộ ra dưới tay áo ngắn
      const armGeo = new THREE.CylinderGeometry(0.044, 0.034, 0.44, 16);
      const arm = new THREE.Mesh(armGeo, skinMat);
      arm.position.set(side * (shoulderWidth / 2 + 0.075), 0.82, 0.02);
      arm.rotation.z = side * -0.16;
      group.add(arm);

      // Bàn tay người có ngón cái
      const handGeo = new THREE.SphereGeometry(0.038, 16, 16);
      handGeo.scale(0.8, 1.2, 0.5);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.set(side * (shoulderWidth / 2 + 0.1), 0.56, 0.04);
      group.add(hand);
    });

    // ==========================================
    // F. PHẦN DƯỚI: NỮ MẶC VÁY XÒE - NAM MẶC QUẦN DÀI
    // ==========================================
    if (isFemale) {
      // ----------------------------------------
      // NỮ: CHÂN VÁY XÒE (FLARED SKIRT) XINH XẮN
      // ----------------------------------------
      // Cạp váy ôm eo
      const waistBandGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.06, 24);
      const waistBandMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.5 });
      const waistBand = new THREE.Mesh(waistBandGeo, waistBandMat);
      waistBand.position.y = 0.76;
      group.add(waistBand);

      // Tùng váy xòe (Flared Pleated Skirt) hình nón cụt xòe nữ tính
      const skirtGeo = new THREE.CylinderGeometry(0.15, 0.38, 0.38, 32, 1, true);
      const skirt = new THREE.Mesh(skirtGeo, skirtMat);
      skirt.position.y = 0.56;
      group.add(skirt);

      // Đôi chân dài thon gọn lộ dưới váy xòe
      [-1, 1].forEach((side) => {
        const legX = side * 0.085;

        // Chân da (Bare Legs)
        const legGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.78, 16);
        const leg = new THREE.Mesh(legGeo, skinMat);
        leg.position.set(legX, 0.05, 0);
        group.add(leg);

        // Giày búp bê nữ tính màu hồng/trắng
        const shoeGeo = new THREE.BoxGeometry(0.075, 0.06, 0.15);
        const shoe = new THREE.Mesh(shoeGeo, shoeMat);
        shoe.position.set(legX, -0.38, 0.03);
        group.add(shoe);

        // Nơ nhỏ trên mũi giày búp bê
        const shoeBowGeo = new THREE.SphereGeometry(0.012, 8, 8);
        const shoeBow = new THREE.Mesh(shoeBowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        shoeBow.position.set(legX, -0.34, 0.09);
        group.add(shoeBow);
      });

    } else {
      // ----------------------------------------
      // NAM: QUẦN DÀI (LONG TROUSERS/PANTS)
      // ----------------------------------------
      // Phần hông/cạp quần dài
      const pelvisGeo = new THREE.CylinderGeometry(0.165, 0.175, 0.18, 24);
      const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
      pelvis.position.y = 0.73;
      group.add(pelvis);

      // Thắt lưng da nam tính
      const beltGeo = new THREE.CylinderGeometry(0.168, 0.168, 0.035, 24);
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 });
      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.position.y = 0.79;
      group.add(belt);

      // Khóa thắt lưng kim loại màu bạc
      const buckleGeo = new THREE.BoxGeometry(0.04, 0.03, 0.015);
      const buckleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
      const buckle = new THREE.Mesh(buckleGeo, buckleMat);
      buckle.position.set(0, 0.79, 0.17);
      group.add(buckle);

      // Hai ống quần dài suông xuống tận mắt cá chân
      [-1, 1].forEach((side) => {
        const legX = side * 0.095;

        // Ống quần dài (Long Trousers Leg)
        const pantsLegGeo = new THREE.CylinderGeometry(0.075, 0.055, 1.05, 16);
        const pantsLeg = new THREE.Mesh(pantsLegGeo, pantsMat);
        pantsLeg.position.set(legX, 0.15, 0);
        group.add(pantsLeg);

        // Giày thể thao Sneakers màu trắng phối đế xanh
        const shoeGeo = new THREE.BoxGeometry(0.085, 0.075, 0.19);
        const shoe = new THREE.Mesh(shoeGeo, shoeMat);
        shoe.position.set(legX, -0.38, 0.03);
        group.add(shoe);

        // Đế giày thể thao
        const soleGeo = new THREE.BoxGeometry(0.088, 0.02, 0.195);
        const soleMat = new THREE.MeshStandardMaterial({ color: 0x0d9488 });
        const sole = new THREE.Mesh(soleGeo, soleMat);
        sole.position.set(legX, -0.41, 0.03);
        group.add(sole);
      });
    }
  };

  const handleResetView = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = 0;
  };
  const handleTurnBack = () => {
    if (humanGroupRef.current) humanGroupRef.current.rotation.y = Math.PI;
  };

  const isFemale = gender === 'FEMALE';
  const genderTitle = isFemale ? 'Nữ (Áo thun & Chân váy)' : 'Nam (Áo thun & Quần dài)';

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-teal-950 rounded-3xl p-5 text-white shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Top Header Card */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-teal-400" />
            Vóc dáng & Chỉ số 3D
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
          title={isAutoRotating ? 'Dừng tự xoay' : 'Bật tự xoay 360°'}
        >
          <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
        </button>
      </div>

      {/* 3D WebGL Canvas Container + HUD CHỈ SỐ Y TẾ GẮN TRỰC DIỆN */}
      <div className="relative my-2 w-full h-[410px] sm:h-[460px] flex items-center justify-center cursor-grab active:cursor-grabbing">
        <div ref={mountRef} className="w-full h-full" />

        {/* Thước đo Laser chiều cao bên trái */}
        <div className="absolute left-2 top-10 bottom-14 flex flex-col justify-between text-[10px] font-mono text-teal-400/80 pointer-events-none border-l border-teal-500/30 pl-1.5">
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
        {/* HUD CHỈ SỐ 1: NHIỆT ĐỘ THÂN THỂ (GẮN Ở VÙNG TRÁN / ĐẦU)      */}
        {/* ============================================================== */}
        <div className="absolute right-3 top-5 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-orange-500/40 shadow-xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105">
          <div className="flex items-center gap-1.5 text-orange-400 font-bold text-[11px]">
            <Thermometer className="w-3.5 h-3.5 text-orange-400" />
            <span>Nhiệt độ</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-white">{tempDisplay}</span>
            <span className="text-[10px] text-slate-400">°C</span>
          </div>
          <span className="inline-block text-[9px] font-semibold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded">
            Thân nhiệt ổn định
          </span>
        </div>

        {/* ============================================================== */}
        {/* HUD CHỈ SỐ 2: HUYẾT ÁP & NHỊP TIM (GẮN Ở VÙNG LỒNG NGỰC/TIM)  */}
        {/* ============================================================== */}
        <div className="absolute right-3 top-32 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-rose-500/40 shadow-xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105">
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
        <div className="absolute left-10 bottom-12 p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-teal-500/40 shadow-xl text-xs space-y-0.5 pointer-events-auto transition-transform hover:scale-105">
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

        {/* Hướng dẫn kéo chuột */}
        <div className="absolute bottom-2 text-center w-full pointer-events-none">
          <span className="inline-block px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-[10px] text-slate-400 border border-white/10">
            Kéo chuột để xoay 360°
          </span>
        </div>
      </div>

      {/* Bottom Bar: Nút xoay & Nút ghi chỉ số */}
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
            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-teal-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ghi chỉ số</span>
          </button>
        )}
      </div>
    </div>
  );
}