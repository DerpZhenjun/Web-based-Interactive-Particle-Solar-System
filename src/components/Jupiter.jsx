import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

// ==========================================
// 气态巨行星与伽利略卫星着色器 
// ==========================================
const vertexShader = `
  attribute vec4 aParams; // x: size, y: opacity, z: speed multiplier, w: type
  attribute float aRandomId;
  
  varying float vType; 
  varying float vEdgeGlow; 
  varying vec3 vWorldPos;
  varying float vRandom;
  varying float vViewZ;
  varying float vOpacity;

  uniform float uTime; 
  uniform float uScale; 
  uniform float uRotationX; 
  uniform float uRotationY; 

  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }
  const float PI = 3.14159265359;

  void main() {
      vec3 pos = position; 
      float type = aParams.w; 
      vRandom = aRandomId;
      vOpacity = aParams.y; // 传递原始透明度给片元
      
      // ==========================================
      // 1. 动力系统：木星本体与卫星轨道
      // ==========================================
      if (type == 0.0) {
          // 【木星：差异化自转条带】
          float latitude = asin(normalize(pos).y);
          float windZone = sin(latitude * 14.0);
          float windSpeed = sign(windZone) * (abs(windZone) * 0.6 + 0.4) * 0.6;
          pos.xz = rotate2d(uTime * 0.15 + uTime * windSpeed * aParams.z) * pos.xz;
          pos.y += sin(uTime * 2.0 + pos.x * 2.0) * 0.05;
      } 
      else if (type == 1.0) {
          // 【木星：大红斑】
          pos.xy = rotate2d(uTime * 2.5) * pos.xy;
          float tilt = -0.38; 
          float cy = cos(tilt), sy = sin(tilt);
          float ry = pos.y * cy - pos.z * sy;
          float rz = pos.y * sy + pos.z * cy;
          pos.y = ry; pos.z = rz;
          pos.xz = rotate2d(uTime * 0.08) * pos.xz;
      }
      else if (type == 2.0) {
          // 【木星：外层大气辉光】
          pos.xz = rotate2d(uTime * 0.1) * pos.xz;
          pos += normalize(pos) * sin(uTime * 1.5 + aRandomId * 10.0) * 0.3;
      }
      else if (type >= 3.0) {
          // 【四颗伽利略卫星轨道公转】
          // aParams.z 存储了各个卫星独有的公转速度
          pos.xz = rotate2d(uTime * aParams.z) * pos.xz;
          
          // 卫星微观动态特征
          if (type == 3.0 && aParams.y < 0.5) {
              // 木卫一 (Io) 火山喷发：向外随机喷射的微小抖动
              pos += normalize(pos) * fract(uTime * 3.0 + aRandomId) * 0.6;
          } 
          else if (type == 5.0 && aParams.y < 0.5) {
              // 木卫三 (Ganymede) 磁场光晕：缓慢的呼吸膨胀
              pos += normalize(pos) * sin(uTime * 2.0 + aRandomId) * 0.3;
          }
      }

      // ==========================================
      // 2. 交互视角锁定
      // ==========================================
      float cx = cos(uRotationX), sx = sin(uRotationX);
      float ry = pos.y * cx - pos.z * sx; float rz = pos.y * sx + pos.z * cx; pos.y = ry; pos.z = rz;
      
      float cy = cos(uRotationY), sy = sin(uRotationY);
      float rx = pos.x * cy + pos.z * sy; rz = -pos.x * sy + pos.z * cy; pos.x = rx; pos.z = rz;

      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      vec3 viewNormal = normalize(normalMatrix * normalize(pos));
      vViewZ = viewNormal.z; 
      vEdgeGlow = 1.0 - max(dot(normalize(-mvPosition.xyz), viewNormal), 0.0); 

      float dist = -mvPosition.z;
      
      float pSize = aParams.x;
      if (type == 1.0) pSize *= 0.8; 
      else if (type == 2.0) pSize *= 2.5; 
      
      gl_PointSize = clamp(pSize * (150.0 / dist), 0.0, 40.0);
      vType = type; 
      vWorldPos = pos;
  }
`;

const fragmentShader = `
  varying float vType; 
  varying float vEdgeGlow;
  varying vec3 vWorldPos;
  varying float vRandom;
  varying float vViewZ;
  varying float vOpacity;

  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      
      // 背面剔除 (保留边缘的大气发光层，以及所有卫星)
      if (vType < 2.0 && vViewZ < -0.15) discard; 
      // 卫星的地表也需要剔除背面，光晕/火山喷发不剔除
      if (vType >= 3.0 && vOpacity > 0.5 && vViewZ < -0.1) discard;

      float alpha = exp(-r2 * 2.5) * 1.0; 
      vec3 finalColor = vec3(1.0);

      // ==========================================
      // 木星本体渲染
      // ==========================================
      if (vType == 0.0) {
          float lat = asin(normalize(vWorldPos).y);
          float turbulence = sin(vWorldPos.x * 2.0 + vRandom * 5.0) * 0.1;
          float bandPattern = sin(lat * 14.0 + turbulence);
          
          vec3 cream = vec3(0.88, 0.83, 0.75);
          vec3 brown = vec3(0.55, 0.35, 0.22);
          vec3 ochre = vec3(0.78, 0.55, 0.35);
          vec3 white = vec3(0.92, 0.9, 0.88);

          if (bandPattern > 0.4) {
              finalColor = mix(cream, white, (bandPattern - 0.4) * 1.6);
          } else if (bandPattern > -0.4) {
              finalColor = mix(ochre, cream, (bandPattern + 0.4) * 1.25);
          } else {
              finalColor = mix(brown, ochre, (bandPattern + 1.0) * 1.6);
          }
          alpha *= 0.9;
      } 
      else if (vType == 1.0) {
          vec3 coreRed = vec3(0.85, 0.25, 0.15);
          vec3 outerOrange = vec3(0.8, 0.45, 0.2);
          finalColor = mix(coreRed, outerOrange, vRandom);
          alpha *= 0.95;
      }
      else if (vType == 2.0) {
          finalColor = vec3(0.95, 0.85, 0.65);
          alpha *= 0.15 + pow(vEdgeGlow, 3.0) * 0.4; 
      }
      
      // ==========================================
      // 伽利略卫星专属渲染材质
      // ==========================================
      else if (vType == 3.0) {
          // 【木卫一: Io】 黄橙底色 + 黑斑硫磺
          if (vOpacity < 0.5) {
              // 火山喷流
              finalColor = vec3(1.0, 0.9, 0.3);
              alpha *= 0.5;
          } else {
              vec3 ioYellow = vec3(0.95, 0.8, 0.1);
              vec3 ioOrange = vec3(0.8, 0.4, 0.05);
              vec3 ioBlack = vec3(0.1, 0.1, 0.1);
              
              float spots = fract(sin(vWorldPos.y * 18.0 + vRandom * 50.0) * 43758.5);
              if (spots > 0.93) {
                  finalColor = ioBlack; // 巨大火山口
              } else {
                  finalColor = mix(ioYellow, ioOrange, sin(vWorldPos.y * 5.0 + vRandom));
              }
              alpha *= 1.0;
          }
      }
      else if (vType == 4.0) {
          // 【木卫二: Europa】 冰晶高亮 + 褐红裂纹
          vec3 euWhite = vec3(0.95, 0.98, 1.0);
          vec3 euBrown = vec3(0.5, 0.2, 0.1);
          
          // 纵横交错的带状特征
          float crack = sin(vWorldPos.y * 12.0 + sin(vRandom * 25.0)) * cos(vWorldPos.y * 8.0);
          if (abs(crack) < 0.15) {
              finalColor = euBrown;
          } else {
              finalColor = mix(euWhite, vec3(0.85, 0.9, 0.95), vRandom);
          }
          alpha *= 1.0;
      }
      else if (vType == 5.0) {
          // 【木卫三: Ganymede】 铁灰表面 + 微弱紫晕磁场
          if (vOpacity < 0.5) {
              finalColor = vec3(0.7, 0.6, 0.9); // 紫晕
              alpha *= 0.25;
          } else {
              vec3 darkGrey = vec3(0.35, 0.35, 0.38);
              vec3 lightGrey = vec3(0.65, 0.65, 0.68);
              float terrain = sin(vWorldPos.y * 6.0 + vRandom * 15.0);
              finalColor = mix(darkGrey, lightGrey, (terrain + 1.0) * 0.5);
              alpha *= 1.0;
          }
      }
      else if (vType == 6.0) {
          // 【木卫四: Callisto】 暗黑底色 + 纯白高光陨石坑
          vec3 caDark = vec3(0.2, 0.15, 0.12);
          vec3 caWhite = vec3(1.0, 1.0, 1.0);
          
          float craters = fract(sin(vWorldPos.y * 25.0 + vRandom * 120.0) * 43758.5);
          if (craters > 0.96) {
              finalColor = caWhite; // 新鲜撞击坑
          } else {
              finalColor = mix(caDark, vec3(0.1, 0.05, 0.05), vRandom);
          }
          alpha *= 1.0;
      }

      gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function Jupiter() {
  const pointsRef = useRef(); // 【新增】：获取底层 WebGL 的 Points 对象
  const materialRef = useRef();

  const { positions, params, randomIds } = useMemo(() => {
    const particles = 250000; 
    const pos = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    
    const R_Equator = 15.0; 
    const R_Pole = 14.0; 

    let currentIndex = 0;

    // --- 【新增模块：伽利略卫星生成器】 ---
    const createMoon = (moonRadius, orbitRadius, count, type, orbitSpeed, hasHalo = false) => {
        for(let j = 0; j < count; j++) {
            let idx = currentIndex;
            rIds[idx] = Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            const theta = 2 * Math.PI * Math.random();
            
            // 是否是光晕/火山喷流层
            let isHaloLayer = hasHalo && j > count * 0.8;
            let currentRadius = isHaloLayer ? moonRadius * 1.3 : moonRadius * (0.95 + Math.random() * 0.1);

            // 本地坐标生成后，推移到轨道半径位置 (X轴方向)
            let lx = currentRadius * Math.sin(phi) * Math.cos(theta);
            let ly = currentRadius * Math.cos(phi);
            let lz = currentRadius * Math.sin(phi) * Math.sin(theta);
            
            pos[idx*3] = lx + orbitRadius;
            pos[idx*3+1] = ly;
            pos[idx*3+2] = lz;

            let size = isHaloLayer ? 3.5 : 2.5;
            let op = isHaloLayer ? 0.3 : 1.0;

            prms[idx*4] = size; 
            prms[idx*4+1] = op; 
            prms[idx*4+2] = orbitSpeed; // 借用 speed 字段存储公转速度
            prms[idx*4+3] = type; 
            
            currentIndex++;
        }
    };

    // 生成四颗卫星 (分配共计 14,000 粒子)
    // 1. 木卫一 (Io)：极近、极快、有火山喷发层
    createMoon(0.7, 21.0, 3000, 3.0, 1.2, true); 
    // 2. 木卫二 (Europa)：冰冻星球
    createMoon(0.6, 26.0, 3000, 4.0, 0.8, false);
    // 3. 木卫三 (Ganymede)：最大、有磁场光晕
    createMoon(1.0, 33.0, 5000, 5.0, 0.5, true);
    // 4. 木卫四 (Callisto)：极远、极慢
    createMoon(0.8, 41.0, 3000, 6.0, 0.3, false);

    // ==========================================
    // 恢复原有的木星本体逻辑
    // ==========================================
    // 1. 生成大红斑
    const grsCount = 15000;
    for(let i = 0; i < grsCount; i++) {
        rIds[currentIndex] = Math.random();
        const angle = Math.random() * Math.PI * 2;
        const radiusX = Math.random() * 3.5; 
        const radiusY = Math.random() * 1.8; 
        
        let lx = Math.cos(angle) * radiusX;
        let ly = Math.sin(angle) * radiusY;
        let lz = Math.sqrt(Math.max(0, R_Equator * R_Equator - lx * lx - ly * ly)); 
        
        pos[currentIndex*3] = lx;
        pos[currentIndex*3+1] = ly;
        pos[currentIndex*3+2] = lz; 

        prms[currentIndex*4] = 2.0 + Math.random(); 
        prms[currentIndex*4+1] = 1.0; 
        prms[currentIndex*4+2] = 1.0; 
        prms[currentIndex*4+3] = 1.0; 
        currentIndex++;
    }

    // 2. 生成外层朦胧气态边缘 
    const glowCount = 35000;
    for(let i = 0; i < glowCount; i++) {
        rIds[currentIndex] = Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        
        let glowR = R_Equator * (1.02 + Math.random() * 0.08);
        pos[currentIndex*3] = glowR * Math.sin(phi) * Math.cos(theta);
        pos[currentIndex*3+1] = glowR * Math.cos(phi) * (R_Pole / R_Equator); 
        pos[currentIndex*3+2] = glowR * Math.sin(phi) * Math.sin(theta);
        
        prms[currentIndex*4] = 3.5; 
        prms[currentIndex*4+1] = 0.3; 
        prms[currentIndex*4+2] = 1.0; 
        prms[currentIndex*4+3] = 2.0; 
        currentIndex++;
    }

    // 3. 生成木星本体条带
    for(let i = currentIndex; i < particles; i++) {
        rIds[i] = Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        
        let coreR = R_Equator * (0.98 + Math.random() * 0.02);
        
        pos[i*3] = coreR * Math.sin(phi) * Math.cos(theta);
        pos[i*3+1] = coreR * Math.cos(phi) * (R_Pole / R_Equator); 
        pos[i*3+2] = coreR * Math.sin(phi) * Math.sin(theta);
        
        prms[i*4] = 2.5 + Math.random() * 1.0; 
        prms[i*4+1] = 1.0; 
        prms[i*4+2] = 0.8 + Math.random() * 0.4; 
        prms[i*4+3] = 0.0; 
    }
    return { positions: pos, params: prms, randomIds: rIds };
  }, []);

  const config = useMemo(() => ({ currentScale: 1.0, currentRotX: 0.2, currentRotY: 0.0, autoIdleTime: 0 }), []);

  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;
    
    // 【核心黑科技 1：瞬态读取】绕过 React 直接获取当前视图
    const globalState = useGestureStore.getState();
    const isVisible = globalState.currentView === 'JUPITER';
    
    // 【核心黑科技 2：底层控制】直接开关 GPU 的可见性
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】如果不可见，直接 return，阻断所有计算！
    if (!isVisible) return;

    const { systemState, smoothedPinchDist, smoothedPalmX, smoothedPalmY } = globalState;
    let targetScale = 1.0, targetRotX = 0.2, targetRotY = 0.0;

    if (systemState === 'IDLE') {
        config.autoIdleTime += 0.01;
        targetScale = 1.0 + Math.sin(config.autoIdleTime * 0.8) * 0.05;
        targetRotX = 0.05 + Math.sin(config.autoIdleTime * 0.3) * 0.05;
        targetRotY = Math.sin(config.autoIdleTime * 0.2) * 0.2; 
    } else if (systemState === 'TRACKING') {
        targetScale = 0.15 + Math.max(0, Math.min(1, (smoothedPinchDist - 0.02) / 0.18)) * 2.6;
        targetRotY = -(smoothedPalmX - 0.5) * Math.PI * 2.5; 
        targetRotX = (smoothedPalmY - 0.5) * Math.PI * 1.5; 
    } else if (systemState === 'FROZEN') {
        targetScale = config.currentScale; targetRotX = config.currentRotX; targetRotY = config.currentRotY;
    }

    config.currentScale += (targetScale - config.currentScale) * 0.15;
    config.currentRotX += (targetRotX - config.currentRotX) * 0.15;
    config.currentRotY += (targetRotY - config.currentRotY) * 0.15;

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uScale.value = config.currentScale;
    materialRef.current.uniforms.uRotationX.value = config.currentRotX;
    materialRef.current.uniforms.uRotationY.value = config.currentRotY;
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, 
    uScale: { value: 1.0 }, 
    uRotationX: { value: 0.2 }, 
    uRotationY: { value: 0.0 }
  }), []);

  return (
    // 【新增】：将 pointsRef 绑定，增加 frustumCulled={false} 防止误裁剪
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aParams" count={params.length / 4} array={params} itemSize={4} />
        <bufferAttribute attach="attributes-aRandomId" count={randomIds.length} array={randomIds} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}