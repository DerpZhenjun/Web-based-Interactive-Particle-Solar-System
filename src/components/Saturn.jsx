import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

// ==========================================
// 极致稳定版土星 Shader (真实高对比度物理光照版)
// ==========================================
const vertexShader = `
  attribute vec4 aParams; // x: size, y: opacity, z: speed, w: isRing
  attribute vec3 customColor; 
  attribute float aRandomId;
  
  varying vec3 vColor; 
  varying float vDist; 
  varying float vOpacity; 
  varying float vScaleFactor; 
  varying float vIsRing;

  uniform float uTime; 
  uniform float uScale; 
  uniform float uRotationX; 
  uniform float uRotationY; 

  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
      // 动态 LOD (Level of Detail) 剔除
      float normScaleLOD = clamp((uScale - 0.15) / 2.35, 0.0, 1.0);
      float visibilityThreshold = 0.9 + pow(normScaleLOD, 1.2) * 0.1; 
      if (aRandomId > visibilityThreshold) { 
          gl_Position = vec4(2.0, 2.0, 2.0, 0.0); 
          return; 
      }

      vec3 pos = position; 
      float isRing = aParams.w; 
      float speed = aParams.z;
      
      // 自转逻辑
      if (isRing > 0.5) { 
          // 星环按开普勒速度旋转
          pos.xz = rotate2d(uTime * speed * 0.2) * pos.xz; 
      } else { 
          // 气态本体缓慢自转
          pos.xz = rotate2d(uTime * 0.03) * pos.xz; 
      }

      // 视角拖拽旋转
      float cx = cos(uRotationX), sx = sin(uRotationX);
      float ry = pos.y * cx - pos.z * sx; float rz = pos.y * sx + pos.z * cx; pos.y = ry; pos.z = rz;

      float cy = cos(uRotationY), sy = sin(uRotationY);
      float rx = pos.x * cy + pos.z * sy; rz = -pos.x * sy + pos.z * cy; pos.x = rx; pos.z = rz;

      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
      float dist = -mvPosition.z;
      
      // 【核心细节：近距离的混沌碎冰扰动】
      if (dist < 25.0 && dist > 0.1) {
          float chaos = pow(1.0 - (dist / 25.0), 3.0) * 3.0; 
          float ht = uTime * 40.0;
          vec3 noiseVec = vec3(
              sin(ht + pos.x * 10.0) * hash(pos.y), 
              cos(ht + pos.y * 10.0) * hash(pos.x), 
              sin(ht * 0.5) * hash(pos.z)
          );
          mvPosition.xyz += noiseVec * chaos;
      }
      
      gl_Position = projectionMatrix * mvPosition;
      
      // 动态大小计算，略微增大基础点大小以提升整体可见度
      float pointSize = aParams.x * (220.0 / dist); 
      if (isRing < 0.5 && dist < 50.0) pointSize *= 0.8; 
      gl_PointSize = clamp(pointSize, 0.0, 150.0);

      vColor = customColor; 
      vOpacity = aParams.y; 
      vScaleFactor = uScale; 
      vIsRing = isRing; 
      vDist = dist;
  }
`;

const fragmentShader = `
  varying vec3 vColor; 
  varying float vDist; 
  varying float vOpacity; 
  varying float vScaleFactor; 
  varying float vIsRing;

  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      
      float glow = 1.0 - r2; 
      float t = clamp((vScaleFactor - 0.15) / 2.35, 0.0, 1.0);
      
      // 【亮度与对比度引擎】
      // 提升基础底色亮度
      vec3 baseColor = mix(vec3(0.4, 0.25, 0.1), vColor, smoothstep(0.1, 0.9, t)); 
      
      // 核心修改：冰雪星环的高反照率 vs 气态大气的低反照率
      // 如果是星环，亮度直接拉高到 1.8 倍甚至过曝；如果是本体，维持 1.1 倍柔和光感
      float albedoMultiplier = vIsRing > 0.5 ? 1.8 : 1.1; 
      vec3 finalColor = baseColor * (0.5 + t * 0.7) * albedoMultiplier; 
      
      // 基于景深的颜色突变
      if (vDist < 40.0) {
          float closeMix = 1.0 - (vDist / 40.0);
          if (vIsRing < 0.5) {
              // 靠近本体时，本体发光适度增强，但不会盖过星环
              finalColor = mix(finalColor, vColor * 1.5, closeMix * 0.8); 
          } else {
              // 靠近星环时，冰岩杂质的灰暗感浮现，让过曝的星环展现出岩石的纹理
              finalColor += vec3(0.2, 0.18, 0.15) * closeMix;
          }
      }
      
      // 【透明度全局提亮】
      float alpha = glow * vOpacity * (0.4 + 0.6 * t); 
      // 使得星环部分更加不透明、更加实心
      if (vIsRing > 0.5) alpha *= 1.25; 
      
      // 极其靠近时强制淡出，防止遮挡镜头
      if (vDist < 10.0) alpha *= vDist * 0.1;
      
      gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function Saturn() {
  const pointsRef = useRef(); // 【新增】：获取底层 WebGL 的 Points 对象
  const materialRef = useRef();

  const { positions, colors, params, randomIds } = useMemo(() => {
    const particles = 300000; 
    const pos = new Float32Array(particles * 3);
    const cols = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    
    const R = 18; 
    const bodyCols = ['#E3DAC5', '#C9A070', '#E3DAC5', '#B08D55'].map(c => new THREE.Color(c));

    for(let i = 0; i < particles; i++) {
        let x, y, z, r, g, b, size, opacity, speed, isRingVal; 
        rIds[i] = Math.random();

        if (i < particles * 0.25) {
            // 【本体】
            isRingVal = 0.0; 
            speed = 0.0;
            const phi = Math.acos(2 * Math.random() - 1);
            const theta = 2 * Math.PI * Math.random();
            
            x = R * Math.sin(phi) * Math.cos(theta); 
            y = R * Math.cos(phi) * 0.9; 
            z = R * Math.sin(phi) * Math.sin(theta);
            
            let lat = (y / R + 1.0) * 0.5; 
            let cIdx = Math.max(0, Math.floor(lat * 4 + Math.cos(lat * 40.0)*0.8) % 4);
            
            r = bodyCols[cIdx].r; 
            g = bodyCols[cIdx].g; 
            b = bodyCols[cIdx].b; 
            // 略微调大本体粒子基础尺寸，填补缝隙
            size = 1.2 + Math.random() * 0.8; 
            opacity = 0.8; 
        } 
        else {
            // 【星环】 - 提亮基础颜色设置
            isRingVal = 1.0; 
            let zR = Math.random();
            let ringR;
            
            if (zR < 0.15) { 
                ringR = R * (1.235 + Math.random() * 0.29); 
                r = 0.25; g = 0.22; b = 0.20; size = 0.6; opacity = 0.4; 
            }
            else if (zR < 0.65) { 
                // 主亮环 B环 颜色更趋近纯白/亮冰色
                ringR = R * (1.525 + Math.random() * 0.425); 
                r = 0.95; g = 0.90; b = 0.85; size = 0.9 + Math.random() * 0.6; opacity = 0.9; 
            }
            else if (zR < 0.69) { 
                ringR = R * (1.95 + Math.random() * 0.075); 
                r = 0.02; g = 0.02; b = 0.02; size = 0.3; opacity = 0.1; 
            }
            else if (zR < 0.99) { 
                ringR = R * (2.025 + Math.random() * 0.245); 
                r = 0.75; g = 0.72; b = 0.68; size = 0.8; opacity = 0.7; 
            }
            else { 
                ringR = R * (2.32 + Math.random() * 0.02); 
                r = 0.85; g = 0.85; b = 0.80; size = 1.0; opacity = 0.8; 
            }
            
            const theta = Math.random() * Math.PI * 2;
            x = ringR * Math.cos(theta); 
            z = ringR * Math.sin(theta); 
            y = (Math.random() - 0.5) * (ringR > R * 2.3 ? 0.4 : 0.15);
            
            speed = 8.0 / Math.sqrt(ringR);
        }
        
        pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z; 
        cols[i*3]=r; cols[i*3+1]=g; cols[i*3+2]=b;
        
        let pIdx = i * 4; 
        prms[pIdx] = size; 
        prms[pIdx+1] = opacity; 
        prms[pIdx+2] = speed; 
        prms[pIdx+3] = isRingVal;
    }
    return { positions: pos, colors: cols, params: prms, randomIds: rIds };
  }, []);

  const config = useMemo(() => ({ currentScale: 1.0, currentRotX: 0.4, currentRotY: 0.0, autoIdleTime: 0 }), []);

  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;
    
    // 【核心黑科技 1：瞬态读取】绕过 React 直接获取当前视图
    const globalState = useGestureStore.getState();
    const isVisible = globalState.currentView === 'SATURN';
    
    // 【核心黑科技 2：底层控制】直接开关 GPU 的可见性
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】如果不可见，直接 return，阻断所有计算！
    if (!isVisible) return;

    const { systemState, smoothedPinchDist, smoothedPalmX, smoothedPalmY } = globalState;
    let targetScale = 1.0, targetRotX = 0.4, targetRotY = 0.0;

    if (systemState === 'IDLE') {
        config.autoIdleTime += 0.01;
        targetScale = 1.0 + Math.sin(config.autoIdleTime) * 0.1;
        targetRotX = 0.4 + Math.sin(config.autoIdleTime * 0.3) * 0.2;
        targetRotY = Math.sin(config.autoIdleTime * 0.2) * 0.4; 
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

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uScale.value = config.currentScale;
    materialRef.current.uniforms.uRotationX.value = config.currentRotX;
    materialRef.current.uniforms.uRotationY.value = config.currentRotY;
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, 
    uScale: { value: 1.0 }, 
    uRotationX: { value: 0.4 }, 
    uRotationY: { value: 0.0 }
  }), []);

  return (
    // 【新增】：将 pointsRef 绑定
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
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}