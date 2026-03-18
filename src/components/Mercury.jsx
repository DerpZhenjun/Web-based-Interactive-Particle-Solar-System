import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

// --- 水星 2.0 专属着色器 (对称光照版) ---
const vertexShader = `
  attribute vec4 aParams; // x: size, y: opacity, z: speed, w: type (0:核心, 1:散逸层, 2:彗尾)
  attribute vec3 customColor; 
  attribute float aRandomId;
  
  varying vec3 vColor; 
  varying float vOpacity; 
  varying float vType; 
  
  uniform float uTime; 
  uniform float uScale; 
  uniform float uRotationX; 
  uniform float uRotationY; 
  uniform vec3 uSunDir; 

  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }

  void main() {
      vec3 pos = position; 
      float type = aParams.w; 
      float speed = aParams.z;
      float currentOpacity = aParams.y;

      vec3 dir = normalize(pos); 

      // 粒子物理动势分配
      if (type < 0.5) {
          // Type 0: 核心地表。使用低频噪声打造坑洼感
          float noise = sin(pos.x * 2.0) * cos(pos.y * 2.0 + pos.z * 2.0) * 0.3;
          pos += dir * noise;
      } else if (type < 1.5) {
          // Type 1: 散逸层。极薄且快速消散
          float pushProgress = fract(uTime * 0.15 + aRandomId);
          float jitter = sin(uTime * speed + aRandomId * 10.0) * 0.15; // 减弱抖动，让其更贴服
          
          pos += dir * jitter;
          // 减小背离太阳风的吹动距离，保持贴地感
          pos -= uSunDir * (pushProgress * 1.5); 
          
          // 【核心修改】：指数级快速消散。刚离开地表就会迅速透明，防止形成厚重的云层
          currentOpacity *= exp(-pushProgress * 4.0); 
      } else {
          // Type 2: 标志性彗尾
          float progress = fract(uTime * speed * 0.25 + aRandomId); 
          float tailLength = 120.0; 
          
          vec3 tailDir = -normalize(uSunDir);
          
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 right = normalize(cross(tailDir, up));
          vec3 realUp = normalize(cross(right, tailDir));
          
          float spread = progress * 15.0; 
          vec3 offset = right * (cos(aRandomId * 100.0) * spread) + realUp * (sin(aRandomId * 100.0) * spread);
          
          pos = pos + tailDir * (progress * tailLength) + offset;
          currentOpacity *= (1.0 - pow(progress, 1.5));
      }

      // 宇宙上帝视角的手势旋转
      float cx = cos(uRotationX), sx = sin(uRotationX);
      float ry = pos.y * cx - pos.z * sx; float rz = pos.y * sx + pos.z * cx; pos.y = ry; pos.z = rz;
      float cy = cos(uRotationY), sy = sin(uRotationY);
      float rx = pos.x * cy + pos.z * sy; rz = -pos.x * sy + pos.z * cy; pos.x = rx; pos.z = rz;

      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      float dist = -mvPosition.z;
      float sizeMultiplier = (type > 1.5) ? 1.5 : (type > 0.5 ? 0.8 : 1.0); 
      gl_PointSize = clamp(aParams.x * sizeMultiplier * (150.0 / dist), 0.0, 100.0);

      vColor = customColor; 
      vOpacity = currentOpacity; 
      vType = type; 
  }
`;

const fragmentShader = `
  varying vec3 vColor; 
  varying float vOpacity; 
  varying float vType; 

  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      
      float glow = exp(-r2 * 3.0); 
      vec3 finalColor = vColor;
      float currentAlpha = vOpacity;

      if (vType < 0.5) {
          // 核心地表
          finalColor = mix(vColor, vec3(0.85, 0.8, 0.7), 0.35); 
          glow *= 0.9; 
          
      } else if (vType > 1.5) {
          // 彗尾保持高亮电离蓝
          finalColor = mix(vColor, vec3(0.3, 0.7, 1.0), 0.6);
          glow = exp(-r2 * 2.0);
      }

      gl_FragColor = vec4(finalColor, glow * currentAlpha);
  }
`;

export default function Mercury() {
  const pointsRef = useRef(); // 【新增】：用于底层显隐控制的引用
  const materialRef = useRef();
  
  const { positions, colors, params, randomIds } = useMemo(() => {
    const particles = 250000; 
    const pos = new Float32Array(particles * 3);
    const cols = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    
    const R = 10; 
    
    const colorsArr = [
        new THREE.Color('#999999'), // 浅灰
        new THREE.Color('#555555'), // 暗灰
        new THREE.Color('#a52a2a'), // 氧化赤褐
        new THREE.Color('#00ffff'), // 散逸层电离光
        new THREE.Color('#88ccff')  // 彗尾淡蓝
    ];

    for(let i = 0; i < particles; i++) {
        rIds[i] = Math.random();
        let rVal = Math.random();
        
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        const dx = Math.sin(phi) * Math.cos(theta);
        const dy = Math.cos(phi);
        const dz = Math.sin(phi) * Math.sin(theta);
        
        let x, y, z, r, g, b, size, op, spd, type; 

        // 调整比例：85% 核心地表，仅 3% 给散逸层，12% 给彗尾
        if (rVal < 0.85) {
            // Type 0: 核心地表 
            type = 0.0; spd = 0.0; 
            let cR = R * (0.96 + Math.random() * 0.04); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            
            let cMix = Math.random();
            let col = cMix > 0.4 ? colorsArr[0] : (cMix > 0.1 ? colorsArr[1] : colorsArr[2]);
            r = col.r; g = col.g; b = col.b; 
            size = 1.0 + Math.random() * 1.5; op = 1.0; 
        } 
        else if (rVal < 0.88) {
            // Type 1: 散逸层
            type = 1.0; spd = 0.5 + Math.random(); 
            // 极其贴近地表 (最大仅超出核心不到 3%)，压缩厚度
            let cR = R * (1.005 + Math.random() * 0.025); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            
            let col = colorsArr[3]; 
            r = col.r; g = col.g; b = col.b; 
            size = 1.0 + Math.random(); 
            // 提升透明度至 0.6，让它在极薄的一层中足够显眼
            op = 0.6; 
        } 
        else {
            // Type 2: 彗尾
            type = 2.0; spd = 1.0 + Math.random() * 2.0; 
            let cR = R * (1.0 + Math.random() * 0.1); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            
            let col = colorsArr[4]; 
            r = col.r; g = col.g; b = col.b; 
            size = 1.2 + Math.random(); op = 0.7;
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
    
    // 【核心黑科技 1：瞬态读取】
    const globalState = useGestureStore.getState();
    const isVisible = globalState.currentView === 'MERCURY';
    
    // 【核心黑科技 2：底层显隐控制】
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】
    if (!isVisible) return;

    // 可见状态下，继续处理动态交互
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
    uTime: { value: 0 }, 
    uScale: { value: 1.0 }, 
    uRotationX: { value: 0.2 }, 
    uRotationY: { value: 0.0 },
    uSunDir: { value: new THREE.Vector3(1.0, 0.0, 0.0) }
  }), []);

  return (
    // 【新增】：绑定 ref 并加上 frustumCulled={false} 防止误裁剪
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