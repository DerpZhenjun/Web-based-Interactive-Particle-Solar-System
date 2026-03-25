import { useEffect, useRef } from 'react';
import { useGestureStore } from '../../store/useGestureStore';

export default function HandTracker({ onReady }) {
  const videoRef = useRef(null);
  const lostHandFrames = useRef(0);
  const isRunning = useRef(true);
  const fistFrames = useRef(0);
  const vulcanFrames = useRef(0); 
  
  const gestureHistory = useRef([]);
  const HISTORY_LENGTH = 12; 

  useEffect(() => {
    isRunning.current = true;
    let cameraInstance = null;
    let handsInstance = null;

    const initEngine = async () => {
      const Hands = window.Hands;
      const Camera = window.Camera;

      if (!Hands || !Camera) return;

      // ==========================================
      // 🚀 核心架构：动态 CDN 寻路与测速系统
      // ==========================================
      const findBestNode = async () => {
        // 1. 本地开发环境：无条件使用本地路径，保证断网可用
        if (import.meta.env.DEV) {
          console.log("🛠️ 本地开发环境：直连本地模型");
          return `${import.meta.env.BASE_URL}mediapipe/`;
        }

        // 2. 线上环境：测速节点池
        const nodes = [
          `${import.meta.env.BASE_URL}mediapipe/`,             // 节点A：GitHub Pages 自身服务器 (可能慢)
          `https://fastly.jsdelivr.net/npm/@mediapipe/hands/`, // 节点B：Fastly CDN (国内连通率极高，速度快)
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/`,    // 节点C：JsDelivr 全球节点 (国际通用备用)
          `https://unpkg.com/@mediapipe/hands/`                // 节点D：Unpkg (终极保底)
        ];

        for (const url of nodes) {
          try {
            // 设置 2.5 秒的超时熔断机制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            
            // 抓取一个 30KB 的加载器文件测试连通性
            const res = await fetch(`${url}hands_solution_packed_assets_loader.js`, { 
                method: 'GET', 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            
            if (res.ok) {
              console.log("🚀 神经引擎：已锁定最佳高速节点 ->", url);
              return url;
            }
          } catch (e) {
            console.warn(`⚠️ 节点超时或拦截，正在切换下一节点... (${url})`);
          }
        }
        
        // 如果极度倒霉全部失效，保底强行返回 Fastly
        return `https://fastly.jsdelivr.net/npm/@mediapipe/hands/`;
      };

      // 等待测速完成拿到最快路径
      const activeBaseUrl = await findBestNode();

      // 如果在测速期间用户离开了页面，立刻停止初始化
      if (!isRunning.current) return;

      handsInstance = new Hands({
        locateFile: (file) => `${activeBaseUrl}${file}`
      });

      // 性能释放：modelComplexity 设为 0 杜绝卡顿
      handsInstance.setOptions({ 
        maxNumHands: 1, 
        modelComplexity: 0, 
        minDetectionConfidence: 0.7, 
        minTrackingConfidence: 0.7 
      });

      const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

      handsInstance.onResults((results) => {
        if (!isRunning.current) return;
        if (onReady) onReady(); 
        const store = useGestureStore.getState();

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          lostHandFrames.current = 0;
          const hand = results.multiHandLandmarks[0];

          const wrist = hand[0];
          const palmSize = dist(hand[5], hand[17]); 

          const isIndexUp = dist(hand[8], wrist) > dist(hand[5], wrist) * 1.3;
          const isIndexDown = dist(hand[8], wrist) < dist(hand[5], wrist) * 1.15;
          const isMiddleUp = dist(hand[12], wrist) > dist(hand[9], wrist) * 1.3;
          const isMiddleDown = dist(hand[12], wrist) < dist(hand[9], wrist) * 1.15;
          const isRingUp = dist(hand[16], wrist) > dist(hand[13], wrist) * 1.3;
          const isRingDown = dist(hand[16], wrist) < dist(hand[13], wrist) * 1.15;
          const isPinkyUp = dist(hand[20], wrist) > dist(hand[17], wrist) * 1.3;
          const isPinkyDown = dist(hand[20], wrist) < dist(hand[17], wrist) * 1.15;

          const thumbDist = dist(hand[4], hand[9]);
          const isThumbOut = thumbDist > palmSize * 1.35;
          const isThumbIn = thumbDist < palmSize * 1.05;

          const fingersSpread = dist(hand[8], hand[20]) > palmSize * 1.2; 
          const pinchDist = dist(hand[4], hand[8]); 
          const isPinching = pinchDist < palmSize * 0.4;
          
          const isFist = isIndexDown && isMiddleDown && isRingDown && isPinkyDown && isThumbIn && !isPinching;

          const isSevenGesture = dist(hand[4], hand[8]) < palmSize * 0.4 && 
                                 dist(hand[4], hand[12]) < palmSize * 0.4 && 
                                 isRingDown && isPinkyDown;
                                 
          const isIndexHook = dist(hand[6], wrist) > dist(hand[5], wrist) * 1.1 && 
                              dist(hand[8], wrist) < dist(hand[6], wrist);
          const isNineGesture = isIndexHook && isMiddleDown && isRingDown && isPinkyDown && isThumbIn;

          const gap1 = dist(hand[8], hand[12]);  
          const gap2 = dist(hand[12], hand[16]); 
          const gap3 = dist(hand[16], hand[20]); 
          const isVulcanShape = gap2 > gap1 * 1.2 && gap2 > gap3 * 1.2 && gap2 > palmSize * 0.25;
          const isVulcan = store.currentView === 'EARTH' && isVulcanShape;

          let rawGesture = null;

          if (store.currentView === 'HOME') {
              if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
                  if (isThumbIn && !fingersSpread) rawGesture = 'HOME'; 
                  else if (isThumbIn && fingersSpread) rawGesture = 'EARTH'; 
                  else if (isThumbOut) rawGesture = 'MARS'; 
              } 
              else if (isIndexUp && isMiddleDown && isRingDown && isPinkyDown) {
                  if (isThumbIn) rawGesture = 'SUN'; 
                  else if (isThumbOut) rawGesture = 'URANUS'; 
              }
              else if (isIndexUp && isMiddleUp && isRingDown && isPinkyDown && isThumbIn) {
                  rawGesture = 'MERCURY'; 
              }
              else if (isIndexUp && isMiddleUp && isRingUp && isPinkyDown && isThumbIn) {
                  rawGesture = 'VENUS'; 
              }
              else if (isIndexDown && isMiddleDown && isRingDown && isPinkyUp && isThumbOut) {
                  rawGesture = 'JUPITER'; 
              }
              else if (isNineGesture) {
                  rawGesture = 'NEPTUNE'; 
              } else if (isSevenGesture) {
                  rawGesture = 'SATURN'; 
            }
          } else {
              if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && isThumbIn && !fingersSpread) {
                  rawGesture = 'HOME'; 
              }
          }

          let isAttemptingVulcan = false;
          if (isVulcan) {
              vulcanFrames.current++;
              isAttemptingVulcan = true; 
              if (vulcanFrames.current === 4) { 
                  window.dispatchEvent(new Event('TRIGGER_ANGEL'));
                  vulcanFrames.current = -100; 
              }
          } else {
              if (vulcanFrames.current > 0) {
                  vulcanFrames.current--;
                  isAttemptingVulcan = true; 
              } else if (vulcanFrames.current < 0) {
                  vulcanFrames.current++; 
              }
          }

          if (rawGesture) {
              gestureHistory.current.push(rawGesture);
              if (gestureHistory.current.length > HISTORY_LENGTH) gestureHistory.current.shift();

              if (gestureHistory.current.length === HISTORY_LENGTH) {
                  const isAbsolutelyStable = gestureHistory.current.every(g => g === rawGesture);
                  if (isAbsolutelyStable && store.currentView !== rawGesture) {
                      store.setCurrentView(rawGesture);
                      store.setSystemState('IDLE'); 
                      gestureHistory.current = []; 
                  }
              }
          } else {
              gestureHistory.current = [];
          }

          if (isFist) {
              fistFrames.current++;
              if (fistFrames.current > 15) {
                  store.updateGesture('IDLE', store.smoothedPinchDist, 0.5, 0.5);
              }
          } else if (rawGesture !== 'HOME' && !isAttemptingVulcan) {
              fistFrames.current = 0; 
              const palm = hand[9];
              store.updateGesture('TRACKING',
                  store.smoothedPinchDist + (pinchDist - store.smoothedPinchDist) * 0.15,
                  store.smoothedPalmX + (palm.x - store.smoothedPalmX) * 0.15,
                  store.smoothedPalmY + (palm.y - store.smoothedPalmY) * 0.15
              );
          } else {
              fistFrames.current = 0;
          }

        } else {
          lostHandFrames.current++;
          if (lostHandFrames.current > 5 && store.systemState === 'TRACKING') store.setSystemState('FROZEN');
          gestureHistory.current = [];
          fistFrames.current = 0;
          vulcanFrames.current = 0;
        }
      });

      cameraInstance = new Camera(videoRef.current, { 
        onFrame: async () => { 
          if (isRunning.current && videoRef.current) {
            try { 
              await handsInstance.send({ image: videoRef.current }); 
            } catch (e) {}
          }
        }, 
        width: 640, 
        height: 480 
      });
      cameraInstance.start();
    };

    // 执行异步初始化逻辑
    initEngine();

    // 组件卸载时的清理工作
    return () => { 
      isRunning.current = false; 
      if (cameraInstance) cameraInstance.stop(); 
      if (handsInstance) handsInstance.close();
    };
  }, [onReady]);

  return <video ref={videoRef} style={{ display: 'none' }} />;
}