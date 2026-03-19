import { useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber'; 
import { useGestureStore } from './store/useGestureStore'; 
import HandTracker from './components/Trackers/HandTracker';
import Overlay from './components/UI/Overlay';
import Sun from './components/Sun';
import Mercury from './components/Mercury';
import Venus from './components/Venus';
import Earth from './components/Earth';
import Mars from './components/Mars';
import Jupiter from './components/Jupiter';
import Saturn from './components/Saturn';
import Uranus from './components/Uranus';
import Neptune from './components/Neptune';
import SolarSystemOverview from './components/SolarSystemOverview';
import FeaturePanel from './components/FeaturePanel';

// 【修复核心】：必须引入写好的全局/全屏样式！
import './App.css'; 

// --- 独立于 React 渲染周期的摄像机控制器 ---
// 它在底层的 requestAnimationFrame 中运行，实现电影级平滑推拉
function CameraController() {
  useFrame((state) => {
    // 实时读取 Zustand 状态，不引起组件重渲染
    const currentView = useGestureStore.getState().currentView;
    // 太阳系总览拉远到 150，单体星球拉近到 100
    const targetZ = currentView === 'HOME' ? 150 : 100;
    
    // 平滑插值 (Lerp) 推拉镜头
    state.camera.position.z += (targetZ - state.camera.position.z) * 0.05;
  });
  return null;
}

// --- 核心 App 组件 ---
export default function App() {
  const [isTrackerReady, setIsTrackerReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    const handleKeyDown = (e) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => console.warn(err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  return (
    // 【修改点】：将 vw/vh 改为 100%，并锁定绝对定位，彻底锁死布局边界
    <div style={{ width: '100%', height: '100%', backgroundColor: '#000', overflow: 'hidden', position: 'absolute', top: 0, left: 0 }}>
      
      {/* 1. 核心手势追踪器 */}
      <HandTracker onReady={() => setIsTrackerReady(true)} />

      {/* 2. 3D 渲染画布层 */}
      {/* 限制 DPR 保护高分屏，关闭 preserveDrawingBuffer 释放显卡压力 */}
      <Canvas 
        camera={{ position: [0, 0, 150], fov: 60 }} 
        dpr={[1, 1.5]} 
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      >
        {/* 放入平滑镜头控制器 */}
        <CameraController />

        {/* 所有星球组件全部一次性挂载，它们内部将利用 GPU 级剔除技术自我管理显隐，React 不再介入 */}
        <SolarSystemOverview />
        <Sun />
        <Mercury />
        <Venus />
        <Earth />
        <Mars />
        <Jupiter />
        <Saturn />
        <Uranus />
        <Neptune />
      </Canvas>

      {/* 3. 2D UI 叠加层：全屏时自动隐藏 */}
      {!isFullscreen && (
        <>
          <Overlay isLoading={!isTrackerReady} onToggleFullscreen={toggleFullscreen} />
          <FeaturePanel />
        </>
      )}

    </div>
  );
}