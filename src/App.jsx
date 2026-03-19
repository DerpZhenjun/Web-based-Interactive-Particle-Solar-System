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

import './App.css'; 

function CameraController() {
  useFrame((state) => {
    const currentView = useGestureStore.getState().currentView;
    const targetZ = currentView === 'HOME' ? 150 : 100;
    state.camera.position.z += (targetZ - state.camera.position.z) * 0.05;
  });
  return null;
}

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
    <div style={{ width: '100%', height: '100%', backgroundColor: '#000', overflow: 'hidden', position: 'absolute', top: 0, left: 0 }}>
      
      {/* 🚀 赛博朋克全屏加载层：当模型（20MB）正在下载时显示 */}
      {!isTrackerReady && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: '#000', display: 'flex', flexDirection: 'column', 
          justifyContent: 'center', alignItems: 'center', zIndex: 10000, color: '#00ffcc',
          fontFamily: 'monospace', letterSpacing: '4px'
        }}>
          {/* 核心旋转光圈 */}
          <div style={{
             width: '60px', height: '60px', border: '3px solid rgba(0,255,204,0.1)',
             borderTop: '3px solid #00ffcc', borderRadius: '50%', 
             animation: 'spin 1s linear infinite', marginBottom: '25px',
             boxShadow: '0 0 20px rgba(0,255,204,0.2)'
          }}></div>
          <h2 style={{ fontSize: '1.2rem', textShadow: '0 0 10px #00ffcc' }}>INITIATING NEURAL ENGINE</h2>
          <p style={{ color: '#555', fontSize: '12px', marginTop: '10px', letterSpacing: '2px' }}>
            SYNCHRONIZING CORE MODELS (20MB) ...
          </p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* 1. 核心手势追踪器 */}
      <HandTracker onReady={() => setIsTrackerReady(true)} />

      {/* 2. 3D 渲染画布层 */}
      <Canvas 
        camera={{ position: [0, 0, 150], fov: 60 }} 
        dpr={[1, 1.5]} 
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      >
        <CameraController />
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

      {/* 3. 2D UI 叠加层：当 Tracker Ready 后才显示 UI */}
      {isTrackerReady && !isFullscreen && (
        <>
          <Overlay onToggleFullscreen={toggleFullscreen} />
          <FeaturePanel />
        </>
      )}

    </div>
  );
}