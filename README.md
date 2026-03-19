# https://derpzhenjun.github.io/Web-based-Interactive-Particle-Solar-System/

This template provides a professional, high-performance setup for an interactive 3D cosmos. It integrates **React-Three-Fiber** for GPU-accelerated particle rendering and **MediaPipe** for touchless gesture navigation.

# 🌌 Interactive Particle Solar System

> **Explore the Universe through Real-time Hand Gestures**

-----

## 📺 Video Demonstration

> *A full demonstration video showcasing the real-time hand tracking and particle physics will be uploaded here shortly. Stay tuned\!*

-----

## 🌟 Project Overview

This project transforms the standard web experience into a touchless, immersive journey through space. By leveraging millions of particles and custom GLSL shaders, we simulate complex planetary phenomena—from Saturn's Keplerian rings to Jupiter's differential rotation—all controlled by your hands.

  - **High-Performance Shaders**: Millions of particles rendered at 60FPS.
  - **Gesture Navigation**: Precise hand tracking via MediaPipe for seamless planet switching.
  - **Scientific Accuracy**: Orbital velocities and axial tilts based on real-world physics.

-----

## 🚀 Technical Highlights

The engine utilizes custom **Vertex** and **Fragment Shaders** to implement unique features for each celestial body:

| Planet | Scientific Feature | Tech Implementation |
| :--- | :--- | :--- |
| **SUN** | Photosphere | Particle-based boiling convection via high-frequency jitter. |
| **EARTH** | Lunar Tides | Real-time gravity-based deformation using vector dot products. |
| **SATURN** | Keplerian Rings | Orbital velocity calculated using the $1/\sqrt{R}$ relationship. |
| **URANUS** | Axial Tilt | 98° side-rolling rotation matrix applied in the vertex stage. |
| **NEPTUNE** | Storm Systems | 3D Hash Noise combined with time-based fluid dynamics. |

-----

## 🖐️ Gesture Controls

  - **1 Finger (Index)**: Travel to the **Sun**.
  - **4 Fingers (Palm)**: Visit **Earth**.
  - **Hang Loose (🤙)**: Close-up of **Jupiter**.
  - **Pinch (🤏)**: Dynamic Scaling / Zooming.
  - **Four Fingers Closed**: Return to **Home/Solar System Overview**.

-----

## 🛠️ Installation & Running

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/DerpZhenjun/Web-based-Interactive-Particle-Solar-System.git
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Launch the universe:**
    ```bash
    npm run dev
    ```

-----

## 🚧 Roadmap & WIP

I am currently refining the project documentation and optimizing the following:

  - [ ] **Dynamic HUD**: Floating holographic UI for planetary data.
  - [ ] **Milky Way Shader**: Procedurally generated galactic background.
  - [ ] **Gesture Polish**: Refining the "Strict State" detection for 100% accuracy.

-----

**Developed by [@DerpZhenjun](https://www.google.com/search?q=https://github.com/DerpZhenjun)** *Crafted with ✨ and Star-dust.*
