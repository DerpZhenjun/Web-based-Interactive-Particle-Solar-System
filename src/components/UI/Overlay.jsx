import { useGestureStore } from '../../store/useGestureStore';

const PLANET_DB = {
  HOME: { title: "SYSTEM OVERVIEW", color: "#ffffff", type: "GALACTIC MAP", info: "AWAITING TARGET" },
  SUN: { title: "HELIOS", color: "#ff5500", type: "G-TYPE MAIN-SEQUENCE STAR", info: "CORE TEMP: 15M °C" },
  MERCURY: { title: "MERCURY", color: "#888888", type: "TERRESTRIAL PLANET", info: "EXOSPHERE DETECTED" },
  VENUS: { title: "VENUS", color: "#e3bb76", type: "TERRESTRIAL PLANET", info: "TOXIC ATMOSPHERE" },
  EARTH: { title: "EARTH", color: "#4b90dd", type: "TERRESTRIAL PLANET", info: "HABITABLE ZONE" },
  MARS: { title: "MARS", color: "#c1440e", type: "TERRESTRIAL PLANET", info: "RUST SURFACE" },
  JUPITER: { title: "JUPITER", color: "#d39c7e", type: "GAS GIANT", info: "GREAT RED SPOT ACTIVE" },
  SATURN: { title: "SATURN", color: "#ead6b8", type: "GAS GIANT", info: "RING SYSTEM STABLE" },
  URANUS: { title: "URANUS", color: "#00ffff", type: "ICE GIANT", info: "EXTREME TILT" },
  NEPTUNE: { title: "NEPTUNE", color: "#274687", type: "ICE GIANT", info: "SUPERSONIC WINDS" },
};

// 接收从 App 传来的 isLoading 和 onToggleFullscreen 函数
export default function Overlay({ isLoading, onToggleFullscreen }) {
  const { systemState, currentView } = useGestureStore();

  let statusText = systemState === 'IDLE' ? "STANDBY / AUTO-ORBIT" : (systemState === 'TRACKING' ? "FULL HAND CONTROL" : "MAGNETIC LOCK");
  let statusClass = systemState === 'IDLE' ? "idle-state" : (systemState === 'TRACKING' ? "active-pulse" : "frozen-state");

  const currentInfo = PLANET_DB[currentView] || PLANET_DB.HOME;
  const isHome = currentView === 'HOME';

  return (
    <>
      <style>{`
        .ui-layer { position: absolute; top: 40px; left: 40px; z-index: 10; pointer-events: none; color: white; font-family: 'Courier New', Courier, monospace; }
        .glass-panel { 
            background: linear-gradient(135deg, rgba(10, 2, 0, 0.7) 0%, rgba(20, 10, 5, 0.4) 100%);
            backdrop-filter: blur(16px); padding: 30px 40px; border-radius: 4px; 
            border: 1px solid rgba(255, 255, 255, 0.05); border-left: 4px solid ${currentInfo.color}; 
            box-shadow: 0 15px 35px rgba(0,0,0,0.7), inset 0 0 20px rgba(255,255,255,0.02); 
            transition: all 0.5s ease; min-width: 380px;
        }
        h1 { font-weight: 700; font-size: 2.2rem; margin: 0 0 5px 0; color: ${currentInfo.color}; letter-spacing: 8px; text-transform: uppercase; text-shadow: 0 0 20px ${currentInfo.color}AA; }
        .subtitle { font-size: 0.8rem; color: #888; letter-spacing: 3px; margin-bottom: 20px; text-transform: uppercase; }
        .status-text { font-size: 0.85rem; color: #bbb; line-height: 1.9; }
        .highlight { font-weight: bold; letter-spacing: 1px; }
        .active-pulse { animation: pulse 1.5s infinite; color: #00ff88; }
        .frozen-state { color: #ff3300; }
        .idle-state { color: ${currentInfo.color}; opacity: 0.8; }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; text-shadow: 0 0 15px rgba(0,255,136,1); } 100% { opacity: 0.6; } }
        
        .author-btn { position: absolute; top: 40px; right: 40px; z-index: 10; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); color: #aaa; padding: 10px 20px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 3px; backdrop-filter: blur(8px); }
        .author-btn span { color: #fff; font-weight: bold; }

        /* 新增：全屏按钮样式 */
        .fullscreen-btn { 
            position: absolute; top: 90px; right: 40px; z-index: 10; 
            background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); 
            color: #aaa; padding: 10px 20px; font-size: 0.75rem; text-transform: uppercase; 
            letter-spacing: 3px; backdrop-filter: blur(8px); cursor: pointer; transition: all 0.3s ease;
        }
        .fullscreen-btn:hover { border-color: #00ff88; color: #fff; box-shadow: 0 0 15px rgba(0, 255, 136, 0.3); }

        .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 20; color: #fff; font-size: 1rem; letter-spacing: 6px; font-family: monospace; animation: blink 1s infinite; background: rgba(0,0,0,0.7); padding: 20px 40px; border: 1px solid #333; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .divider { width: 100%; height: 1px; background: rgba(255,255,255,0.1); margin: 15px 0; }
        .nav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 15px; margin-top: 10px; }
        .cmd-key { color: ${currentInfo.color}; font-weight: bold; transition: color 0.5s ease; display: inline-block; width: 35px;}
      `}</style>
      
      {/* 顶部按钮组 */}
      <div className="author-btn">SYSTEM BY <span>DerpZhenjun</span></div>
      
      {/* 触发全屏的互动按钮 */}
      <button className="fullscreen-btn" onClick={onToggleFullscreen}>[F] FULL SCREEN</button>

      {isLoading && <div className="loading">CALIBRATING NEURAL SENSORS...</div>}

      <div className="ui-layer">
        <div className="glass-panel">
          <h1>{currentInfo.title}</h1>
          <div className="subtitle">CLASS: {currentInfo.type} | {currentInfo.info}</div>
          
          <div className="status-text">
            TELEMETRY: <span className={`highlight ${statusClass}`}>{statusText}</span><br/>
            MOTION LOCK: <span style={{color: systemState === 'FROZEN' ? '#ff3300' : '#555'}}>ON (DROP HAND TO FREEZE)</span><br/>
            
            <div className="divider"></div>
            
            {isHome ? (
              <>
                <span style={{color: '#fff', letterSpacing: '2px'}}>GESTURE TARGETS:</span>
                <div className="nav-grid">
                  <div>&gt; <span className="cmd-key">[1]</span> HELIOS</div>
                  <div>&gt; <span className="cmd-key">[6]</span> JUPITER</div>
                  <div>&gt; <span className="cmd-key">[2]</span> MERCURY</div>
                  <div>&gt; <span className="cmd-key">[7]</span> SATURN</div>
                  <div>&gt; <span className="cmd-key">[3]</span> VENUS</div>
                  <div>&gt; <span className="cmd-key">[8]</span> URANUS</div>
                  <div>&gt; <span className="cmd-key">[4]</span> EARTH</div>
                  <div>&gt; <span className="cmd-key">[9]</span> NEPTUNE</div>
                  <div>&gt; <span className="cmd-key">[5]</span> MARS</div>
                  <div style={{color: '#aaa'}}>&gt; <span className="cmd-key">[✋]</span> OVERVIEW</div>
                </div>
                <div className="divider"></div>
                <span style={{color: '#777', fontSize: '0.75rem'}}>* HOLD FINGERS 0.5s TO INITIATE WARP JUMP</span><br/>
                <span style={{color: '#777', fontSize: '0.75rem'}}>* PINCH TO SCALE / FIST TO RESET POSITION</span>
              </>
            ) : (
              <>
                <span style={{color: '#fff', letterSpacing: '2px'}}>SYSTEM CONTROL:</span><br/>
                &gt; <span className="cmd-key">[✋]</span> OPEN PALM TO RETURN HOME<br/>
                &gt; <span className="cmd-key">[🤏]</span> PINCH TO ZOOM & SCALE<br/>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}