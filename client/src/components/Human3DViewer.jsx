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
  User,
  Footprints
} from 'lucide-react';

/**
 * 3D Human Body Viewer (Form người Việt Nam - Tóc Sidepart 7/3, Áo thun trắng, Quần đen / Váy)
 * - Nam: Áo thun trắng, quần đen, giày thể thao, tóc sidepart 7/3 gọn gàng lịch lãm chuẩn nam thần Việt.
 * - Nữ: Áo thun trắng, chân váy xòe đen, giày búp bê/sneaker, tóc xõa buộc nửa đầu duyên dáng.
 * - Góc máy rộng thấy trọn vẹn từ đầu, thân, toàn bộ đôi chân xuống đến bục đứng.
 * - Chỉ hiện thông tin khi trỏ/chạm vào Đầu (Nhiệt độ), Thân (Huyết áp & Tim), Chân (Cân nặng & BMI).
 * - Co dãn theo chiều cao thực tế (heightCm), xoay 360 độ mượt mà.
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

  // Vùng cơ thể đang tương tác: 'HEAD' | 'TORSO' | 'LEGS' | null
  const [hoveredZone, setHoveredZone] = useState(null);
  const [pinnedZone, setPinnedZone] = useState(null);
  const activeZone = hoveredZone || pinnedZone;

  // Tham chiếu Three.js
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const humanGroupRef = useRef(null);
  const bodyMeshGroupRef = useRef(null);
  const heartMeshRef = useRef(null);
  const heartLightRef = useRef(null);
  const zoneMarkerRef = useRef(null);
  const chestMeshRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const raycastMeshesRef = useRef([]);

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
  const genderTitle = isFemale 
    ? 'Nữ giới • Form người Việt (Áo thun trắng & Chân váy)' 
    : 'Nam giới • Form người Việt (Sidepart 7/3, Áo thun trắng & Quần đen)';

  // Khởi tạo Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 480;

    // 1. SCENE & CAMERA (Góc máy tối ưu thấy trọn vẹn toàn bộ cơ thể và chân)
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // FOV 37 và camera lùi nhẹ ra sau (z: 3.75, y: 0.6) để nhìn rõ cả chân và bục
    const camera = new THREE.PerspectiveCamera(37, width / height, 0.1, 1000);
    camera.position.set(0, 0.62, 3.75);
    camera.lookAt(0, 0.42, 0);
    cameraRef.current = camera;

    // 2. RENDERER (PBR Tone Mapping, Khử răng cưa, đổ bóng mềm)
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

    // 3. HỆ THỐNG ÁNH SÁNG 3 ĐIỂM STUDIO
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.7);
    keyLight.position.set(2.5, 6, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.05);
    fillLight.position.set(-3.5, 4, 3);
    scene.add(fillLight);

    const backRimLight = new THREE.DirectionalLight(0x14b8a6, 1.45);
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

    // Vòng tròn mục tiêu Holographic khi trỏ chuột vào
    const markerGeo = new THREE.RingGeometry(0.06, 0.08, 32);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const zoneMarker = new THREE.Mesh(markerGeo, markerMat);
    zoneMarker.visible = false;
    scene.add(zoneMarker);
    zoneMarkerRef.current = zoneMarker;

    // 5. NHÓM ĐỐI TƯỢNG NGƯỜI
    const humanGroup = new THREE.Group();
    scene.add(humanGroup);
    humanGroupRef.current = humanGroup;

    const bodyMeshGroup = new THREE.Group();
    humanGroup.add(bodyMeshGroup);
    bodyMeshGroupRef.current = bodyMeshGroup;

    raycastMeshesRef.current = [];

    // 6. DỰNG MÔ HÌNH CHUẨN FORM NGƯỜI VIỆT NAM
    buildVietnameseHuman(bodyMeshGroup, gender, heightCm);

    // 7. RAYCASTER BẮT ĐIỂM TƯƠNG TÁC ĐẦU - THÂN - CHÂN
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let dragDist = 0;

    const detectBodyZone = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(raycastMeshesRef.current, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const worldPos = hit.point;

        const floorY = -0.89;
        const currentH = 1.68 * ((Number(heightCm) || 170) / 170);
        const relativeY = worldPos.y - floorY;
        const ratio = relativeY / currentH;

        let zone = null;
        if (ratio >= 0.72) {
          zone = 'HEAD'; // ĐẦU (Thân nhiệt)
        } else if (ratio >= 0.40) {
          zone = 'TORSO'; // THÂN (Huyết áp & Tim mạch)
        } else {
          zone = 'LEGS'; // CHÂN (Cân nặng & BMI)
        }

        if (zoneMarkerRef.current) {
          zoneMarkerRef.current.position.copy(worldPos);
          zoneMarkerRef.current.position.z += 0.02;
          zoneMarkerRef.current.lookAt(camera.position);
          zoneMarkerRef.current.visible = true;
        }

        return zone;
      }

      if (zoneMarkerRef.current) {
        zoneMarkerRef.current.visible = false;
      }
      return null;
    };

    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      dragDist = 0;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (isDraggingRef.current && humanGroupRef.current) {
        const deltaX = e.clientX - previousMousePositionRef.current.x;
        dragDist += Math.abs(deltaX);
        humanGroupRef.current.rotation.y += deltaX * 0.012;
        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        renderer.domElement.style.cursor = 'grabbing';
      } else {
        const zone = detectBodyZone(e.clientX, e.clientY);
        if (zone) {
          renderer.domElement.style.cursor = 'pointer';
          setHoveredZone(zone);
        } else {
          renderer.domElement.style.cursor = isDraggingRef.current ? 'grabbing' : 'grab';
          setHoveredZone(null);
        }
      }
    };

    const handleMouseUp = (e) => {
      isDraggingRef.current = false;
      renderer.domElement.style.cursor = 'grab';
      if (dragDist < 5) {
        const zone = detectBodyZone(e.clientX, e.clientY);
        setPinnedZone((prev) => (prev === zone ? null : zone));
      }
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        dragDist = 0;
        previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e) => {
      if (!isDraggingRef.current || !humanGroupRef.current || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePositionRef.current.x;
      dragDist += Math.abs(deltaX);
      humanGroupRef.current.rotation.y += deltaX * 0.012;
      previousMousePositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      const zone = detectBodyZone(e.touches[0].clientX, e.touches[0].clientY);
      setHoveredZone(zone);
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('touchstart', handleTouchStart);
    dom.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    // 8. ANIMATION LOOP
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Tự động xoay chậm nhẹ nhàng
      if (isAutoRotating && !isDraggingRef.current && humanGroupRef.current) {
        humanGroupRef.current.rotation.y += 0.005;
      }

      // Trái tim đập phát sáng (nhanh hơn khi trỏ vào ngực)
      if (heartMeshRef.current && heartLightRef.current) {
        const isChest = hoveredZone === 'TORSO' || pinnedZone === 'TORSO';
        const speed = isChest ? 6.5 : 4.5;
        const pulse = Math.max(0, Math.sin(elapsed * speed)) + Math.max(0, Math.sin(elapsed * speed + 0.3)) * 0.4;
        const scale = 1 + pulse * (isChest ? 0.35 : 0.2);
        heartMeshRef.current.scale.set(scale, scale, scale);
        heartLightRef.current.intensity = (isChest ? 2.5 : 1.2) + pulse * 2.2;
      }

      // Hô hấp phập phồng nhẹ nhàng ở lồng ngực
      if (chestMeshRef.current) {
        const breath = Math.sin(elapsed * 1.6);
        chestMeshRef.current.scale.set(1 + breath * 0.015, 1, 1 + breath * 0.025);
      }

      // Toàn thân phập phồng tự nhiên
      if (bodyMeshGroupRef.current) {
        bodyMeshGroupRef.current.position.y = Math.sin(elapsed * 1.6) * 0.007;
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

  // Co dãn tỷ lệ chiều cao
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
  // XÂY DỰNG MÔ HÌNH CHUẨN FORM NGƯỜI VIỆT NAM:
  // - Nam: Áo thun trắng, Quần đen, Giày, Tóc sidepart 7/3 lịch lãm gọn gàng.
  // - Nữ: Áo thun trắng, Chân váy xòe, Giày, Tóc xõa buộc nửa đầu duyên dáng.
  // =========================================================================
  const buildVietnameseHuman = (group, userGender, userHeight) => {
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

    // 1. TONE DA NGƯỜI VIỆT NAM (Warm Natural Asian Skin)
    const skinMat = new THREE.MeshStandardMaterial({
      color: isFem ? 0xfce7d4 : 0xf6cca9,
      roughness: 0.52,
      metalness: 0.04,
    });

    // 2. MÀU TÓC ĐEN Á ĐÔNG (Dark Espresso / Natural Black Hair)
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x181615,
      roughness: 0.6,
      metalness: 0.1,
    });

    // 3. MẮT ĐEN LÁY & MÔI HỒNG TỰ NHIÊN
    const eyeIrisMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.2,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lipMat = new THREE.MeshBasicMaterial({ color: isFem ? 0xf472b6 : 0xde8c7c });

    // 4. TRANG PHỤC THEO YÊU CẦU:
    // ÁO THUN TRẮNG COTTON TINH KHÔI CHO CẢ NAM VÀ NỮ
    const whiteTShirtMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.72,
      metalness: 0.03,
    });

    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.65,
    });

    // QUẦN ĐEN TÂY/JEANS ĐỨNG DÁNG CHO NAM
    const blackPantsMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.75,
      metalness: 0.05,
    });

    // CHÂN VÁY ĐEN XÒE THANH LỊCH CHO NỮ
    const blackSkirtMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.65,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

    // GIÀY SNEAKER TRẮNG CHO NAM & BÚP BÊ/SNEAKER CHO NỮ
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.15,
    });

    const soleBlackMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.5,
    });

    // ----------------------------------------------------
    // A. NHÓM ĐẦU & KHUÔN MẶT CHUẨN NÉT VIỆT NAM
    // ----------------------------------------------------
    const headGroup = new THREE.Group();

    // Đầu & Mặt
    const headGeo = new THREE.SphereGeometry(0.125, 32, 24);
    headGeo.scale(1, 1.22, 1.05);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.35;
    head.castShadow = true;
    headGroup.add(head);
    raycastMeshesRef.current.push(head);

    // Đôi mắt người Việt đen láy có hồn
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

      // Lông mày đen tỉa gọn
      const browGeo = new THREE.BoxGeometry(0.038, 0.006, 0.01);
      const brow = new THREE.Mesh(browGeo, hairMat);
      brow.position.set(xOffset, 1.412, 0.12);
      brow.rotation.z = (xOffset > 0 ? -1 : 1) * 0.08;
      headGroup.add(brow);
    });

    // Mũi dọc dừa thanh tú
    const noseGeo = new THREE.ConeGeometry(0.01, 0.022, 8);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.328, 0.134);
    headGroup.add(nose);

    // Môi
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

    // ----------------------------------------------------
    // KIỂU TÓC THEO YÊU CẦU CHÍNH XÁC:
    // ----------------------------------------------------
    if (isFem) {
      // NỮ: TÓC DÀI XÕA QUA VAI + PHẦN TRÊN BUỘC TÚM NỬA ĐẦU GỌN GÀNG DUYÊN DÁNG
      // Tóc trên đầu
      const femaleHairTop = new THREE.SphereGeometry(0.142, 24, 16);
      femaleHairTop.scale(1.02, 1.22, 1.15);
      const hairTop = new THREE.Mesh(femaleHairTop, hairMat);
      hairTop.position.set(0, 1.39, -0.01);
      headGroup.add(hairTop);

      // Phần tóc buộc túm cao phía sau (Half-up ponytail)
      const tieGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.12, 16);
      const tieMesh = new THREE.Mesh(tieGeo, hairMat);
      tieMesh.position.set(0, 1.44, -0.12);
      tieMesh.rotation.x = -0.4;
      headGroup.add(tieMesh);

      // Dây nơ buộc tóc đỏ xinh xắn
      const bowGeo = new THREE.SphereGeometry(0.024, 12, 12);
      const bowMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
      const bow = new THREE.Mesh(bowGeo, bowMat);
      bow.position.set(0, 1.48, -0.11);
      headGroup.add(bow);

      // Các lọn tóc xõa buông dài tự nhiên qua hai bên vai
      [-0.11, 0.11].forEach((xSide) => {
        const sideHairGeo = new THREE.CylinderGeometry(0.04, 0.02, 0.36, 12);
        const sideHair = new THREE.Mesh(sideHairGeo, hairMat);
        sideHair.position.set(xSide, 1.18, 0.02);
        sideHair.rotation.z = (xSide > 0 ? -1 : 1) * 0.12;
        headGroup.add(sideHair);
      });

      // Lớp tóc xõa dài phía sau lưng
      const backHairGeo = new THREE.CylinderGeometry(0.11, 0.07, 0.48, 16);
      const backHair = new THREE.Mesh(backHairGeo, hairMat);
      backHair.position.set(0, 1.12, -0.1);
      backHair.rotation.x = -0.12;
      headGroup.add(backHair);

    } else {
      // NAM: TÓC SIDEPART 7/3 GỌN GÀNG LỊCH LÃM
      // Khối tóc cơ bản
      const maleHairGeo = new THREE.SphereGeometry(0.138, 24, 16);
      maleHairGeo.scale(1.05, 1.2, 1.1);
      const maleHair = new THREE.Mesh(maleHairGeo, hairMat);
      maleHair.position.set(0, 1.42, 0);
      headGroup.add(maleHair);

      // Ngôi rẽ 7/3: Phần mái 70% vuốt phồng bồng bềnh sang phải
      const part7Geo = new THREE.BoxGeometry(0.13, 0.065, 0.09);
      const part7 = new THREE.Mesh(part7Geo, hairMat);
      part7.position.set(0.045, 1.465, 0.095);
      part7.rotation.z = -0.15;
      part7.rotation.x = 0.22;
      headGroup.add(part7);

      // Ngôi rẽ 7/3: Phần mái 30% chải mượt ép gọn sang trái
      const part3Geo = new THREE.BoxGeometry(0.065, 0.055, 0.08);
      const part3 = new THREE.Mesh(part3Geo, hairMat);
      part3.position.set(-0.065, 1.455, 0.085);
      part3.rotation.z = 0.25;
      part3.rotation.x = 0.18;
      headGroup.add(part3);

      // Viền mai hai bên tỉa gọn gàng thanh lịch
      [-0.125, 0.125].forEach((sideX) => {
        const sideBurnGeo = new THREE.BoxGeometry(0.02, 0.06, 0.04);
        const sideBurn = new THREE.Mesh(sideBurnGeo, hairMat);
        sideBurn.position.set(sideX, 1.36, 0.03);
        headGroup.add(sideBurn);
      });
    }

    group.add(headGroup);

    // Cổ
    const neckGeo = new THREE.CylinderGeometry(0.052, 0.06, 0.1, 16);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = 1.19;
    group.add(neck);

    // ----------------------------------------------------
    // B. NHÓM THÂN: ÁO THUN TRẮNG (FORM NGƯỜI VIỆT NAM)
    // ----------------------------------------------------
    const chestGroup = new THREE.Group();

    // Bờ vai người Việt vừa vặn, thanh mảnh (Nam: 0.46, Nữ: 0.38)
    const shoulderWidth = isFem ? 0.38 : 0.46;
    const waistWidth = isFem ? 0.24 : 0.30;

    // Thân áo thun trắng
    const shirtGeo = new THREE.CylinderGeometry(
      shoulderWidth / 2,
      waistWidth / 2,
      0.38,
      24
    );
    shirtGeo.scale(1, 1, 0.85);
    const shirt = new THREE.Mesh(shirtGeo, whiteTShirtMat);
    shirt.position.y = 0.98;
    shirt.castShadow = true;
    chestGroup.add(shirt);
    chestMeshRef.current = shirt;
    raycastMeshesRef.current.push(shirt);

    // Viền cổ áo thun tròn tinh tế
    const collarGeo = new THREE.TorusGeometry(0.08, 0.015, 12, 24);
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.16, 0.01);
    chestGroup.add(collar);

    if (isFem) {
      [-0.065, 0.065].forEach((offset) => {
        const bustGeo = new THREE.SphereGeometry(0.065, 16, 16);
        const bust = new THREE.Mesh(bustGeo, whiteTShirtMat);
        bust.position.set(offset, 1.02, 0.08);
        chestGroup.add(bust);
      });
    }

    // Trái tim 3D phát sáng ở lồng ngực trái
    const heartGeo = new THREE.SphereGeometry(0.038, 16, 16);
    const heartMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.position.set(0.06, 1.04, 0.1);
    chestGroup.add(heartMesh);
    heartMeshRef.current = heartMesh;

    const heartLight = new THREE.PointLight(0xff1744, 2.2, 1.4);
    heartLight.position.set(0.06, 1.04, 0.16);
    chestGroup.add(heartLight);
    heartLightRef.current = heartLight;

    // Cánh tay áo thun trắng ngắn tay
    [-1, 1].forEach((side) => {
      const sleeveGeo = new THREE.CylinderGeometry(0.058, 0.052, 0.14, 16);
      const sleeve = new THREE.Mesh(sleeveGeo, whiteTShirtMat);
      sleeve.position.set(side * (shoulderWidth / 2 + 0.03), 1.07, 0);
      sleeve.rotation.z = side * -0.22;
      chestGroup.add(sleeve);

      const armGeo = new THREE.CylinderGeometry(0.042, 0.032, 0.44, 16);
      const arm = new THREE.Mesh(armGeo, skinMat);
      arm.position.set(side * (shoulderWidth / 2 + 0.075), 0.82, 0.02);
      arm.rotation.z = side * -0.16;
      chestGroup.add(arm);

      const handGeo = new THREE.SphereGeometry(0.036, 16, 16);
      handGeo.scale(0.8, 1.2, 0.5);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.set(side * (shoulderWidth / 2 + 0.1), 0.56, 0.04);
      chestGroup.add(hand);
    });

    group.add(chestGroup);

    // ----------------------------------------------------
    // C. PHẦN DƯỚI: NỮ MẶC VÁY ĐEN - NAM MẶC QUẦN ĐEN (THẤY RÕ TOÀN BỘ CHÂN)
    // ----------------------------------------------------
    const lowerGroup = new THREE.Group();

    if (isFem) {
      // NỮ: CHÂN VÁY ĐEN XÒE CHỮ A THANH LỊCH
      const waistBandGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.06, 24);
      const waistBandMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5 });
      const waistBand = new THREE.Mesh(waistBandGeo, waistBandMat);
      waistBand.position.y = 0.76;
      lowerGroup.add(waistBand);

      // Tùng chân váy xòe chữ A màu đen
      const skirtGeo = new THREE.CylinderGeometry(0.15, 0.38, 0.38, 32, 1, true);
      const skirt = new THREE.Mesh(skirtGeo, blackSkirtMat);
      skirt.position.y = 0.56;
      skirt.castShadow = true;
      lowerGroup.add(skirt);
      raycastMeshesRef.current.push(skirt);

      // Đôi chân thon dài nuột nà của người con gái Việt
      [-1, 1].forEach((side) => {
        const legX = side * 0.085;

        // Chân trần lộ dưới váy
        const legGeo = new THREE.CylinderGeometry(0.044, 0.034, 0.82, 16);
        const leg = new THREE.Mesh(legGeo, skinMat);
        leg.position.set(legX, 0.05, 0);
        leg.castShadow = true;
        lowerGroup.add(leg);
        raycastMeshesRef.current.push(leg);

        // Giày sneaker trắng nữ tính có nơ
        const shoeGeo = new THREE.BoxGeometry(0.075, 0.06, 0.16);
        const shoe = new THREE.Mesh(shoeGeo, shoeMat);
        shoe.position.set(legX, -0.38, 0.03);
        lowerGroup.add(shoe);

        const soleGeo = new THREE.BoxGeometry(0.078, 0.018, 0.165);
        const sole = new THREE.Mesh(soleGeo, soleBlackMat);
        sole.position.set(legX, -0.41, 0.03);
        lowerGroup.add(sole);

        const bowGeo = new THREE.SphereGeometry(0.012, 8, 8);
        const bowMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
        const bow = new THREE.Mesh(bowGeo, bowMat);
        bow.position.set(legX, -0.34, 0.09);
        lowerGroup.add(bow);
      });

    } else {
      // NAM: QUẦN ĐEN SUÔNG ĐỨNG DÁNG + THẮT LƯNG DA + GIÀY SNEAKER
      const pelvisGeo = new THREE.CylinderGeometry(0.165, 0.175, 0.18, 24);
      const pelvis = new THREE.Mesh(pelvisGeo, blackPantsMat);
      pelvis.position.y = 0.73;
      lowerGroup.add(pelvis);
      raycastMeshesRef.current.push(pelvis);

      // Thắt lưng da đen
      const beltGeo = new THREE.CylinderGeometry(0.168, 0.168, 0.035, 24);
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 });
      const belt = new THREE.Mesh(beltGeo, beltMat);
      belt.position.y = 0.79;
      lowerGroup.add(belt);

      // Khóa thắt lưng kim loại bạc
      const buckleGeo = new THREE.BoxGeometry(0.04, 0.03, 0.015);
      const buckleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
      const buckle = new THREE.Mesh(buckleGeo, buckleMat);
      buckle.position.set(0, 0.79, 0.17);
      lowerGroup.add(buckle);

      // Hai ống quần đen suông dài xuống tận mắt cá chân
      [-1, 1].forEach((side) => {
        const legX = side * 0.095;

        const pantsLegGeo = new THREE.CylinderGeometry(0.075, 0.055, 1.05, 16);
        const pantsLeg = new THREE.Mesh(pantsLegGeo, blackPantsMat);
        pantsLeg.position.set(legX, 0.15, 0);
        pantsLeg.castShadow = true;
        lowerGroup.add(pantsLeg);
        raycastMeshesRef.current.push(pantsLeg);

        // Giày thể thao Sneakers trắng năng động
        const shoeGeo = new THREE.BoxGeometry(0.085, 0.075, 0.19);
        const shoe = new THREE.Mesh(shoeGeo, shoeMat);
        shoe.position.set(legX, -0.38, 0.03);
        lowerGroup.add(shoe);

        // Đế giày đen viền teal thời trang
        const soleGeo = new THREE.BoxGeometry(0.088, 0.02, 0.195);
        const sole = new THREE.Mesh(soleGeo, soleBlackMat);
        sole.position.set(legX, -0.41, 0.03);
        lowerGroup.add(sole);
      });
    }

    group.add(lowerGroup);

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
            Mô hình 3D • Chuẩn nét người Việt
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

      {/* KHÔNG GIAN 3D WEBGL CONTAINER (THẤY RÕ TOÀN THÂN & CHÂN) */}
      <div className="relative my-2 w-full h-[450px] sm:h-[500px] flex items-center justify-center select-none overflow-hidden rounded-2xl">
        <div ref={mountRef} className="w-full h-full" />

        {/* THƯỚC ĐO LASER CHIỀU CAO (BÊN TRÁI) */}
        <div className="absolute left-2 top-8 bottom-12 flex flex-col justify-between text-[10px] font-mono text-teal-400/80 pointer-events-none border-l border-teal-500/30 pl-1.5 z-20">
          <span className="flex items-center gap-1">
            <span className="w-2 h-px bg-teal-400" /> 220 cm
          </span>

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
        {/* CHỈ HIỆN THÔNG TIN KHI TRỎ / CHẠM VÀO ĐẦU - THÂN - CHÂN         */}
        {/* ============================================================== */}

        {/* 1. THẺ VÙNG ĐẦU -> HIỆN NHIỆT ĐỘ THÂN THỂ */}
        {activeZone === 'HEAD' && (
          <div className="absolute right-3 top-4 z-30 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border-2 border-amber-400 shadow-2xl shadow-amber-500/25 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
            <div className="flex items-center justify-between gap-3 text-amber-400 font-bold text-[11px]">
              <div className="flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-amber-400" />
                <span>VÙNG ĐẦU • THÂN NHIỆT</span>
              </div>
              <span className="text-[9px] bg-amber-500/20 px-1.5 py-0.2 rounded text-amber-300">Trán</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-white">{tempDisplay}</span>
              <span className="text-xs text-slate-400">°C</span>
            </div>
            <div className="text-[10px] text-slate-300">
              Nhiệt độ cơ thể duy trì mức an toàn
            </div>
            <span className="inline-block text-[9px] font-semibold text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/30">
              ✓ Thân nhiệt ổn định
            </span>
          </div>
        )}

        {/* 2. THẺ VÙNG THÂN -> HIỆN HUYẾT ÁP & NHỊP TIM */}
        {activeZone === 'TORSO' && (
          <div className="absolute right-3 top-28 sm:top-32 z-30 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border-2 border-rose-400 shadow-2xl shadow-rose-500/25 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
            <div className="flex items-center justify-between gap-3 text-rose-400 font-bold text-[11px]">
              <div className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 fill-rose-500 text-rose-500 animate-pulse" />
                <span>VÙNG THÂN • TIM MẠCH</span>
              </div>
              <span className="text-[9px] bg-rose-500/20 px-1.5 py-0.2 rounded text-rose-300">Lồng ngực</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-white">{bpDisplay}</span>
              <span className="text-xs text-slate-400">mmHg</span>
            </div>
            <div className="text-[11px] text-slate-200 flex items-center gap-1.5 font-semibold">
              <Activity className="w-3.5 h-3.5 text-teal-400 animate-spin" style={{ animationDuration: '3s' }} />
              <span>Nhịp tim: <strong className="text-teal-300">{hrDisplay} bpm</strong></span>
            </div>
            <span className="inline-block text-[9px] font-semibold text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/30">
              ✓ Huyết áp ổn định
            </span>
          </div>
        )}

        {/* 3. THẺ VÙNG CHÂN -> HIỆN CÂN NẶNG & CHỈ SỐ BMI */}
        {activeZone === 'LEGS' && (
          <div className="absolute left-10 bottom-8 z-30 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border-2 border-teal-400 shadow-2xl shadow-teal-500/25 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
            <div className="flex items-center justify-between gap-3 text-teal-300 font-bold text-[11px]">
              <div className="flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-teal-400" />
                <span>VÙNG CHÂN • THỂ TRẠNG</span>
              </div>
              <span className="text-[9px] bg-teal-500/20 px-1.5 py-0.2 rounded text-teal-300">Chi dưới</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-white">{weightDisplay}</span>
              <span className="text-xs text-slate-400">kg</span>
              <span className="text-xs text-teal-300 font-bold ml-1.5">
                (BMI {bmiDisplay})
              </span>
            </div>
            <div className="text-[10px] text-slate-300">
              Chiều cao {heightCm} cm & cân nặng chuẩn form
            </div>
            <span className="inline-block text-[9px] font-semibold text-teal-300 bg-teal-950/90 px-2 py-0.5 rounded border border-teal-500/30">
              ✓ Thể trạng cân đối
            </span>
          </div>
        )}

        {/* BẢNG CHỌN VÙNG NHANH Ở DƯỚI CHÂN BỤC ĐỨNG */}
        <div className="absolute bottom-2 z-20 flex items-center justify-center gap-1.5 w-full pointer-events-auto px-4">
          <button
            type="button"
            onClick={() => setPinnedZone(pinnedZone === 'HEAD' ? null : 'HEAD')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
              activeZone === 'HEAD'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30 scale-105'
                : 'bg-slate-900/80 backdrop-blur-md text-amber-300 border-amber-500/40 hover:bg-slate-800'
            }`}
          >
            <User className="w-3 h-3" />
            <span>Đầu (Nhiệt độ)</span>
          </button>

          <button
            type="button"
            onClick={() => setPinnedZone(pinnedZone === 'TORSO' ? null : 'TORSO')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
              activeZone === 'TORSO'
                ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30 scale-105'
                : 'bg-slate-900/80 backdrop-blur-md text-rose-300 border-rose-500/40 hover:bg-slate-800'
            }`}
          >
            <Heart className="w-3 h-3" />
            <span>Thân (Tim mạch)</span>
          </button>

          <button
            type="button"
            onClick={() => setPinnedZone(pinnedZone === 'LEGS' ? null : 'LEGS')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
              activeZone === 'LEGS'
                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md shadow-teal-500/30 scale-105'
                : 'bg-slate-900/80 backdrop-blur-md text-teal-300 border-teal-500/40 hover:bg-slate-800'
            }`}
          >
            <Footprints className="w-3 h-3" />
            <span>Chân (Cân nặng)</span>
          </button>
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
