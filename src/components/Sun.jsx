import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

const vertexShader = `
  attribute vec4 aParams; // x: size, y: opacity, z: speed, w: type
  attribute vec3 customColor; 
  attribute float aRandomId;
  
  varying vec3 vColor; varying float vDist; varying float vOpacity; varying float vType; varying float vScaleFactor;
  uniform float uTime; uniform float uScale; uniform float uRotationX; uniform float uRotationY; 
  
  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }
  
  void main() {
      // LOD 优化逻辑
      float normScaleLOD = clamp((uScale - 0.15) / 2.35, 0.0, 1.0);
      float visibilityThreshold = 0.95 + pow(normScaleLOD, 1.2) * 0.05; 
      if (aRandomId > visibilityThreshold) { gl_Position = vec4(2.0, 2.0, 2.0, 0.0); return; }
      
      vec3 pos = position; 
      float type = aParams.w; 
      float speed = aParams.z; 
      vec3 dir = normalize(pos);
      float currentOpacity = aParams.y;
      
      // 1. 核心球体 (Type < 0.5): 高速、混乱的对流沸腾
      if (type < 0.5) {
          float boil = sin(uTime * 4.0 + pos.x * 5.0) * cos(uTime * 3.5 + pos.y * 6.0 + aRandomId * 10.0);
          pos += dir * boil * 0.7; // 表面沸腾起伏
          pos.xz = rotate2d(uTime * 0.06) * pos.xz; // 整体自转
      } 
      // 2. 日冕与光晕 (Type < 1.5): 极低密度，缓慢向外发散的太阳风
      else if (type < 1.5) {
          float progress = fract(uTime * speed * 0.08 + aRandomId);
          pos += dir * (progress * 35.0); // 向外漂移很远
          pos.xz = rotate2d(uTime * 0.03 + aRandomId) * pos.xz; // 带有轻微旋涡感
          currentOpacity *= (1.0 - pow(progress, 2.0)); // 越远越透明，平滑消散
      } 
      // 3. 耀斑与日珥 (Type > 1.5): 沿着磁力线轨迹喷射并落下
      else {
          float progress = fract(uTime * speed * 0.15 + aRandomId);
          float arc = sin(progress * 3.14159265); // 0 -> 1 -> 0 完美的抛物线包络
          
          // 计算切线方向制造弧形运动
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 tangent = normalize(cross(dir, up));
          if (length(tangent) < 0.1) tangent = normalize(cross(dir, vec3(1.0, 0.0, 0.0)));
          
          float direction = (aRandomId > 0.5) ? 1.0 : -1.0; // 随机向左或向右喷射
          
          // 向上喷射 (dir * arc) + 侧向移动 (tangent * progress)
          pos += dir * (arc * 8.0) + tangent * (progress * 18.0) * direction;
          currentOpacity *= arc; // 喷射初期和末期透明度降低
      }
      
      // 视角矩阵旋转计算
      float cx = cos(uRotationX), sx = sin(uRotationX); float ry = pos.y * cx - pos.z * sx; float rz = pos.y * sx + pos.z * cx; pos.y = ry; pos.z = rz;
      float cy = cos(uRotationY), sy = sin(uRotationY); float rx = pos.x * cy + pos.z * sy; rz = -pos.x * sy + pos.z * cy; pos.x = rx; pos.z = rz;
      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0); float dist = -mvPosition.z;
      
      gl_Position = projectionMatrix * mvPosition;
      
      // 光晕粒子需要更大，以制造朦胧感
      float sizeMultiplier = (type > 0.5 && type < 1.5) ? 2.5 : 1.0; 
      gl_PointSize = clamp(aParams.x * sizeMultiplier * (250.0 / dist), 0.0, 200.0);
      
      vColor = customColor; vOpacity = currentOpacity; vScaleFactor = uScale; vType = type; vDist = dist;
  }
`;

const fragmentShader = `
  varying vec3 vColor; varying float vDist; varying float vOpacity; varying float vType; varying float vScaleFactor;
  
  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      
      // 根据粒子类型调整边缘柔和度
      float glowSoftness = (vType < 1.5) ? ((vType < 0.5) ? 2.5 : 1.8) : 3.5;
      float glow = exp(-r2 * glowSoftness); 
      
      vec3 finalColor = vColor;
      
      // 色彩渲染细节
      if (vType < 0.5) { 
          // 核心球体：给每个单体粒子边缘增加暗红色，配合叠加混合能在中心产生极亮的白热化效果
          finalColor = mix(finalColor, vec3(0.8, 0.1, 0.0), r2 * 0.6); 
      } else if (vType > 1.5) { 
          // 耀斑：粒子中心极白，边缘过渡到设定的金色/橙色
          finalColor = mix(vec3(1.0, 1.0, 1.0), finalColor, r2 * 1.5); 
      }
      
      float t = clamp((vScaleFactor - 0.15) / 2.35, 0.0, 1.0);
      float alpha = glow * vOpacity * (0.4 + 0.6 * t); 
      if (vDist < 15.0) alpha *= vDist * 0.06; // 镜头极近防穿模
      
      gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function Sun() {
  const pointsRef = useRef(); // 【新增】：获取底层 WebGL 的 Points 对象
  const materialRef = useRef();
  
  const { positions, colors, params, randomIds } = useMemo(() => {
    const particles = 300000; 
    const pos = new Float32Array(particles * 3);
    const cols = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    
    const R = 22; 
    
    // 三组精心调配的调色板
    const coreColors = [new THREE.Color('#ffffff'), new THREE.Color('#ffcc00'), new THREE.Color('#ff6600'), new THREE.Color('#cc0000')];
    const coronaColors = [new THREE.Color('#fdfbf7'), new THREE.Color('#fffae6'), new THREE.Color('#e6f2ff')];
    const flareColors = [new THREE.Color('#ffffff'), new THREE.Color('#ffd700'), new THREE.Color('#ff8800')];

    for(let i = 0; i < particles; i++) {
        rIds[i] = Math.random();
        let rVal = Math.random(), phi = Math.acos(2 * Math.random() - 1), theta = 2 * Math.PI * Math.random();
        let dx = Math.sin(phi) * Math.cos(theta), dy = Math.cos(phi), dz = Math.sin(phi) * Math.sin(theta);
        
        let x, y, z, r, g, b, size, op, spd, type; 

        // 调整比例：75% 给核心，15% 给日冕，10% 给耀斑
        if (rVal < 0.75) {
            // 1. 核心 (75%)
            type = 0.0; spd = 1.0; 
            let cR = R * (0.95 + Math.random() * 0.05); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            let colorRand = Math.random();
            let col = colorRand > 0.9 ? coreColors[0] : (colorRand > 0.4 ? coreColors[1] : (colorRand > 0.1 ? coreColors[2] : coreColors[3]));
            r = col.r; g = col.g; b = col.b; 
            size = 1.0 + Math.random() * 2.0; op = 0.9; 
        } else if (rVal < 0.90) {
            // 2. 日冕 (15%)
            type = 1.0; spd = 1.5 + Math.random() * 2.5; 
            let cR = R * (1.05 + Math.random() * 0.4); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            let col = Math.random() > 0.7 ? coronaColors[0] : (Math.random() > 0.3 ? coronaColors[1] : coronaColors[2]);
            r = col.r; g = col.g; b = col.b; 
            size = 1.5 + Math.random() * 2.5; op = 0.03; 
        } else {
            // 3. 耀斑 (10%)
            type = 2.0; spd = 2.0 + Math.random() * 3.0; 
            let cR = R * (0.98 + Math.random() * 0.04); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            let col = Math.random() > 0.7 ? flareColors[0] : (Math.random() > 0.3 ? flareColors[1] : flareColors[2]);
            r = col.r; g = col.g; b = col.b; 
            size = 1.5 + Math.random() * 2.5; op = 0.8;
        }
        
        pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z; 
        cols[i*3]=r; cols[i*3+1]=g; cols[i*3+2]=b;
        prms[i*4]=size; prms[i*4+1]=op; prms[i*4+2]=spd; prms[i*4+3]=type;
    }
    return { positions: pos, colors: cols, params: prms, randomIds: rIds };
  }, []);

  const config = useMemo(() => ({ currentScale: 1.0, currentRotX: 0.2, currentRotY: 0.0, autoIdleTime: 0 }), []);

  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;
    
    // 【核心黑科技 1：瞬态读取】绕过 React 直接获取当前视图
    const globalState = useGestureStore.getState();
    const isVisible = globalState.currentView === 'SUN';
    
    // 【核心黑科技 2：底层控制】直接开关 GPU 的可见性
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】如果不可见，直接 return，不消耗任何 CPU/GPU 算力！
    if (!isVisible) return;

    // 若可见，则继续执行原本的手势互动逻辑
    const { systemState, smoothedPinchDist, smoothedPalmX, smoothedPalmY } = globalState;
    let targetScale = 1.0, targetRotX = 0.2, targetRotY = 0.0;

    if (systemState === 'IDLE') {
        config.autoIdleTime += 0.01;
        targetScale = 1.0 + Math.sin(config.autoIdleTime * 0.8) * 0.05;
        targetRotX = 0.2 + Math.sin(config.autoIdleTime * 0.3) * 0.1;
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
    uTime: { value: 0 }, uScale: { value: 1.0 }, uRotationX: { value: 0.2 }, uRotationY: { value: 0.0 }
  }), []);

  return (
    // 【新增】：将 pointsRef 绑定
    <points ref={pointsRef} rotation={[0, 0, 7.25 * (Math.PI / 180)]} frustumCulled={false}>
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