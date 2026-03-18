import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

const marsVertexShader = `
  attribute vec4 aParams; // x: size, y: opacity, z: speed, w: type
  attribute vec3 customColor; 
  attribute float aRandomId;
  
  varying vec3 vColor;
  varying float vType; 
  varying float vRandom;
  varying float vViewZ; 
  varying float vEdgeGlow; 

  uniform float uTime; 
  uniform float uScale; 
  uniform float uRotationX; 
  uniform float uRotationY; 

  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }

  void main() {
      vec3 pos = position; 
      float type = aParams.w; 
      vRandom = aRandomId;
      
      // 动态特征：沙尘与卫星
      if (type > 2.5 && type < 3.5) {
          // 【扬尘沙暴】
          pos.xz = rotate2d(uTime * 0.2 * aParams.z) * pos.xz;
          pos += normalize(pos) * sin(uTime * 15.0 + aRandomId * 100.0) * 0.15;
          pos.y += sin(uTime * 5.0 + aRandomId * 20.0) * 0.1;
      } 
      else if (type > 3.5 && type < 4.5) {
          // 【火卫一 Phobos】 轨道更近，速度极快
          pos.xz = rotate2d(uTime * 2.5) * pos.xz;
      }
      else if (type > 4.5) {
          // 【火卫二 Deimos】 轨道较远，带有一定倾角
          pos.xy = rotate2d(uTime * 0.2) * pos.xy;
          pos.xz = rotate2d(uTime * 0.8) * pos.xz;
      }

      // 视角拖拽旋转
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
      
      if (type > 2.5 && type < 3.5) pSize *= 0.6; // 沙尘更细小
      // 【优化点】：大幅放大卫星粒子的尺寸，使其在深空中清晰可见
      if (type > 3.5) pSize *= 4.5; 
      
      gl_PointSize = clamp(pSize * (150.0 / dist), 0.0, 50.0);
      vType = type; 
      vColor = customColor; 
  }
`;

const marsFragmentShader = `
  varying vec3 vColor;
  varying float vType; 
  varying float vViewZ;
  varying float vEdgeGlow;

  void main() {
      vec2 cxy = 2.0 * gl_PointCoord - 1.0; 
      float r2 = dot(cxy, cxy); 
      if (r2 > 1.0) discard;
      
      if (vType < 2.5 && vViewZ < -0.1) discard; 

      float alpha = exp(-r2 * 2.5); 
      vec3 finalColor = vColor; 

      if (vType < 1.5) {
          alpha *= 0.95; 
      }
      else if (vType < 2.5) {
          alpha *= 1.0; 
      }
      else if (vType < 3.5) {
          alpha *= 0.35; 
      }
      else if (vType > 3.5) {
          // 【优化点】：让卫星的中心区域稍微发亮，模拟反射太阳光
          finalColor = mix(finalColor, vec3(1.0, 0.95, 0.9), exp(-r2 * 4.0) * 0.5);
          alpha *= 1.0;
      }

      if (vType < 2.5) {
          float atmosphere = pow(vEdgeGlow, 5.0); 
          vec3 salmonHalo = vec3(0.95, 0.55, 0.45);
          finalColor = mix(finalColor, salmonHalo, atmosphere * 0.6);
      }

      gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function Mars() {
  const pointsRef = useRef(); // 【新增】：获取底层 WebGL 的 Points 对象
  const materialRef = useRef();

  const { positions, colors, params, randomIds } = useMemo(() => {
    const particles = 250000; 
    const pos = new Float32Array(particles * 3);
    const cols = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    
    const R = 14.0; 

    const palette = {
        rust: new THREE.Color('#b33b14'),     
        ochre: new THREE.Color('#d97326'),    
        darkDesert: new THREE.Color('#4a1705'),
        ice: new THREE.Color('#e0e0f0'),      
        sand: new THREE.Color('#cc602b'),     
        // 【优化点】：提高卫星基础亮度，使其不再融入黑色的背景
        moon: new THREE.Color('#8c7d73'),     
        olympusPeak: new THREE.Color('#e8dcd8'), 
        canyonDeep: new THREE.Color('#0a0300'),  
        canyonEdge: new THREE.Color('#ff9c4a')   
    };

    const vDir = new THREE.Vector3(); 
    // 调整奥林匹斯山坐标，使其更靠近赤道偏北，便于观察
    const dirOlympus = new THREE.Vector3(Math.sin(1.2)*Math.cos(0.5), Math.cos(1.2), Math.sin(1.2)*Math.sin(0.5));
    
    const craters = [
        { dir: new THREE.Vector3(Math.sin(2.2)*Math.cos(5.0), Math.cos(2.2), Math.sin(2.2)*Math.sin(5.0)), rad: 0.35, depth: 0.02 },
        { dir: new THREE.Vector3(Math.sin(2.5)*Math.cos(1.2), Math.cos(2.5), Math.sin(2.5)*Math.sin(1.2)), rad: 0.25, depth: 0.015 },
        { dir: new THREE.Vector3(Math.sin(0.8)*Math.cos(3.5), Math.cos(0.8), Math.sin(0.8)*Math.sin(3.5)), rad: 0.2, depth: 0.01 },
    ];

    // 【优化点】：让卫星粒子更聚拢，形成不规则的致密岩石块
    const createMoon = (moonR, orbitR, indexOffset, count, type) => {
        for(let j = 0; j < count; j++) {
            let idx = indexOffset + j;
            rIds[idx] = Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            const theta = 2 * Math.PI * Math.random();
            // 使用 noise 逻辑让卫星不那么圆
            let radius = moonR * (0.8 + Math.sin(phi * 4.0) * 0.1 + Math.cos(theta * 3.0) * 0.1); 
            
            pos[idx*3] = orbitR + radius * Math.sin(phi) * Math.cos(theta);
            pos[idx*3+1] = radius * Math.cos(phi);
            pos[idx*3+2] = radius * Math.sin(phi) * Math.sin(theta);
            
            let cMix = 0.5 + Math.random() * 0.5;
            cols[idx*3] = palette.moon.r * cMix; 
            cols[idx*3+1] = palette.moon.g * cMix; 
            cols[idx*3+2] = palette.moon.b * cMix;

            prms[idx*4] = 1.5 + Math.random(); prms[idx*4+1] = 1.0; prms[idx*4+2] = 1.0; prms[idx*4+3] = type; 
        }
    };

    let currentIndex = 0;
    const phobosCount = 2000;
    createMoon(0.8, 19.0, currentIndex, phobosCount, 4.0); // 火卫一贴得更近
    currentIndex += phobosCount;

    const deimosCount = 1000;
    createMoon(0.5, 28.0, currentIndex, deimosCount, 5.0);
    currentIndex += deimosCount;

    // 平滑阶跃函数替代器 (JS 简易实现 smoothstep)
    const smoothstep = (min, max, value) => {
      let x = Math.max(0, Math.min(1, (value - min) / (max - min)));
      return x * x * (3 - 2 * x);
    };

    for(let i = currentIndex; i < particles; i++) {
        rIds[i] = Math.random();
        
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        const dx = Math.sin(phi) * Math.cos(theta);
        const dy = Math.cos(phi);
        const dz = Math.sin(phi) * Math.sin(theta);
        
        let x, y, z, size, op, spd, type; 
        let ptColor = new THREE.Color();
        
        let absY = Math.abs(dy);
        let rVal = Math.random();

        if (rVal < 0.15) {
            type = 3.0; spd = 0.5 + Math.random(); 
            let dR = R * (1.01 + Math.random() * 0.05); 
            x = dR * dx; y = dR * dy; z = dR * dz;
            size = 3.0; op = 0.4;
            ptColor.lerpColors(palette.sand, palette.rust, Math.random());
        } 
        else {
            size = 2.5; op = 1.0; spd = 0.0;
            vDir.set(dx, dy, dz);
            
            let r_factor = 0.995 + Math.random() * 0.01; 
            ptColor.lerpColors(palette.rust, Math.random() > 0.6 ? palette.ochre : palette.darkDesert, Math.random() * 0.8);

            if (absY > 0.88) {
                type = 2.0; size = 2.2; 
                ptColor.copy(palette.ice);
            } else {
                type = 0.0;
                
                // 【优化点 1: 奥林匹斯山 - 宽广的盾状火山】
                let distOM = vDir.distanceTo(dirOlympus);
                if (distOM < 0.35) { // 加宽基底
                    let elevation = smoothstep(0.35, 0.0, distOM); // 平滑隆起
                    r_factor += elevation * 0.055; 
                    
                    // 只在火山口极近处(峰顶)添加高光霜雪
                    let frost = smoothstep(0.12, 0.0, distOM);
                    ptColor.lerp(palette.olympusPeak, frost * 0.9);
                }

                for (let c of craters) {
                    let dC = vDir.distanceTo(c.dir);
                    if (dC < c.rad) {
                        let depression = smoothstep(c.rad, 0.0, dC);
                        r_factor -= depression * c.depth;
                        ptColor.lerp(palette.darkDesert, depression * 0.85);
                    }
                }

                // 【优化点 2: 水手号谷 - 连绵深邃的断崖峡谷】
                if (theta > 1.0 && theta < 5.0) { // 延长峡谷
                    let curvePhi = Math.PI / 2 + Math.sin(theta * 2.8) * 0.1; // 增加蜿蜒感
                    let distCanyon = Math.abs(phi - curvePhi);

                    if (distCanyon < 0.08) {
                        // 峡谷深度：越靠近中心越深
                        let trenchDepth = smoothstep(0.08, 0.0, distCanyon);
                        r_factor -= trenchDepth * 0.025; // 真实地下陷，而非丢弃粒子

                        if (distCanyon < 0.03) {
                            // 谷底深渊：极度暗色
                            ptColor.lerp(palette.canyonDeep, smoothstep(0.03, 0.0, distCanyon));
                        } else {
                            // 谷壁高光：在凹陷的边缘提亮，增强 3D 立体感
                            ptColor.lerp(palette.canyonEdge, smoothstep(0.08, 0.03, distCanyon) * 0.8);
                        }
                    }
                }
            }
            
            x = (R * r_factor) * dx; 
            y = (R * r_factor) * dy; 
            z = (R * r_factor) * dz;
        }

        pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z; 
        cols[i*3] = ptColor.r; cols[i*3+1] = ptColor.g; cols[i*3+2] = ptColor.b;
        prms[i*4]=size; prms[i*4+1]=op; prms[i*4+2]=spd; prms[i*4+3]=type;
    }
    return { positions: pos, colors: cols, params: prms, randomIds: rIds };
  }, []);

  const config = useMemo(() => ({ currentScale: 1.0, currentRotX: 0.2, currentRotY: 0.0, autoIdleTime: 0 }), []);

  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;
    
    // 【核心黑科技 1：瞬态读取】绕过 React 直接获取当前视图
    const globalState = useGestureStore.getState();
    const isVisible = globalState.currentView === 'MARS';
    
    // 【核心黑科技 2：底层控制】直接开关 GPU 的可见性
    pointsRef.current.visible = isVisible;
    
    // 【核心黑科技 3：帧休眠】如果不可见，直接 return，阻断所有计算！
    if (!isVisible) return;

    const { systemState, smoothedPinchDist, smoothedPalmX, smoothedPalmY } = globalState;
    let targetScale = 1.0, targetRotX = 0.2, targetRotY = 0.0;

    if (systemState === 'IDLE') {
        config.autoIdleTime += 0.01;
        targetScale = 1.0 + Math.sin(config.autoIdleTime * 0.8) * 0.05;
        targetRotX = 0.43 + Math.sin(config.autoIdleTime * 0.3) * 0.05;
        targetRotY = Math.sin(config.autoIdleTime * 0.2) * 0.3; 
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
        <bufferAttribute attach="attributes-customColor" count={colors.length / 3} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-aParams" count={params.length / 4} array={params} itemSize={4} />
        <bufferAttribute attach="attributes-aRandomId" count={randomIds.length} array={randomIds} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={marsVertexShader}
        fragmentShader={marsFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}