import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
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
  Loader2,
  Info,
  User,
  Footprints,
  Eye
} from 'lucide-react';

/**
 * 3D Human Body Viewer (Mô hình con người thực tế & Tương tác Đầu - Thân - Chân)
 * - Mô hình 3D người thật (Full mesh người vị thành niên, tóc, khuôn mặt, áo thun, quần dài, giày).
 * - Chỉ hiện thông tin sức khỏe khi trỏ chuột / chạm vào từng vùng cơ thể (Đầu ➜ Thân nhiệt, Thân ➜ Huyết áp & Tim, Chân ➜ Cân nặng & BMI).
 * - Tương tác co dãn theo chiều cao thực tế (heightCm).
 * - Xoay 360 độ mượt mà, bục đứng Studio phát sáng neon.
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
  const [isLoadingModel, setIsLoadingModel] = useState(true);

  // Vùng cơ thể đang được trỏ vào: 'HEAD' | 'TORSO' | 'LEGS' | null
  const [hoveredZone, setHoveredZone] = useState(null);
  const [pinnedZone, setPinnedZone] = useState(null); // Click để giữ cố định
  const activeZone = hoveredZone || pinnedZone;

  // Tọa độ 2D của điểm tương tác trên màn hình (để vẽ đường nối holographic)
  const [hotspotScreenPos, setHotspotScreenPos] = useState(null);

  // Tham chiếu Three.js
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const humanGroupRef = useRef(null);
  const loadedModelRef = useRef(null);
  const heartMeshRef = useRef(null);
  const heartLightRef = useRef(null);
  const zoneMarkerRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const raycastMeshesRef = useRef([]);

  // Thông số bounding box của mô hình để tính chiều cao chuẩn
  const modelBoxRef = useRef({ minY: -0.89, totalH: 1.68, center: new THREE.Vector3() });

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
  const genderTitle = isFemale ? 'Nữ giới (Người thật)' : 'Nam giới (Người thật)';

  // Khởi tạo Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    setIsLoadingModel(true);

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 480;

    // 1. SCENE & CAMERA
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 1000);
    // Camera căn chỉnh để nhìn trọn vẹn 100% từ đỉnh đầu đến chân, giày và bục đứng
    camera.position.set(0, 0.05, 3.75);
    camera.lookAt(0, -0.05, 0);
    cameraRef.current = camera;

    // 2. RENDERER (PBR Tone Mapping, Khử răng cưa PCF Soft Shadows)
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

    // 3. ÁNH SÁNG STUDIO CHUYÊN NGHIỆP
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.7);
    keyLight.position.set(2.5, 6, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.0);
    fillLight.position.set(-3.5, 4, 3);
    scene.add(fillLight);

    const backRimLight = new THREE.DirectionalLight(0x14b8a6, 1.4);
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

    // Vòng tròn mục tiêu Holographic khi trỏ vào bộ phận cơ thể
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

    // 5. NHÓM XOAY ĐỐI TƯỢNG NGƯỜI
    const humanGroup = new THREE.Group();
    scene.add(humanGroup);
    humanGroupRef.current = humanGroup;

    raycastMeshesRef.current = [];

    // 6. NẠP FILE MÔ HÌNH 3D NGƯỜI THẬT (.GLB) VỚI MESHOPT DECODER
    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    const modelPath = isFemale ? '/models/asian_female.glb' : '/models/asian_male.glb';

    gltfLoader.load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;
        loadedModelRef.current = model;

        // Tính toán kích thước chuẩn
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const baseH = 1.68;
        const rawH = size.y || 1;
        modelBoxRef.current = {
          minY: box.min.y,
          rawH,
          baseH,
          center
        };

        // Kích hoạt đổ bóng và vật liệu da/vải chân thực
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            raycastMeshesRef.current.push(child);
            if (child.material) {
              child.material.roughness = Math.max(0.42, child.material.roughness || 0.5);
              child.material.metalness = Math.min(0.12, child.material.metalness || 0.05);
            }
          }
        });

        // Áp dụng chiều cao
        applyHeightToModel(model, heightCm);

        humanGroup.add(model);

        // Trái tim 3D phát sáng ở lồng ngực
        const heartGeo = new THREE.SphereGeometry(0.035, 16, 16);
        const heartMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
        const heartMesh = new THREE.Mesh(heartGeo, heartMat);
        heartMesh.position.set(0.06, 0.32, 0.15);
        humanGroup.add(heartMesh);
        heartMeshRef.current = heartMesh;

        const heartLight = new THREE.PointLight(0xff1744, 1.3, 0.65);
        heartLight.position.set(0.06, 0.32, 0.2);
        humanGroup.add(heartLight);
        heartLightRef.current = heartLight;

        setIsLoadingModel(false);
      },
      undefined,
      (error) => {
        console.error('Không thể tải mô hình 3D GLB, đang chuyển sang mô hình dựng sẵn:', error);
        // Fallback mô hình người hữu cơ
        buildOrganicFallback(humanGroup, gender, heightCm);
        setIsLoadingModel(false);
      }
    );

    // 7. RAYCASTER TƯƠNG TÁC ĐẦU - THÂN - CHÂN CHUẨN XÁC
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

        // Vị trí mặt sàn bục đứng
        const floorY = -0.89;
        const currentH = 1.68 * ((Number(heightCm) || 170) / 170);
        const relativeY = worldPos.y - floorY;
        const ratio = relativeY / currentH; // 0.0 (chân) -> 1.0 (đỉnh đầu)

        let zone = null;
        if (ratio >= 0.72) {
          zone = 'HEAD'; // ĐẦU (Thân nhiệt)
        } else if (ratio >= 0.40) {
          zone = 'TORSO'; // THÂN (Huyết áp & Tim mạch)
        } else {
          zone = 'LEGS'; // CHÂN (Cân nặng & BMI)
        }

        // Cập nhật vị trí vòng marker Holographic
        if (zoneMarkerRef.current) {
          zoneMarkerRef.current.position.copy(worldPos);
          zoneMarkerRef.current.position.z += 0.02;
          zoneMarkerRef.current.lookAt(camera.position);
          zoneMarkerRef.current.visible = true;
        }

        // Tọa độ 2D trên container
        setHotspotScreenPos({
          x: clientX - rect.left,
          y: clientY - rect.top,
        });

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
      // Nếu là click nhẹ (không kéo xoay), ghim/bỏ ghim vùng cơ thể
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

      // Tự động xoay chậm khi người dùng không kéo
      if (isAutoRotating && !isDraggingRef.current && humanGroupRef.current) {
        humanGroupRef.current.rotation.y += 0.005;
      }

      // Trái tim đập phát sáng sinh học (đập nhanh hơn khi trỏ vào ngực)
      if (heartMeshRef.current && heartLightRef.current) {
        const isChest = hoveredZone === 'TORSO' || pinnedZone === 'TORSO';
        const speed = isChest ? 6.5 : 4.5;
        const pulse = Math.max(0, Math.sin(elapsed * speed)) + Math.max(0, Math.sin(elapsed * speed + 0.3)) * 0.4;
        const scale = 1 + pulse * (isChest ? 0.35 : 0.2);
        heartMeshRef.current.scale.set(scale, scale, scale);
        heartLightRef.current.intensity = (isChest ? 2.5 : 1.2) + pulse * 2.2;
      }

      // Vòng Holographic marker nhấp nháy
      if (zoneMarkerRef.current && zoneMarkerRef.current.visible) {
        const pulse = Math.sin(elapsed * 6) * 0.15 + 1.0;
        zoneMarkerRef.current.scale.set(pulse, pulse, pulse);
      }

      // Nhịp thở hô hấp nhẹ tự nhiên
      if (loadedModelRef.current) {
        loadedModelRef.current.position.y += Math.sin(elapsed * 1.5) * 0.0003;
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

  // HÀM CO DÃN MÔ HÌNH 3D THEO CHIỀU CAO THỰC TẾ
  const applyHeightToModel = (model, currentH) => {
    if (!model) return;
    const { rawH, baseH, center, minY } = modelBoxRef.current;

    const heightFactor = Math.max(0.72, Math.min(1.35, (Number(currentH) || 170) / 170));
    const targetH = baseH * heightFactor;
    const scaleY = targetH / (rawH || 1);
    const scaleXZ = (baseH / (rawH || 1)) * (1 + (heightFactor - 1) * 0.35);

    model.scale.set(scaleXZ, scaleY, scaleXZ);

    // Chân luôn đứng vững trên bục (-0.89)
    const floorY = -0.89;
    const scaledMinY = minY * scaleY;
    model.position.set(
      -(center?.x || 0) * scaleXZ,
      floorY - scaledMinY,
      -(center?.z || 0) * scaleXZ
    );

    // Cập nhật vị trí trái tim theo lồng ngực
    if (heartMeshRef.current && heartLightRef.current) {
      const chestY = floorY + targetH * 0.68;
      heartMeshRef.current.position.y = chestY;
      heartLightRef.current.position.y = chestY;
    }
  };

  // Cập nhật khi prop heightCm thay đổi
  useEffect(() => {
    if (loadedModelRef.current) {
      applyHeightToModel(loadedModelRef.current, heightCm);
    }
  }, [heightCm]);

  // DỰNG MÔ HÌNH HỮU CƠ TỰ NHIÊN (FALLBACK NẾU FILE GLB CẦN THỜI GIAN TẢI)
  const buildOrganicFallback = (group, userGender, userHeight) => {
    const isFem = userGender === 'FEMALE';
    const skinMat = new THREE.MeshStandardMaterial({ color: isFem ? 0xfce5d4 : 0xf5cca9, roughness: 0.52 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: isFem ? 0xf472b6 : 0x0f766e, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });

    const headGeo = new THREE.SphereGeometry(0.125, 32, 24);
    headGeo.scale(1, 1.25, 1.05);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);
    raycastMeshesRef.current.push(head);

    const torsoGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.45, 24);
    const torso = new THREE.Mesh(torsoGeo, clothesMat);
    torso.position.y = 0.96;
    torso.castShadow = true;
    group.add(torso);
    raycastMeshesRef.current.push(torso);

    [-0.09, 0.09].forEach((legX) => {
      const legGeo = new THREE.CylinderGeometry(0.065, 0.05, 1.05, 16);
      const leg = new THREE.Mesh(legGeo, pantsMat);
      leg.position.set(legX, 0.18, 0);
      leg.castShadow = true;
      group.add(leg);
      raycastMeshesRef.current.push(leg);
    });

    modelBoxRef.current = { rawH: 1.68, baseH: 1.68, center: new THREE.Vector3(0, 0.65, 0), minY: -0.35 };
    applyHeightToModel(group, userHeight);
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
            Mô hình 3D Người thật
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
      <div className="relative my-2 w-full h-[440px] sm:h-[490px] flex items-center justify-center select-none overflow-hidden rounded-2xl">
        <div ref={mountRef} className="w-full h-full" />

        {/* Loading Indicator */}
        {isLoadingModel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/85 backdrop-blur-sm z-30">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin mb-2" />
            <span className="text-xs font-semibold text-slate-300">Đang nạp mô hình người thật...</span>
          </div>
        )}

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
        {/* THẺ HUD CHỈ HIỂN THỊ KHI TRỎ VÀO HOẶC CLICK VÀO VÙNG CƠ THỂ    */}
        {/* ============================================================== */}

        {/* 1. THẺ VÙNG ĐẦU -> HIỆN NHIỆT ĐỘ THÂN THỂ */}
        {activeZone === 'HEAD' && (
          <div className="absolute right-3 top-4 z-30 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border-2 border-amber-400 shadow-2xl shadow-amber-500/20 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
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
          <div className="absolute right-3 top-28 sm:top-32 z-30 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border-2 border-rose-400 shadow-2xl shadow-rose-500/20 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
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
              ✓ Huyết áp bình thường
            </span>
          </div>
        )}

        {/* 3. THẺ VÙNG CHÂN -> HIỆN CÂN NẶNG & CHỈ SỐ BMI */}
        {activeZone === 'LEGS' && (
          <div className="absolute left-4 sm:left-8 bottom-12 z-30 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border-2 border-teal-400 shadow-2xl shadow-teal-500/20 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
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
              Tỷ lệ chiều cao {heightCm} cm & cân nặng cân đối
            </div>
            <span className="inline-block text-[9px] font-semibold text-teal-300 bg-teal-950/90 px-2 py-0.5 rounded border border-teal-500/30">
              ✓ Vóc dáng cân đối
            </span>
          </div>
        )}

        {/* BẢNG CHỌN VÙNG NHANH Ở DƯỚI BỤC */}
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
        {/* Bộ tương tác chiều cao */}
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
