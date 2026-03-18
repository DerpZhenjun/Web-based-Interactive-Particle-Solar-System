import { create } from 'zustand';

export const useGestureStore = create((set) => ({
  systemState: 'IDLE',
  currentView: 'HOME', // 新增：'HOME' | 'SUN' | 'MERCURY' | 'VENUS' 等
  
  smoothedPinchDist: 0.1,
  smoothedPalmX: 0.5,
  smoothedPalmY: 0.5,

  updateGesture: (newState, pinchDist, palmX, palmY) => set({
    systemState: newState,
    smoothedPinchDist: pinchDist,
    smoothedPalmX: palmX,
    smoothedPalmY: palmY
  }),

  setSystemState: (newState) => set({ systemState: newState }),
  
  // 新增：切换星球视角的专属动作
  setCurrentView: (view) => set({ currentView: view })
}));