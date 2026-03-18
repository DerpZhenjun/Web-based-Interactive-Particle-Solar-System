import { useEffect, useRef } from 'react';
import { useGestureStore } from '../../store/useGestureStore';

export default function HandTracker({ onReady }) {
  const videoRef = useRef(null);
  const lostHandFrames = useRef(0);
  const isRunning = useRef(true);
  const fistFrames = useRef(0);
  const vulcanFrames = useRef(0); 
  
  const gestureHistory = useRef([]);
  // 12帧（约0.4秒）的绝对稳定期，配合死区逻辑，这个长度刚刚好
  const HISTORY_LENGTH = 12; 

  useEffect(() => {
    isRunning.current = true;
    const Hands = window.Hands;
    const Camera = window.Camera;

    if (!Hands || !Camera) return;

    const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.75, minTrackingConfidence: 0.75 });

    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    hands.onResults((results) => {
      if (!isRunning.current) return;
      if (onReady) onReady(); 
      const store = useGestureStore.getState();

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        lostHandFrames.current = 0;
        const hand = results.multiHandLandmarks[0];

        const wrist = hand[0];
        const palmSize = dist(hand[5], hand[17]); 

        // ==========================================
        // 1. 严格手指状态计算 (Up vs Strict Down)
        // ==========================================
        // 我们不再只判断是否 Up，而是增加 Down 的严格区间。中间地带将被视为过渡态。
        const isIndexUp = dist(hand[8], wrist) > dist(hand[5], wrist) * 1.3;
        const isIndexDown = dist(hand[8], wrist) < dist(hand[5], wrist) * 1.15;

        const isMiddleUp = dist(hand[12], wrist) > dist(hand[9], wrist) * 1.3;
        const isMiddleDown = dist(hand[12], wrist) < dist(hand[9], wrist) * 1.15;

        const isRingUp = dist(hand[16], wrist) > dist(hand[13], wrist) * 1.3;
        const isRingDown = dist(hand[16], wrist) < dist(hand[13], wrist) * 1.15;

        const isPinkyUp = dist(hand[20], wrist) > dist(hand[17], wrist) * 1.3;
        const isPinkyDown = dist(hand[20], wrist) < dist(hand[17], wrist) * 1.15;

        // ==========================================
        // 2. 大拇指状态计算 (引入 Deadzone 死区)
        // ==========================================
        const thumbDist = dist(hand[4], hand[9]);
        // 只有大拇指非常靠外才算 Out，非常靠里才算 In。
        // 在 1.05 到 1.35 之间（切换过程）时，两个都是 false，避免过渡态被误识别！
        const isThumbOut = thumbDist > palmSize * 1.35;
        const isThumbIn = thumbDist < palmSize * 1.05;

        // 杂项特征
        const fingersSpread = dist(hand[8], hand[20]) > palmSize * 1.2; 
        const pinchDist = dist(hand[4], hand[8]); 
        const isPinching = pinchDist < palmSize * 0.4;
        
        // 严格握拳：四个指头必须都处于严格弯曲状态，且拇指收拢，且不是指尖捏合
        const isFist = isIndexDown && isMiddleDown && isRingDown && isPinkyDown && isThumbIn && !isPinching;

        // ==========================================
        // 3. 特型手势特征提取
        // ==========================================
        // 7 (七)：大拇指、食指、中指，三指捏合 (其余两指严格弯曲)
        const isSevenGesture = dist(hand[4], hand[8]) < palmSize * 0.4 && 
                               dist(hand[4], hand[12]) < palmSize * 0.4 && 
                               isRingDown && isPinkyDown;
                               
        // 9 (九)：食指弯曲成钩子状
        const isIndexHook = dist(hand[6], wrist) > dist(hand[5], wrist) * 1.1 && 
                            dist(hand[8], wrist) < dist(hand[6], wrist);
        const isNineGesture = isIndexHook && isMiddleDown && isRingDown && isPinkyDown && isThumbIn;

        // 瓦肯手势 (🖖)
        const gap1 = dist(hand[8], hand[12]);  
        const gap2 = dist(hand[12], hand[16]); 
        const gap3 = dist(hand[16], hand[20]); 
        const isVulcanShape = gap2 > gap1 * 1.2 && gap2 > gap3 * 1.2 && gap2 > palmSize * 0.25;
        const isVulcan = store.currentView === 'EARTH' && isVulcanShape;


        // ==========================================
        // 4. 路由与意图匹配系统 (严格互斥)
        // ==========================================
        let rawGesture = null;

        if (store.currentView === 'HOME') {
            // 四指类
            if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
                if (isThumbIn && !fingersSpread) rawGesture = 'HOME'; // 停：四指并拢
                else if (isThumbIn && fingersSpread) rawGesture = 'EARTH'; // 4：地球 (张开)
                else if (isThumbOut) rawGesture = 'MARS'; // 5：火星
            } 
            // 单指类 (完美解决 1 和 8 的冲突)
            else if (isIndexUp && isMiddleDown && isRingDown && isPinkyDown) {
                if (isThumbIn) rawGesture = 'SUN'; // 1：太阳
                else if (isThumbOut) rawGesture = 'URANUS'; // 8：天王星
            }
            // 双指类
            else if (isIndexUp && isMiddleUp && isRingDown && isPinkyDown && isThumbIn) {
                rawGesture = 'MERCURY'; // 2：水星
            }
            // 三指类
            else if (isIndexUp && isMiddleUp && isRingUp && isPinkyDown && isThumbIn) {
                rawGesture = 'VENUS'; // 3：金星
            }
            // 6类 (🤙)
            else if (isIndexDown && isMiddleDown && isRingDown && isPinkyUp && isThumbOut) {
                rawGesture = 'JUPITER'; // 6：木星
            }
            // 特型类
            else if (isNineGesture) {
                rawGesture = 'NEPTUNE'; // 9：海王星
            } else if (isSevenGesture) {
                rawGesture = 'SATURN'; // 7：土星
            }
        } else {
            // 星球视图中锁定路由，仅允许“四指并拢”退出回城
            if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp && isThumbIn && !fingersSpread) {
                rawGesture = 'HOME'; 
            }
        }

        // --- 瓦肯蓄力逻辑 ---
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

        // --- 手势防抖与确权 ---
        if (rawGesture) {
            gestureHistory.current.push(rawGesture);
            if (gestureHistory.current.length > HISTORY_LENGTH) gestureHistory.current.shift();

            if (gestureHistory.current.length === HISTORY_LENGTH) {
                // 必须连续 N 帧完全一致，才触发切换
                const isAbsolutelyStable = gestureHistory.current.every(g => g === rawGesture);
                if (isAbsolutelyStable && store.currentView !== rawGesture) {
                    store.setCurrentView(rawGesture);
                    store.setSystemState('IDLE'); 
                    gestureHistory.current = []; 
                }
            }
        } else {
            // 关键：一旦进入死区(过渡态)或四不像状态，立即清空累积池，打破连续错误！
            gestureHistory.current = [];
        }

        // --- 星球把玩追踪更新 ---
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

    const camera = new Camera(videoRef.current, { 
      onFrame: async () => { 
        if (isRunning.current && videoRef.current) try { await hands.send({ image: videoRef.current }); } catch (e) {}
      }, width: 640, height: 480 
    });
    camera.start();

    return () => { isRunning.current = false; camera.stop(); };
  }, [onReady]);

  return <video ref={videoRef} style={{ display: 'none' }} />;
}