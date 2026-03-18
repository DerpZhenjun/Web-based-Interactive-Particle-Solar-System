import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGestureStore } from '../store/useGestureStore';

// ==========================================
// 太阳系总览 Shader (星尘 + 白亮轨道 + 微缩行星模型)
// ==========================================
const vertexShader = `
  attribute vec4 aParams; // x: size, y: opacity, z: orbitSpeed, w: type
  attribute vec3 customColor; 
  attribute float aRandomId;
  
  varying vec3 vColor; 
  varying float vOpacity; 
  varying float vType;

  uniform float uTime; 
  uniform float uScale; 

  mat2 rotate2d(float _angle){ return mat2(cos(_angle),-sin(_angle), sin(_angle),cos(_angle)); }

  void main() {
      vec3 pos = position; 
      float type = aParams.w; 
      float orbitSpeed = aParams.z;
      
      // ==========================================
      // 动力系统：公转与自转
      // ==========================================
      if (type == 0.0) {
          // 【背景星尘】极慢的整体旋转
          pos.xz = rotate2d(uTime * 0.01) * pos.xz; 
      } else if (type == 1.0) {
          // 【白亮轨道线】稍微转动一点让线条有流动感
          pos.xz = rotate2d(uTime * 0.02) * pos.xz;
      } else if (type == 2.0) {
          // 【微缩太阳】自转
          pos.xz = rotate2d(uTime * 0.1) * pos.xz;
      } else if (type == 3.0) {
          // 【微缩行星】绕太阳公转 (根据轨道速度)
          pos.xz = rotate2d(uTime * orbitSpeed) * pos.xz;
      }

      // ==========================================
      // 上帝视角倾角 (打破“一条直线”的俯视感)
      // ==========================================
      // 绕 X 轴旋转约 60度 (1.05 弧度)，让我们能俯视整个星盘
      float tiltX = 1.05; 
      float cx = cos(tiltX), sx = sin(tiltX);
      float ry = pos.y * cx - pos.z * sx; 
      float rz = pos.y * sx + pos.z * cx; 
      pos.y = ry; pos.z = rz;

      // 绕 Y 轴稍微侧移一点 (0.2 弧度)，增加空间纵深
      float tiltY = 0.2;
      float cy = cos(tiltY), sy = sin(tiltY);
      float rx = pos.x * cy + pos.z * sy; 
      rz = -pos.x * sy + pos.z * cy; 
      pos.x = rx; pos.z = rz;

      vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      float dist = -mvPosition.z;
      
      // 动态大小计算
      float pointSize = aParams.x * (150.0 / dist); 
      if (type == 1.0) pointSize *= 0.5; // 轨道线极细
      if (type >= 2.0) pointSize *= 1.3; // 实体星球稍微放大
      
      gl_PointSize = clamp(pointSize, 0.0, 60.0);

      vColor = customColor; 
      vOpacity = aParams.y; 
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
      
      float glow = exp(-r2 * 2.5); 
      vec3 finalColor = vColor;
      float alpha = glow * vOpacity; 

      if (vType == 0.0) {
          // 【背景星尘】
          finalColor = mix(vColor, vec3(0.5, 0.7, 1.0), r2 * 0.5);
          alpha *= 0.5; 
      } 
      else if (vType == 1.0) {
          // 【轨道线】极致白亮
          finalColor = vec3(1.0, 1.0, 1.0); // 纯白色
          alpha *= 1.5; // 提高亮度配合 AdditiveBlending
      }
      else if (vType == 2.0) {
          // 【太阳】中心白热化，边缘泛黄
          finalColor = mix(vec3(1.0, 1.0, 1.0), vColor, r2);
          alpha *= 1.2;
      }
      else if (vType == 3.0) {
          // 【行星】保留自身颜色
          finalColor = mix(vColor, vec3(0.0), r2 * 0.3); // 增加一点点立体阴影感
          alpha *= 1.0;
      }
      
      gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function SolarSystemOverview() {
  const pointsRef = useRef(); 
  const materialRef = useRef();

  const { positions, colors, params, randomIds } = useMemo(() => {
    const particles = 250000; 
    const pos = new Float32Array(particles * 3);
    const cols = new Float32Array(particles * 3);
    const prms = new Float32Array(particles * 4);
    const rIds = new Float32Array(particles);
    
    let currentIndex = 0;

    // 辅助函数：生成一个球体（用于太阳和行星）
    const createSphere = (radius, orbitRadius, angle, color, type, orbitSpeed, count) => {
        // 先计算出球体在轨道上的中心坐标
        const cx = orbitRadius * Math.cos(angle);
        const cy = 0;
        const cz = orbitRadius * Math.sin(angle);

        for(let i = 0; i < count; i++) {
            let idx = currentIndex;
            rIds[idx] = Math.random();

            const phi = Math.acos(2 * Math.random() - 1);
            const theta = 2 * Math.PI * Math.random();
            const r = radius * Math.cbrt(Math.random()); // 体积均匀分布

            pos[idx*3]   = cx + r * Math.sin(phi) * Math.cos(theta);
            pos[idx*3+1] = cy + r * Math.cos(phi);
            pos[idx*3+2] = cz + r * Math.sin(phi) * Math.sin(theta);

            cols[idx*3]   = color.r; 
            cols[idx*3+1] = color.g; 
            cols[idx*3+2] = color.b; 

            prms[idx*4]   = 1.5 + Math.random(); // Size
            prms[idx*4+1] = 0.9;                 // Opacity
            prms[idx*4+2] = orbitSpeed;          // Orbit Speed
            prms[idx*4+3] = type;                // Type (2=Sun, 3=Planet)
            
            currentIndex++;
        }
    };

    // ==========================================
    // 1. 生成太阳 (Type 2)
    // ==========================================
    createSphere(8.0, 0, 0, new THREE.Color('#FFCC00'), 2.0, 0.0, 20000);

    // ==========================================
    // 2. 生成八大行星 (Type 3)
    // ==========================================
    const orbitRadii = [18, 28, 38, 48, 70, 95, 115, 135];
    const planetSizes = [0.8, 1.5, 1.6, 1.0, 4.5, 3.5, 2.2, 2.1];
    const planetColors = [
        '#A8A8A8', '#E3DAC5', '#2277FF', '#FF4422', 
        '#D97326', '#C9A070', '#73D2F3', '#0047AB'
    ].map(c => new THREE.Color(c));
    // 越外层公转越慢，模拟真实物理规律
    const orbitSpeeds = [0.8, 0.6, 0.5, 0.4, 0.2, 0.15, 0.1, 0.08];

    for(let o = 0; o < 8; o++) {
        const randomStartAngle = Math.random() * Math.PI * 2;
        // 每颗行星分配 5000 个粒子组成实体
        createSphere(planetSizes[o], orbitRadii[o], randomStartAngle, planetColors[o], 3.0, orbitSpeeds[o], 5000);
    }

    // ==========================================
    // 3. 生成白亮轨道线 (Type 1)
    // ==========================================
    const ringCountPerOrbit = 8000;
    for(let o = 0; o < 8; o++) {
        const R = orbitRadii[o];
        for(let i = 0; i < ringCountPerOrbit; i++) {
            let idx = currentIndex;
            rIds[idx] = Math.random();
            
            const theta = Math.random() * Math.PI * 2;
            const spread = (Math.random() - 0.5) * 0.2; // 轨道宽度
            
            pos[idx*3]   = (R + spread) * Math.cos(theta);
            pos[idx*3+1] = (Math.random() - 0.5) * 0.05; // 轨道厚度极薄
            pos[idx*3+2] = (R + spread) * Math.sin(theta);
            
            // 纯白色
            cols[idx*3] = 1.0; 
            cols[idx*3+1] = 1.0; 
            cols[idx*3+2] = 1.0; 

            prms[idx*4]   = 0.6 + Math.random() * 0.4; // Size
            prms[idx*4+1] = 0.5; // Opacity (在 Fragment里会增亮)
            prms[idx*4+2] = 0.0; 
            prms[idx*4+3] = 1.0; // Type 1
            currentIndex++;
        }
    }

    // ==========================================
    // 4. 生成背景星尘 (Type 0)
    // ==========================================
    const bgCount = particles - currentIndex;
    for(let i = 0; i < bgCount; i++) {
        let idx = currentIndex;
        rIds[idx] = Math.random();
        
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = 2 * Math.PI * Math.random();
        const r = 180 + Math.random() * 80; // 包裹整个系统
        
        pos[idx*3]   = r * Math.sin(phi) * Math.cos(theta);
        pos[idx*3+1] = r * Math.cos(phi) * 0.3; // 压扁形成银河系扁平感
        pos[idx*3+2] = r * Math.sin(phi) * Math.sin(theta);
        
        cols[idx*3]   = 0.6 + Math.random() * 0.2; 
        cols[idx*3+1] = 0.7 + Math.random() * 0.2; 
        cols[idx*3+2] = 0.9 + Math.random() * 0.1; 
        
        prms[idx*4]   = 1.0 + Math.random() * 1.5; 
        prms[idx*4+1] = 0.2 + Math.random() * 0.3; 
        prms[idx*4+2] = 0.0; 
        prms[idx*4+3] = 0.0; // Type 0
        currentIndex++;
    }

    return { positions: pos, colors: cols, params: prms, randomIds: rIds };
  }, []);

  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;
    
    // 【核心黑科技：底层显隐控制】
    const globalState = useGestureStore.getState();
    const isVisible = globalState.currentView === 'HOME';
    pointsRef.current.visible = isVisible;
    if (!isVisible) return;

    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, 
    uScale: { value: 1.0 }, 
  }), []);

  return (
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