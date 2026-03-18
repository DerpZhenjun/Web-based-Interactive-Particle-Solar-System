import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

// ==========================================
// 天王星核心着色器 (平滑冰巨星、极其显著的垂直星环、极寒微光)
// ==========================================
const vertexShader = `
  attribute vec4 aParams; // x: size, y: opacity, z: radius/speed, w: type
  attribute vec3 customColor; 
  attribute float aRandomId;
  
  varying vec3 vColor; 
  varying float vDist; 
  varying float vOpacity; 
  varying float vScaleFactor; 
  varying float vType;
  varying float vEdgeGlow;

  uniform float uTime; 
  uniform float uScale; 
  uniform float uRotationX; 
  uniform float uRotationY; 

  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }

  void main() {
      // 动态 LOD (Level of Detail) 剔除
      float normScaleLOD = clamp((uScale - 0.15) / 2.35, 0.0, 1.0);
      float visibilityThreshold = 0.9 + pow(normScaleLOD, 1.2) * 0.1; 
      if (aRandomId > visibilityThreshold) { 
          gl_Position = vec4(2.0, 2.0, 2.0, 0.0); 
          return; 
      }

      vec3 pos = position; 
      float type = aParams.w; 
      
      // ==========================================
      // 1. 本地动态：自转与开普勒星环
      // ==========================================
      if (type == 0.0) {
          pos.xz = rotate2d(uTime * 0.05) * pos.xz; 
      } else if (type == 1.0) {
          // 星环：开普勒力学公转
          float radius = aParams.z;
          float speed = 12.0 / pow(radius, 1.5);
          pos.xz = rotate2d(uTime * speed) * pos.xz; 
      } else if (type == 2.0) {
          // 极寒微光
          pos.xz = rotate2d(uTime * 0.02) * pos.xz;
          pos += normalize(pos) * sin(uTime * 0.5 + aRandomId * 10.0) * 0.2;
      }

      // ==========================================
      // 2. 视觉修正：98度极轴倾角 + 前倾角
      // ==========================================
      // 第一步：躺平 (绕Z轴旋转 98度，让水平星环竖起来)
      pos.xy = rotate2d(1.71) * pos.xy;
      // 第二步：稍微前倾 (绕X轴旋转 35度)。
      // 如果没有这一步，竖立的星环将完美平行于我们的视线，变成一条不可见的线！
      pos.yz = rotate2d(0.6) * pos.yz;

      // 视角拖拽旋转
      float cx = cos(uRotationX), sx = sin(uRotationX);
      float ry = pos.y * cx - pos.z * sx; float rz = pos.y * sx + pos.z * cx; pos.y = ry; pos.z = rz;

      float cy = cos(uRotationY), sy = sin(uRotationY);
      float rx = pos.x * cy + pos.z * sy; rz = -pos.x * sy + pos.z * cy; pos.x = rx; pos.z = rz;

      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
      float dist = -mvPosition.z;
      
      vec3 viewNormal = normalize(normalMatrix * normalize(pos));
      vEdgeGlow = 1.0 - max(dot(normalize(-mvPosition.xyz), viewNormal), 0.0); 
      
      gl_Position = projectionMatrix * mvPosition;
      
      // 【修改点】：大幅提高星环粒子在屏幕上的大小
      float pointSize = aParams.x * (180.0 / dist); 
      if (type == 1.0) pointSize *= 0.8; // 从 0.1 提升到 0.8，保证清晰可见
      if (type == 2.0) pointSize *= 2.0; 
      gl_PointSize = clamp(pointSize, 0.0, 150.0);

      vColor = customColor; 
      vOpacity = aParams.y; 
      vScaleFactor = uScale; 
      vType = type; 
      vDist = dist;
  }
`;

const fragmentShader = `
  varying vec3 vColor; 
  varying float vDist; 
  varying float vOpacity; 
  varying float vScaleFactor; 
  varying float vType;
  varying float vEdgeGlow;

  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      
      float glow = 1.0 - r2; 
      float t = clamp((vScaleFactor - 0.15) / 2.35, 0.0, 1.0);
      
      vec3 finalColor = vColor;
      float alpha = glow * vOpacity * (0.3 + 0.7 * t); 

      if (vType == 0.0) {
          // 【平滑冰球本体】
          finalColor = mix(vec3(0.2, 0.6, 0.7), vColor, smoothstep(0.1, 0.9, t)); 
          finalColor *= (0.6 + t * 0.6); 
          alpha *= 0.95; 
      } 
      else if (vType == 1.0) {
          // 【修改点：绚丽垂直星环】
          // 提亮色彩基数，并把透明度极大幅度提升，配合叠加混合产生光环感
          finalColor *= 1.2; 
          alpha *= 0.35; // 从 0.03 提升到 0.35
      }
      else if (vType == 2.0) {
          // 【极寒大气边缘】
          vec3 coldGlow = vec3(0.85, 0.95, 1.0);
          finalColor = mix(vColor, coldGlow, 0.5);
          alpha *= 0.15 + pow(vEdgeGlow, 4.0) * 0.4; 
      }
      
      if (vDist < 10.0) alpha *= vDist * 0.1; 
      
      gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function Uranus() {
  const pointsRef = useRef(); // 【新增】：获取底层 WebGL 的 Points 对象
  const materialRef = useRef();

  const { positions, colors, params, randomIds } = useMemo(() => {
    const particles = 200000; 
    const pos = new Float32Array(particles * 3);
    const cols = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    
    const R = 15; 
    
    const bodyCols = ['#73D2F3', '#4EE2EC', '#A2E8F7', '#5BC8D4'].map(c => new THREE.Color(c));
    // 【修改点】：为了让 Additive 叠加生效，把星环颜色从暗黑改成了冰尘色
    const ringCols = ['#5A6B7C', '#4A5A6A', '#6B7C8D', '#8A9BAA'].map(c => new THREE.Color(c));

    let currentIndex = 0;

    // 1. 生成平滑冰体
    const bodyCount = 150000;
    for(let i = 0; i < bodyCount; i++) {
        rIds[currentIndex] = Math.random();
        
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        
        let coreR = R * (0.98 + Math.random() * 0.02);
        pos[currentIndex*3] = coreR * Math.sin(phi) * Math.cos(theta);
        pos[currentIndex*3+1] = coreR * Math.cos(phi); 
        pos[currentIndex*3+2] = coreR * Math.sin(phi) * Math.sin(theta);
        
        let cIdx = Math.floor(Math.random() * 4);
        cols[currentIndex*3] = bodyCols[cIdx].r; 
        cols[currentIndex*3+1] = bodyCols[cIdx].g; 
        cols[currentIndex*3+2] = bodyCols[cIdx].b; 
        
        prms[currentIndex*4] = 1.6 + Math.random() * 0.8; 
        prms[currentIndex*4+1] = 0.9; 
        prms[currentIndex*4+2] = 0.0; 
        prms[currentIndex*4+3] = 0.0; 
        currentIndex++;
    }

    // 2. 生成厚度可见的垂直星环
    const ringCount = 30000;
    for(let i = 0; i < ringCount; i++) {
        rIds[currentIndex] = Math.random();
        
        let ringR;
        let zR = Math.random();
        // 调整星环的层次分布
        if (zR < 0.2) {
            ringR = R * (1.5 + Math.random() * 0.1); 
        } else if (zR < 0.6) {
            ringR = R * (1.7 + Math.random() * 0.15); // 主密环带
        } else {
            ringR = R * (2.0 + Math.random() * 0.1); 
        }
        
        const theta = Math.random() * Math.PI * 2;
        
        // 【修改点】：给星环增加一点点厚度，使得 3D 纵深感更强
        pos[currentIndex*3] = ringR * Math.cos(theta);
        pos[currentIndex*3+1] = (Math.random() - 0.5) * 0.15; // 增加厚度
        pos[currentIndex*3+2] = ringR * Math.sin(theta);
        
        let cIdx = Math.floor(Math.random() * 4);
        cols[currentIndex*3] = ringCols[cIdx].r; 
        cols[currentIndex*3+1] = ringCols[cIdx].g; 
        cols[currentIndex*3+2] = ringCols[cIdx].b; 

        prms[currentIndex*4] = 1.0; // 基础 Size
        prms[currentIndex*4+1] = 1.0; 
        prms[currentIndex*4+2] = ringR; 
        prms[currentIndex*4+3] = 1.0; 
        currentIndex++;
    }

    // 3. 生成极寒微光
    const glowCount = particles - currentIndex;
    for(let i = 0; i < glowCount; i++) {
        rIds[currentIndex] = Math.random();
        
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        
        let glowR = R * (1.02 + Math.random() * 0.1);
        pos[currentIndex*3] = glowR * Math.sin(phi) * Math.cos(theta);
        pos[currentIndex*3+1] = glowR * Math.cos(phi); 
        pos[currentIndex*3+2] = glowR * Math.sin(phi) * Math.sin(theta);
        
        cols[currentIndex*3] = 0.8; cols[currentIndex*3+1] = 0.95; cols[currentIndex*3+2] = 1.0; 

        prms[currentIndex*4] = 4.0; 
        prms[currentIndex*4+1] = 0.15; 
        prms[currentIndex*4+2] = 0.0; 
        prms[currentIndex*4+3] = 2.0; 
        currentIndex++;
    }

    return { positions: pos, colors: cols, params: prms, randomIds: rIds };
  }, []);

  const config = useMemo(() => ({ currentScale: 1.0, currentRotX: 0.0, currentRotY: 0.0, autoIdleTime: 0 }), []);

  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;
    
    // 【核心黑科技 1：瞬态读取】绕过 React 直接获取当前视图
    const globalState = useGestureStore.getState();
    const isVisible = globalState.currentView === 'URANUS';
    
    // 【核心黑科技 2：底层控制】直接开关 GPU 的可见性
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】如果不可见，直接 return，阻断所有计算！
    if (!isVisible) return;

    const { systemState, smoothedPinchDist, smoothedPalmX, smoothedPalmY } = globalState;
    let targetScale = 1.0, targetRotX = 0.0, targetRotY = 0.0;

    if (systemState === 'IDLE') {
        config.autoIdleTime += 0.01;
        targetScale = 0.9 + Math.sin(config.autoIdleTime) * 0.1;
        targetRotX = 0.0 + Math.sin(config.autoIdleTime * 0.3) * 0.1;
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

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uScale.value = config.currentScale;
    materialRef.current.uniforms.uRotationX.value = config.currentRotX;
    materialRef.current.uniforms.uRotationY.value = config.currentRotY;
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, 
    uScale: { value: 1.0 }, 
    uRotationX: { value: 0.0 }, 
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
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}