import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

const vertexShader = `
  attribute vec4 aParams; // x: size, y: opacity, z: speed, w: type
  attribute vec3 customColor; 
  attribute float aRandomId;
  
  varying vec3 vColor; 
  varying float vOpacity; 
  varying float vType; 
  varying float vLightIntensity;
  varying float vFlash; 
  
  uniform float uTime; 
  uniform float uScale; 
  uniform float uRotationX; 
  uniform float uRotationY; 
  uniform vec3 uSunDir; 

  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }

  // --- 极其轻量级的 3D 伪柏林噪声 (用于生成爆米花湍流) ---
  float hash(vec3 p) {
      p  = fract( p * 0.3183099 + 0.1 );
      p *= 17.0;
      return fract( p.x * p.y * p.z * (p.x + p.y + p.z) );
  }
  float noise(in vec3 x) {
      vec3 i = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                     mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                     mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
      vec3 pos = position; 
      float type = aParams.w; 
      float speed = aParams.z;
      float currentOpacity = aParams.y;
      float flash = 0.0;

      // 计算球体法线及光照
      vec3 dir = normalize(pos); 
      float lightDot = dot(dir, normalize(uSunDir)); 

      // 纬度计算 (Lat: -1.0 到 1.0)
      float lat = dir.y; 
      float absLat = abs(lat);
      // 赤道接近度：赤道处为 1.0，两极为 0.0
      float equatorProximity = 1.0 - absLat; 

      if (type < 0.5) {
          // Type 0: 底层浓厚大气 (深色)
          // 缓慢而沉稳的底流
          pos.xz = rotate2d(uTime * speed * 0.3) * pos.xz;
          pos += dir * sin(uTime * 1.5 + aRandomId * 10.0) * 0.2;
          
      } else if (type < 1.5) {
          // Type 1: 表层高速云带 (传送带、Y型结构、爆米花湍流)
          
          // A. 宏观传送带 & 差分旋转 (Y-Feature)
          // 赤道跑得快，高纬度被强行向后拉扯，形成 '<' 字折角
          float baseRotation = uTime * speed; 
          float yLag = absLat * 2.5; // 纬度越高，滞后角越大
          float finalAngle = (baseRotation * equatorProximity) - yLag; 
          pos.xz = rotate2d(finalAngle) * pos.xz;

          // B. 微观爆米花湍流 (Small-scale Turbulence)
          // 在赤道区域最强，向两极迅速衰减 (pow 1.5 让衰减更平滑)
          float turbStrength = pow(equatorProximity, 1.5) * 0.35;
          // 取 3 个维度的噪声作为位移向量
          vec3 turbOffset = vec3(
              noise(pos * 3.0 + uTime * 2.5),
              noise(pos.yzx * 3.0 + uTime * 2.0 + aRandomId),
              noise(pos.zxy * 3.0 + uTime * 3.0)
          ) * 2.0 - 1.0; 
          
          // 将湍流应用于粒子位置
          pos += turbOffset * turbStrength;

      } else if (type < 2.5) {
          // Type 2: 闪电粒子 (隐藏在云层深处)
          // 跟着云层同步旋转
          float finalAngle = (uTime * speed * equatorProximity) - (absLat * 2.5);
          pos.xz = rotate2d(finalAngle) * pos.xz;
          
          float flashTrigger = fract(uTime * 0.2 + aRandomId);
          flash = step(0.98, flashTrigger); 
          pos += dir * flash * 0.8;
          
      } else {
          // Type 3: 沉重的电离尾迹 (粘稠的流失大气)
          float progress = fract(uTime * speed * 0.1 + aRandomId); 
          float tailLength = 70.0; 
          
          vec3 tailDir = -normalize(uSunDir);
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 right = normalize(cross(tailDir, up));
          vec3 realUp = normalize(cross(right, tailDir));
          
          float spread = progress * 10.0; 
          vec3 offset = right * (cos(aRandomId * 50.0) * spread) + realUp * (sin(aRandomId * 50.0) * spread);
          offset.y -= progress * 5.0; 
          
          pos = pos + tailDir * (progress * tailLength) + offset;
          currentOpacity *= (1.0 - pow(progress, 1.2));
      }

      vLightIntensity = lightDot;
      vFlash = flash;

      // 手势驱动的宏观系统旋转
      float cx = cos(uRotationX), sx = sin(uRotationX);
      float ry = pos.y * cx - pos.z * sx; float rz = pos.y * sx + pos.z * cx; pos.y = ry; pos.z = rz;
      float cy = cos(uRotationY), sy = sin(uRotationY);
      float rx = pos.x * cy + pos.z * sy; rz = -pos.x * sy + pos.z * cy; pos.x = rx; pos.z = rz;

      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      float dist = -mvPosition.z;
      float sizeMultiplier = (type > 2.5) ? 1.5 : (type > 1.5 ? 2.0 : (type < 0.5 ? 1.8 : 1.2)); 
      gl_PointSize = clamp(aParams.x * sizeMultiplier * (150.0 / dist), 0.0, 120.0);

      vColor = customColor; 
      vOpacity = currentOpacity; 
      vType = type; 
  }
`;

const fragmentShader = `
  varying vec3 vColor; 
  varying float vOpacity; 
  varying float vType; 
  varying float vLightIntensity;
  varying float vFlash;

  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      
      float fogAlpha = exp(-r2 * 1.5); 
      vec3 finalColor = vColor;
      float currentAlpha = vOpacity * fogAlpha;

      if (vType < 2.5) {
          float blend = smoothstep(-0.4, 0.4, vLightIntensity);
          
          vec3 nightGlow = mix(vec3(0.1, 0.02, 0.05), vec3(0.05, 0.01, 0.05), r2);
          
          if (vFlash > 0.5) {
              finalColor = vec3(0.9, 0.8, 1.0);
              currentAlpha *= 3.0; 
          } else {
              finalColor = mix(nightGlow, vColor, blend);
              currentAlpha *= mix(0.5, 1.0, blend); 
          }
      } else {
          finalColor = mix(vColor, vec3(0.8, 0.7, 0.5), 0.5);
      }

      gl_FragColor = vec4(finalColor, currentAlpha);
  }
`;

export default function Venus() {
  const pointsRef = useRef(); // 【新增】：获取底层 WebGL 的 Points 对象
  const materialRef = useRef();
  
  const { positions, colors, params, randomIds } = useMemo(() => {
    const particles = 250000; 
    const pos = new Float32Array(particles * 3);
    const cols = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    
    const R = 14; 
    
    const colorsArr = [
        new THREE.Color('#daa520'), // 金麒麟色 (底层基色)
        new THREE.Color('#ffcc33'), // 琥珀金 (表层云)
        new THREE.Color('#fffacd'), // 柠檬绸色 (高光云顶)
        new THREE.Color('#b8860b')  // 暗金 (离子尾气)
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

        if (rVal < 0.40) {
            type = 0.0; spd = 2.0 + Math.random(); 
            let cR = R * (0.95 + Math.random() * 0.05); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            let col = colorsArr[0];
            r = col.r; g = col.g; b = col.b; 
            size = 2.5 + Math.random() * 2.0; op = 0.6; 
        } 
        else if (rVal < 0.85) {
            type = 1.0; 
            // 提高表层云的速度，以匹配高速传送带特征
            spd = 6.0 + Math.random() * 4.0; 
            let cR = R * (1.0 + Math.random() * 0.05);
            x = cR * dx; y = cR * dy; z = cR * dz;
            let cMix = Math.random();
            let col = cMix > 0.4 ? colorsArr[1] : colorsArr[2]; 
            r = col.r; g = col.g; b = col.b; 
            size = 1.5 + Math.random() * 1.5; op = 0.4;
        } 
        else if (rVal < 0.87) {
            type = 2.0; spd = 6.0; 
            let cR = R * 0.98; 
            x = cR * dx; y = cR * dy; z = cR * dz;
            r = 1.0; g = 1.0; b = 1.0; 
            size = 3.0; op = 0.0; 
        }
        else {
            type = 3.0; spd = 0.8 + Math.random() * 1.5; 
            let cR = R * (1.02 + Math.random() * 0.05); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            let col = colorsArr[3]; 
            r = col.r; g = col.g; b = col.b; 
            size = 2.0 + Math.random(); op = 0.3;
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
    const isVisible = globalState.currentView === 'VENUS';
    
    // 【核心黑科技 2：底层控制】直接开关 GPU 的可见性
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】如果不可见，直接 return，阻断所有计算！
    if (!isVisible) return;

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