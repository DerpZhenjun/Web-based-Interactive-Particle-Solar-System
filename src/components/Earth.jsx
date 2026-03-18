import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

// ==========================================
// 1. 文字粒子组件 (PEACE)
// ==========================================
const wordVertexShader = `
  uniform float uProgress; 
  uniform float uTime;
  uniform float uScale;
  uniform float uRotationX;
  uniform float uRotationY;

  attribute vec3 aTargetPos;  
  attribute vec3 aScatterPos; 
  attribute float aRandomId;
  
  varying float vAlpha;
  varying vec3 vColor;

  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }

  void main() {
      // 潜伏阶段
      if (uProgress <= 0.0) {
          gl_Position = vec4(9999.0, 9999.0, 9999.0, 1.0);
          gl_PointSize = 0.0;
          return;
      }

      vec3 pos = position; 
      float currentAlpha = 0.0;

      if (uProgress < 1.0) {
          // 0~1: 极速降临，粒子从地心爆发汇聚成文字
          float t = smoothstep(0.0, 1.0, uProgress);
          float easeT = 1.0 - pow(1.0 - t, 3.0); 
          pos = mix(position, aTargetPos, easeT);
          currentAlpha = t;
      } else if (uProgress < 3.0) {
          // 1~3: 驻留阶段，加入轻微的水波纹律动感
          pos = aTargetPos;
          pos.y += sin(uTime * 2.0 + aTargetPos.x * 0.4) * 0.3;
          currentAlpha = 1.0 - abs(sin(uTime * 1.5 + aRandomId * 5.0)) * 0.2;
      } else {
          // 3~5: 史诗级消散，化作光雨向上升华
          float t = smoothstep(3.0, 5.0, uProgress);
          vec3 scatter = aScatterPos;
          scatter.y += (uTime - 3.0) * 8.0; 
          pos = mix(aTargetPos, scatter, pow(t, 1.5));
          currentAlpha = 1.0 - pow(t, 0.6); 
      }

      // 视角锁定跟随
      float cx = cos(uRotationX), sx = sin(uRotationX);
      float ry = pos.y * cx - pos.z * sx; float rz = pos.y * sx + pos.z * cx; pos.y = ry; pos.z = rz;
      float cy = cos(uRotationY), sy = sin(uRotationY);
      float rx = pos.x * cy + pos.z * sy; rz = -pos.x * sy + pos.z * cy; pos.x = rx; pos.z = rz;

      // 单词体量稍微放大，悬浮在地球前方
      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale * 1.8, 1.0); 
      gl_Position = projectionMatrix * mvPosition;
      
      float dist = -mvPosition.z;
      gl_PointSize = clamp(5.0 * (150.0 / dist), 0.0, 20.0); 

      vAlpha = currentAlpha;
      // 和平的圣洁配色：从白金渐变到青空蓝
      vColor = mix(vec3(1.0, 1.0, 0.9), vec3(0.4, 0.8, 1.0), aRandomId);
  }
`;

const wordFragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      float glow = exp(-r2 * 2.5); 
      gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

function ParticleWord({ progressRef, config }) {
  const pointsRef = useRef(); // 【新增】：获取底层 WebGL 的 Points 对象
  const materialRef = useRef();

  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;
    
    // 【核心黑科技 1：瞬态读取】绕过 React 直接获取当前视图
    const isVisible = useGestureStore.getState().currentView === 'EARTH';
    
    // 【核心黑科技 2：底层控制】直接开关 GPU 的可见性
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】如果不可见，直接 return，阻断所有计算！
    if (!isVisible) return;

    materialRef.current.uniforms.uProgress.value = progressRef.current;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uScale.value = config.currentScale;
    materialRef.current.uniforms.uRotationX.value = config.currentRotX;
    materialRef.current.uniforms.uRotationY.value = config.currentRotY;
  });

  const { initials, targets, scatters, rIds } = useMemo(() => {
    const count = 75000; 
    const ini = new Float32Array(count * 3);
    const tar = new Float32Array(count * 3);
    const sca = new Float32Array(count * 3);
    const ids = new Float32Array(count);

    // --- 核心：Canvas 2D 像素提取 ---
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 500;
    canvas.height = 120;
    ctx.fillStyle = 'white';
    // 使用 Arial 黑体确保字母够粗，粒子能够填满
    ctx.font = 'bold 90px Arial'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PEACE', 250, 60);

    const imageData = ctx.getImageData(0, 0, 500, 120).data;
    const pixelPoints = [];
    
    // 遍历 Canvas，提取有文字内容的像素点
    for (let y = 0; y < 120; y++) {
      for (let x = 0; x < 500; x++) {
        // 如果该像素点的 alpha 通道有值（非透明）
        if (imageData[(y * 500 + x) * 4 + 3] > 128) {
          // 坐标转换居中并缩放
          pixelPoints.push({ x: (x - 250) * 0.18, y: (60 - y) * 0.18 });
        }
      }
    }

    for (let i = 0; i < count; i++) {
        ids[i] = Math.random();

        // 初始位置压缩在地球核心，准备爆发
        ini[i*3] = (Math.random() - 0.5) * 2.0;
        ini[i*3+1] = (Math.random() - 0.5) * 2.0;
        ini[i*3+2] = (Math.random() - 0.5) * 2.0;

        // 目标位置：从提取出的像素点中随机抽取（允许重叠，形成厚度）
        const p = pixelPoints[Math.floor(Math.random() * pixelPoints.length)];
        tar[i*3] = p.x + (Math.random() - 0.5) * 0.2; // 增加微小噪波，让边缘有辉光感
        tar[i*3+1] = p.y + 5.0 + (Math.random() - 0.5) * 0.2; // 稍微抬高单词位置
        tar[i*3+2] = 16.0 + (Math.random() - 0.5) * 1.5; // 悬浮在地球表面（Z=14）前方

        // 消散位置：打散向极高空升华
        sca[i*3] = tar[i*3] + (Math.random() - 0.5) * 40.0;
        sca[i*3+1] = tar[i*3+1] + 50.0 + Math.random() * 20.0;
        sca[i*3+2] = tar[i*3+2] + (Math.random() - 0.5) * 20.0;
    }
    return { initials: ini, targets: tar, scatters: sca, rIds: ids };
  }, []);

  const uniforms = useMemo(() => ({
    uProgress: { value: 0.0 },
    uTime: { value: 0.0 },
    uScale: { value: 1.0 },
    uRotationX: { value: 0.2 },
    uRotationY: { value: 0.0 }
  }), []);

  return (
    // 【新增】：将 pointsRef 绑定
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={initials.length / 3} array={initials} itemSize={3} />
        <bufferAttribute attach="attributes-aTargetPos" count={targets.length / 3} array={targets} itemSize={3} />
        <bufferAttribute attach="attributes-aScatterPos" count={scatters.length / 3} array={scatters} itemSize={3} />
        <bufferAttribute attach="attributes-aRandomId" count={rIds.length} array={rIds} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={wordVertexShader}
        fragmentShader={wordFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false} 
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ==========================================
// 2. 地球本体组件 
// ==========================================
const vertexShader = `
  attribute vec4 aParams; 
  attribute float aRandomId;
  varying float vType; 
  varying vec2 vUv;
  varying float vViewZ; 
  varying float vEdgeGlow; 
  varying float vLightIntensity; 
  uniform float uTime; 
  uniform float uScale; 
  uniform float uRotationX; 
  uniform float uRotationY; 
  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }
  const float PI = 3.14159265359;

  void main() {
      vec3 pos = position; 
      float type = aParams.w; 
      vec3 dir = normalize(pos); 
      float u = 0.5 + atan(-dir.z, dir.x) / (2.0 * PI);
      float v = 0.5 - asin(dir.y) / PI;
      vUv = vec2(u, v);

      float moonOrbitRadius = 35.0; 
      float moonSpeed = 0.4; 
      vec3 moonPos = vec3(cos(uTime * moonSpeed) * moonOrbitRadius, sin(uTime * moonSpeed * 0.5) * 4.0, sin(uTime * moonSpeed) * moonOrbitRadius);
      vec3 moonDir = normalize(moonPos);

      if (type < 0.5) {
          pos.xz = rotate2d(uTime * 0.2) * pos.xz; 
          vec3 currentDir = normalize(pos);
          float tideAlignment = abs(dot(currentDir, moonDir)); 
          float tideHeight = pow(tideAlignment, 8.0) * 0.8; 
          pos += currentDir * tideHeight;
      } else if (type < 1.5) {
          pos.xz = rotate2d(uTime * 0.25) * pos.xz;
          pos += dir * sin(uTime * 2.0 + aRandomId * 10.0) * 0.1;
          vec3 currentDir = normalize(pos);
          float tideAlignment = abs(dot(currentDir, moonDir));
          pos += currentDir * pow(tideAlignment, 8.0) * 1.2;
      } else {
          pos.xz = rotate2d(uTime * 0.1) * pos.xz;
          pos += moonPos;
      }

      float cx = cos(uRotationX), sx = sin(uRotationX);
      float ry = pos.y * cx - pos.z * sx; float rz = pos.y * sx + pos.z * cx; pos.y = ry; pos.z = rz;
      float cy = cos(uRotationY), sy = sin(uRotationY);
      float rx = pos.x * cy + pos.z * sy; rz = -pos.x * sy + pos.z * cy; pos.x = rx; pos.z = rz;

      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      vec3 viewNormal = normalize(normalMatrix * normalize(pos));
      vViewZ = viewNormal.z; 
      vEdgeGlow = 1.0 - max(dot(normalize(-mvPosition.xyz), viewNormal), 0.0); 
      vLightIntensity = dot(normalize(pos), normalize(vec3(1.0, 0.0, 0.0)));

      float dist = -mvPosition.z;
      float sizeMultiplier = (type > 1.5) ? 1.4 : ((type > 0.5) ? 1.5 : 1.2); 
      gl_PointSize = clamp(aParams.x * sizeMultiplier * (150.0 / dist), 0.0, 80.0);
      vType = type; 
  }
`;

const fragmentShader = `
  uniform sampler2D uEarthMap;
  uniform float uMapLoaded;
  varying float vType; 
  varying vec2 vUv;
  varying float vViewZ;
  varying float vEdgeGlow;
  varying float vLightIntensity;

  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      if (vViewZ < -0.1 && vType < 0.5) discard; 

      float alpha = exp(-r2 * 2.0); 
      vec3 finalColor = vec3(1.0);

      if (vType < 0.5) {
          vec3 landColor = vec3(0.18, 0.70, 0.25); 
          vec3 oceanColor = vec3(0.05, 0.35, 0.85); 
          if (uMapLoaded > 0.5) {
              float isWater = texture2D(uEarthMap, vUv).r; 
              finalColor = mix(landColor, oceanColor, smoothstep(0.3, 0.5, isWater));
          } else {
              finalColor = oceanColor;
          }
          alpha *= 1.0; 
      } else if (vType < 1.5) {
          finalColor = vec3(0.4, 0.7, 1.0); 
          alpha *= 0.15 + pow(vEdgeGlow, 3.0) * 0.6; 
      } else {
          float light = smoothstep(-0.2, 0.2, vLightIntensity);
          vec3 moonBright = vec3(0.8, 0.8, 0.8); 
          vec3 moonDark = vec3(0.15, 0.15, 0.15); 
          finalColor = mix(moonDark, moonBright, light);
          alpha *= 1.0;
      }
      gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function Earth() {
  const pointsRef = useRef(); // 【新增】：获取底层 WebGL 的 Points 对象
  const materialRef = useRef();
  const [earthMap, setEarthMap] = useState(null);
  const angelProgress = useRef(-100.0);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous'); 
    loader.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_specular_2048.jpg',
      (texture) => setEarthMap(texture)
    );
  }, []);

  useEffect(() => {
    const trigger = () => {
      if (angelProgress.current <= -99.0) {
          angelProgress.current = -1.0; 
      }
    };
    window.addEventListener('TRIGGER_ANGEL', trigger);
    return () => window.removeEventListener('TRIGGER_ANGEL', trigger);
  }, []);
  
  const { positions, params, randomIds } = useMemo(() => {
    const particles = 250000; 
    const pos = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    const R = 14; 
    for(let i = 0; i < particles; i++) {
        rIds[i] = Math.random();
        let rVal = Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        const dx = Math.sin(phi) * Math.cos(theta);
        const dy = Math.cos(phi);
        const dz = Math.sin(phi) * Math.sin(theta);
        
        let x, y, z, size, op, spd, type; 
        if (rVal < 0.75) {
            type = 0.0; spd = 0.0; 
            let cR = R * (0.98 + Math.random() * 0.02); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            size = 2.0; op = 1.0; 
        } else if (rVal < 0.90) {
            type = 1.0; spd = 1.0; 
            let cR = R * (1.05 + Math.random() * 0.1); 
            x = cR * dx; y = cR * dy; z = cR * dz;
            size = 3.5; op = 0.3;
        } else {
            type = 2.0; spd = 0.0;
            let moonR = 3.2; 
            let cR = moonR * (0.95 + Math.random() * 0.1);
            x = cR * dx; y = cR * dy; z = cR * dz; 
            size = 1.6; op = 1.0;
        }
        pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z; 
        prms[i*4]=size; prms[i*4+1]=op; prms[i*4+2]=spd; prms[i*4+3]=type;
    }
    return { positions: pos, params: prms, randomIds: rIds };
  }, []);

  const config = useMemo(() => ({ currentScale: 1.0, currentRotX: 0.2, currentRotY: 0.0, autoIdleTime: 0 }), []);

  useFrame((state, delta) => {
    if (!materialRef.current || !pointsRef.current) return;
    
    // 【核心黑科技 1：瞬态读取】绕过 React 直接获取当前视图
    const globalState = useGestureStore.getState();
    const isVisible = globalState.currentView === 'EARTH';
    
    // 【核心黑科技 2：底层控制】直接开关 GPU 的可见性
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】如果不可见，直接 return，阻断所有计算！
    if (!isVisible) return;

    const { systemState, smoothedPinchDist, smoothedPalmX, smoothedPalmY } = globalState;
    let targetScale = 1.0, targetRotX = 0.2, targetRotY = 0.0;

    if (angelProgress.current > -99.0) {
        
        if (angelProgress.current < 0.0) {
            angelProgress.current += delta * 1.6; 
        } else if (angelProgress.current < 1.0) {
            angelProgress.current += delta * 2.5; 
        } else if (angelProgress.current < 3.0) {
            angelProgress.current += delta * 0.4; 
        } else {
            angelProgress.current += delta * 0.2; 
        }
        
        targetScale = 0.55; 
        targetRotX = 0.1;
        targetRotY = 0.0;

        if (angelProgress.current > 5.0) {
            angelProgress.current = -100.0; 
        }
    } else {
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
    }

    config.currentScale += (targetScale - config.currentScale) * 0.15;
    config.currentRotX += (targetRotX - config.currentRotX) * 0.15;
    config.currentRotY += (targetRotY - config.currentRotY) * 0.15;

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uScale.value = config.currentScale;
    materialRef.current.uniforms.uRotationX.value = config.currentRotX;
    materialRef.current.uniforms.uRotationY.value = config.currentRotY;
    
    if (earthMap) {
        materialRef.current.uniforms.uEarthMap.value = earthMap;
        materialRef.current.uniforms.uMapLoaded.value = 1.0;
    }
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, 
    uScale: { value: 1.0 }, 
    uRotationX: { value: 0.2 }, 
    uRotationY: { value: 0.0 },
    uEarthMap: { value: null },
    uMapLoaded: { value: 0.0 } 
  }), []);

  return (
    <>
      {/* 【新增】：绑定 pointsRef，加入 frustumCulled={false} */}
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
      {/* 挂载新的文字粒子组件 */}
      <ParticleWord progressRef={angelProgress} config={config} />
    </>
  );
}