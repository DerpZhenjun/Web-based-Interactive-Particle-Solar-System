import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

// ==========================================
// 海王星核心着色器 (深邃流体、纬度条带、大黑斑、超音速风暴、环弧)
// ==========================================
const vertexShader = `
  attribute vec4 aParams; 
  attribute vec3 customColor; 
  attribute float aRandomId;
  
  varying vec3 vColor; 
  varying float vDist; 
  varying float vOpacity; 
  varying float vScaleFactor; 
  varying float vType;
  varying float vEdgeGlow;
  varying vec3 vWorldPos;

  uniform float uTime; 
  uniform float uScale; 
  uniform float uRotationX; 
  uniform float uRotationY; 

  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }
  
  float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
      float normScaleLOD = clamp((uScale - 0.15) / 2.35, 0.0, 1.0);
      float visibilityThreshold = 0.9 + pow(normScaleLOD, 1.2) * 0.1; 
      if (aRandomId > visibilityThreshold) { 
          gl_Position = vec4(2.0, 2.0, 2.0, 0.0); 
          return; 
      }

      vec3 pos = position; 
      float type = aParams.w; 
      
      if (type == 0.0) {
          float latitude = asin(normalize(pos).y);
          float differentialSpeed = 1.0 - pow(sin(latitude * 1.5), 2.0) * 0.6; 
          
          pos.xz = rotate2d(uTime * 0.22 + uTime * differentialSpeed * aParams.z) * pos.xz;
          
          float turbulence = hash(pos + uTime * 0.3) * 0.12;
          pos += normalize(pos) * turbulence;
      } 
      else if (type == 1.0) {
          pos.xy = rotate2d(uTime * 1.5) * pos.xy;
          
          float distFromCenter = length(pos.xy);
          pos.x *= 1.0 + (distFromCenter * 0.15 * sin(uTime * 4.0 + aRandomId * 10.0));
          
          float tilt = -0.38; 
          float cy = cos(tilt), sy = sin(tilt);
          float ry = pos.y * cy - pos.z * sy;
          float rz = pos.y * sy + pos.z * cy;
          pos.y = ry; pos.z = rz;
          
          pos.xz = rotate2d(uTime * 0.18) * pos.xz;
      } 
      else if (type == 2.0) {
          pos.xz = rotate2d(uTime * 0.45) * pos.xz;
          float expansion = fract(uTime * 0.5 + aRandomId);
          pos += normalize(pos) * expansion * 2.5;
      }
      else if (type == 3.0) {
          float radius = aParams.z;
          float keplerSpeed = 15.0 / pow(radius, 1.5);
          pos.xz = rotate2d(uTime * keplerSpeed) * pos.xz;
          pos.y += sin(uTime * 2.0 + aRandomId * 20.0) * 0.05; 
      }

      float cx = cos(uRotationX), sx = sin(uRotationX);
      float ry = pos.y * cx - pos.z * sx; float rz = pos.y * sx + pos.z * cx; pos.y = ry; pos.z = rz;

      float cy = cos(uRotationY), sy = sin(uRotationY);
      float rx = pos.x * cy + pos.z * sy; rz = -pos.x * sy + pos.z * cy; pos.x = rx; pos.z = rz;

      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
      float dist = -mvPosition.z;
      
      vec3 viewNormal = normalize(normalMatrix * normalize(pos));
      vEdgeGlow = 1.0 - max(dot(normalize(-mvPosition.xyz), viewNormal), 0.0); 
      
      gl_Position = projectionMatrix * mvPosition;
      
      float pointSize = aParams.x * (200.0 / dist); 
      if (type == 1.0) pointSize *= 1.2; 
      if (type == 2.0) pointSize *= 2.0; 
      if (type == 3.0) pointSize *= 0.6; 
      
      gl_PointSize = clamp(pointSize, 0.0, 150.0);

      vColor = customColor; 
      vOpacity = aParams.y; 
      vScaleFactor = uScale; 
      vType = type; 
      vDist = dist;
      vWorldPos = pos;
  }
`;

const fragmentShader = `
  // 【修复核心】：声明 uTime，供噪波流体力学使用
  uniform float uTime; 

  varying vec3 vColor; 
  varying float vDist; 
  varying float vOpacity; 
  varying float vScaleFactor; 
  varying float vType;
  varying float vEdgeGlow;
  varying vec3 vWorldPos; 

  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      
      float glow = 1.0 - r2; 
      float t = clamp((vScaleFactor - 0.15) / 2.35, 0.0, 1.0);
      
      vec3 finalColor = vColor;
      float alpha = glow * vOpacity * (0.4 + 0.6 * t); 

      if (vType == 0.0) {
          float lat = normalize(vWorldPos).y;
          float absLat = abs(lat);
          
          vec3 cobaltBlue = vec3(0.0, 0.28, 0.67);
          vec3 deepMarine = vec3(0.0, 0.0, 0.55);
          vec3 cyanGlow = vec3(0.0, 1.0, 1.0);
          
          finalColor = deepMarine;
          
          if (absLat < 0.25) {
              float equatorialMix = smoothstep(0.0, 0.25, absLat);
              finalColor = mix(cyanGlow * 0.8, cobaltBlue, equatorialMix);
              // 现在 uTime 可以正常使用了！
              alpha *= 0.98 + sin(uTime * 5.0 + vWorldPos.x * 2.0) * 0.02;
          } 
          else if (absLat < 0.65) {
              float beltMix = smoothstep(0.25, 0.65, absLat);
              finalColor = mix(cobaltBlue * 0.7, deepMarine * 0.8, beltMix);
              alpha *= 1.0; 
          } 
          else {
              float polarMix = smoothstep(0.65, 0.95, absLat);
              finalColor = mix(deepMarine * 0.7, deepMarine * 0.5, polarMix);
              if (absLat > 0.95) {
                  finalColor = mix(finalColor, vec3(0.6, 0.9, 1.0) * 0.6, (absLat - 0.95) * 20.0);
              }
              alpha *= 0.98;
          }
          
          // 现在 uTime 可以正常使用了！
          float latNoise = sin(vWorldPos.x * 0.8 + vWorldPos.y * 3.0 + uTime * 0.5) * 0.1;
          float finalPattern = sin(vWorldPos.y * 10.0 + latNoise);
          finalColor = mix(finalColor, finalColor * 1.3, finalPattern * 0.1);

          finalColor *= (0.7 + t * 0.5); 
          alpha *= 0.98; 
      } 
      else if (vType == 1.0) {
          finalColor *= 0.15; 
          alpha *= 0.98; 
      }
      else if (vType == 2.0) {
          vec3 windGlow = vec3(0.6, 0.9, 1.0);
          finalColor = mix(vColor, windGlow, 0.6);
          alpha *= 0.2 + pow(vEdgeGlow, 3.0) * 0.5; 
      }
      else if (vType == 3.0) {
          finalColor *= 0.4; 
          alpha *= 0.35; 
      }
      
      if (vDist < 10.0) alpha *= vDist * 0.1; 
      
      gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function Neptune() {
  const pointsRef = useRef(); // 【新增】：获取底层 WebGL 的 Points 对象
  const materialRef = useRef();

  const { positions, colors, params, randomIds } = useMemo(() => {
    const particles = 250000; 
    const pos = new Float32Array(particles * 3);
    const cols = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    
    const R = 14.5; 
    
    const bodyCols = ['#00008B', '#0047AB', '#4169E1', '#00FFFF'].map(c => new THREE.Color(c));
    const spotCols = ['#000022', '#000033', '#000011'].map(c => new THREE.Color(c));
    const ringCols = ['#1A2421', '#2A3439', '#1C2833'].map(c => new THREE.Color(c));

    let currentIndex = 0;

    const spotCount = 15000;
    for(let i = 0; i < spotCount; i++) {
        rIds[currentIndex] = Math.random();
        
        const angle = Math.random() * Math.PI * 2;
        const radiusX = Math.random() * 2.8; 
        const radiusY = Math.random() * 1.5; 
        
        let lx = Math.cos(angle) * radiusX;
        let ly = Math.sin(angle) * radiusY;
        let lz = Math.sqrt(Math.max(0, R * R - lx * lx - ly * ly)); 
        
        pos[currentIndex*3] = lx;
        pos[currentIndex*3+1] = ly;
        pos[currentIndex*3+2] = lz; 
        
        let cIdx = Math.floor(Math.random() * 3);
        cols[currentIndex*3] = spotCols[cIdx].r; 
        cols[currentIndex*3+1] = spotCols[cIdx].g; 
        cols[currentIndex*3+2] = spotCols[cIdx].b; 
        
        prms[currentIndex*4] = 2.2 + Math.random(); 
        prms[currentIndex*4+1] = 1.0; 
        prms[currentIndex*4+2] = 0.0; 
        prms[currentIndex*4+3] = 1.0; 
        currentIndex++;
    }

    const ringCount = 25000;
    for(let i = 0; i < ringCount; i++) {
        rIds[currentIndex] = Math.random();
        
        let ringR = R * (1.8 + Math.random() * 0.05); 
        let theta = Math.random() * Math.PI * 2;
        
        if (Math.random() > 0.3) { 
            let arc = Math.floor(Math.random() * 3);
            theta = (arc * Math.PI * 0.6) + (Math.random() * 0.35);
        }
        
        pos[currentIndex*3] = ringR * Math.cos(theta);
        pos[currentIndex*3+1] = (Math.random() - 0.5) * 0.1; 
        pos[currentIndex*3+2] = ringR * Math.sin(theta);
        
        let cIdx = Math.floor(Math.random() * 3);
        cols[currentIndex*3] = ringCols[cIdx].r; 
        cols[currentIndex*3+1] = ringCols[cIdx].g; 
        cols[currentIndex*3+2] = ringCols[cIdx].b; 

        prms[currentIndex*4] = 1.0; 
        prms[currentIndex*4+1] = 0.6; 
        prms[currentIndex*4+2] = ringR; 
        prms[currentIndex*4+3] = 3.0; 
        currentIndex++;
    }

    const windCount = 30000;
    for(let i = 0; i < windCount; i++) {
        rIds[currentIndex] = Math.random();
        
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        
        let windR = R * (1.02 + Math.random() * 0.08);
        pos[currentIndex*3] = windR * Math.sin(phi) * Math.cos(theta);
        pos[currentIndex*3+1] = windR * Math.cos(phi); 
        pos[currentIndex*3+2] = windR * Math.sin(phi) * Math.sin(theta);
        
        cols[currentIndex*3] = 0.6; cols[currentIndex*3+1] = 0.9; cols[currentIndex*3+2] = 1.0; 

        prms[currentIndex*4] = 2.5; 
        prms[currentIndex*4+1] = 0.25; 
        prms[currentIndex*4+2] = 0.8 + Math.random() * 0.5; 
        prms[currentIndex*4+3] = 2.0; 
        currentIndex++;
    }

    const bodyCount = particles - currentIndex;
    for(let i = currentIndex; i < particles; i++) {
        rIds[i] = Math.random();
        
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        
        let coreR = R * (0.98 + Math.random() * 0.02);
        pos[i*3] = coreR * Math.sin(phi) * Math.cos(theta);
        pos[i*3+1] = coreR * Math.cos(phi); 
        pos[i*3+2] = coreR * Math.sin(phi) * Math.sin(theta);
        
        let cIdx = Math.floor(Math.random() * 3); 
        cols[i*3] = bodyCols[cIdx].r; 
        cols[i*3+1] = bodyCols[cIdx].g; 
        cols[i*3+2] = bodyCols[cIdx].b; 
        
        prms[i*4] = 2.2 + Math.random() * 0.8; 
        prms[i*4+1] = 0.95; 
        prms[i*4+2] = 0.8 + Math.random() * 0.4; 
        prms[i*4+3] = 0.0; 
    }

    return { positions: pos, colors: cols, params: prms, randomIds: rIds };
  }, []);

  const config = useMemo(() => ({ currentScale: 1.0, currentRotX: 0.2, currentRotY: 0.0, autoIdleTime: 0 }), []);

  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;
    
    // 【核心黑科技 1：瞬态读取】绕过 React 直接获取当前视图
    const globalState = useGestureStore.getState();
    const isVisible = globalState.currentView === 'NEPTUNE';
    
    // 【核心黑科技 2：底层控制】直接开关 GPU 的可见性
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】如果不可见，直接 return，阻断所有计算！
    if (!isVisible) return;

    const { systemState, smoothedPinchDist, smoothedPalmX, smoothedPalmY } = globalState;
    let targetScale = 1.0, targetRotX = 0.2, targetRotY = 0.0;

    if (systemState === 'IDLE') {
        config.autoIdleTime += 0.01;
        targetScale = 0.95 + Math.sin(config.autoIdleTime) * 0.05;
        targetRotX = 0.3 + Math.sin(config.autoIdleTime * 0.3) * 0.1;
        targetRotY = Math.sin(config.autoIdleTime * 0.2) * 0.3; 
    } else if (systemState === 'TRACKING') {
        targetScale = 0.15 + Math.max(0, Math.min(1, (smoothedPinchDist - 0.02) / 0.18)) * 2.6;
        targetRotY = -(smoothedPalmX - 0.5) * Math.PI * 2.5; 
        targetRotX = (smoothedPalmY - 0.5) * Math.PI * 1.5; 
    } else if (systemState === 'FROZEN') {
        targetScale = config.currentScale; targetRotX = config.currentRotX; targetRotY = config.currentRotY;
    }

    config.currentScale += (targetScale - config.currentScale) * 0.2;
    config.currentRotX += (targetRotX - config.currentRotX) * 0.2;
    config.currentRotY += (targetRotY - config.currentRotY) * 0.2;

    // 同步 uTime 给 Fragment Shader
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
        <bufferAttribute attach="attributes-customColor" count={colors.length / 3} array={colors} itemSize={3} />
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