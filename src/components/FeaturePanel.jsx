import { useState, useEffect } from 'react';
import { useGestureStore } from '../store/useGestureStore';

// 简单直白的物理与粒子表现对比数据库
// const FEATURE_DB = {
//   SUN: [
//     {
//       id: "core",
//       title: "光球层与沸腾对流",
//       reality: "太阳的表面是一个不断翻滚沸腾的等离子体海洋，中心温度极高。",
//       tech: "使用大部分密集粒子构成球体，通过数学函数让粒子在表面产生随机的高频起伏，模拟沸腾感，并利用颜色叠加制造中心白热化的刺眼效果。"
//     },
//     {
//       id: "corona",
//       title: "日冕与太阳风",
//       reality: "太阳最外层极其稀薄的大气，不断向深空吹送出太阳风。",
//       tech: "在球体外围散布极低密度、近乎透明的大颗粒粒子，让它们缓慢向外发散漂移，并在移动中平滑消散，形成若隐若现的光晕。"
//     },
//     {
//       id: "flare",
//       title: "磁场日珥与耀斑",
//       reality: "沿着太阳磁力线爆发出的巨大等离子体抛射物，经常形成壮观的拱门形状。",
//       tech: "通过计算球面的切线方向，让特定的一小部分明亮粒子沿着完美的抛物线轨迹向外喷射并重新落下，构成动态的磁场环流。"
//     }
//   ],
//   MERCURY: [
//     {
//       id: "surface",
//       title: "无大气的岩石坑洼",
//       reality: "水星表面由岩石组成，遍布撞击坑，颜色灰暗。",
//       tech: "将 85% 的粒子高密度压缩，摒弃流体旋转，利用低频噪声 (noise) 模拟地表的坑洼不平感，堆叠灰褐红三色营造出干涩的岩石纹理。"
//     },
//     {
//       id: "exosphere",
//       title: "极其稀薄的散逸层",
//       reality: "严格来说，水星没有真正的大气层，只有一个极其稀薄、不断向太空流失的“散逸层”。",
//       tech: "仅分配极其少量的粒子贴近地表，加入指数级衰减函数，让粒子一旦离开地表便迅速透明化，模拟出一种剥离消散感。"
//     },
//     {
//       id: "sodium_tail",
//       title: "电离钠彗尾",
//       reality: "受太阳风吹拂，水星表面溅射出的原子被推向背日面，形成了一条类似彗星的尾巴。",
//       tech: "提取一部分粒子，迫使它们沿背向太阳的向量作长距离直线运动，并随着距离增加逐渐向外扩散并变透明，拉扯出淡蓝色的尾迹。"
//     }
//   ],
//   VENUS: [
//     {
//       id: "super_rotation",
//       title: "超旋大气与 Y 型云纹",
//       reality: "金星被极厚的大气层包裹，赤道高空的狂风速度极快（比自转快60倍），在紫外线下会呈现出跨越全球的巨大“Y”字形云层纹理。",
//       tech: "让表层浅金色的粒子绕轴高速旋转，并引入“差分旋转”逻辑：赤道粒子跑得快，两极粒子被强行向后拉扯，从而在视觉上自然扯出标志性的 V/Y 型折角。"
//     },
//     {
//       id: "greenhouse",
//       title: "温室效应与爆米花湍流",
//       reality: "金星表面温度高达 460°C，云层中充满了剧烈的对流。由于大气极度浓厚，它的背光面（夜晚）并不是纯黑的，而是透着地狱般的暗红微光。",
//       tech: "移除了透明叠加混合模式，让粒子互相遮挡以体现厚重粘稠感。引入 3D 柏林噪声（Noise）让赤道云带产生翻滚沸腾的立体视觉，并强行给暗面保留了一层暗紫/红色的辉光。"
//     },
//     {
//       id: "lightning_tail",
//       title: "深层闪电与粘稠尾迹",
//       reality: "金星浓厚的硫酸云层深处时常爆发出闪电；同时，由于没有自身磁场保护，厚重的大气正被太阳风缓慢剥离吹散。",
//       tech: "在云层内部埋入少量平时完全透明的粒子，利用时间函数控制它们在极短的瞬间爆发出紫白光；并在背日面拉出一条粗短、沉闷且带有下坠感的粒子尾迹，表现重气体的流失。"
//     }
//   ],
//   EARTH: [
//     {
//       id: "tide",
//       title: "海洋分布与月球潮汐",
//       reality: "地球71%被海洋覆盖。月球的引力牵引着地球的海洋与大气，在正对和背对月球的方向形成动态的潮汐隆起。",
//       tech: "引入真实的高光贴图区分海陆颜色。实时推算月球公转坐标，通过向量点乘计算引力夹角，强行把受到引力影响的海洋和大气粒子向外拉扯，形成视觉可见的动态椭球形隆起。"
//     },
//     {
//       id: "atmosphere",
//       title: "含氧大气与晨昏线",
//       reality: "地球拥有富含氧气和氮气的大气层，在太空中边缘呈现蔚蓝色光晕，且昼夜交替分明。",
//       tech: "在球体外围包裹一层半透明粒子，利用边缘发光算法（Fresnel）制造蔚蓝色的厚重滤镜。结合光源方向计算，实现平滑的昼夜明暗交替。"
//     },
//     {
//       id: "peace",
//       title: "人类祈愿阵列 (隐藏彩蛋)",
//       reality: "面对浩瀚宇宙，人类对和平（PEACE）的永恒祈愿化作守护星球的能量实体。",
//       tech: "后台离屏使用 Canvas 2D 渲染文字并提取数万个像素坐标。利用独立的时间轴，控制 7.5 万颗粒子从地心爆发汇聚成形，最终如光雨般向上消散升华。"
//     }
//   ],
//   MARS: [
//     {
//       id: "terrain",
//       title: "水手谷与奥林匹斯山",
//       reality: "火星拥有太阳系最高的巨大火山（奥林匹斯山）和极其深邃的巨大裂谷（水手谷）。",
//       tech: "完全放弃统一的完美球体。纯靠三维坐标推算，在特定区域强行把粒子向外推高制造雪顶火山；在赤道利用正弦曲线挖空粒子，配合边缘的高光提亮，用视觉欺骗产生深不见底的裂谷。"
//     },
//     {
//       id: "dust_storm",
//       title: "全球性狂躁沙尘暴",
//       reality: "火星表面经常刮起席卷全球的猛烈沙尘暴，让原本清晰的地表特征变得模糊不清。",
//       tech: "在地表上方悬浮一层半透明的红褐色粒子。除了让它们跟随星球自转漂移，还加入了高频低幅的三角函数抖动，完美模拟出风沙的狂躁与混沌感。"
//     },
//     {
//       id: "moons",
//       title: "被捕获的小行星双卫",
//       reality: "火星拥有两颗形状极不规则的微小卫星（火卫一、火卫二），它们轨道极低且公转极快。",
//       tech: "用完全随机的微小半径域，在极近的轨道上生成两块灰褐色的不规则粒子簇。火卫一紧贴表面极速狂奔，火卫二则在稍微倾斜的远轨道缓慢环绕。"
//     }
//   ],
//   JUPITER: [
//     {
//       id: "bands",
//       title: "气态条带与差分自转",
//       reality: "木星是一颗没有固体表面的气态巨行星，不同纬度的狂风将大气拉扯成颜色各异、流速不同的平行条带。",
//       tech: "提取所有粒子的纬度坐标，用数学正弦函数（sin）精准切分出多条风带，让不同纬度的粒子以不同速度甚至反方向进行自转运算。"
//     },
//     {
//       id: "red_spot",
//       title: "大红斑超级风暴",
//       reality: "木星南半球存在一个极其巨大的反气旋风暴（大红斑），足以吞噬整个地球，且拥有极高的风速。",
//       tech: "在特定坐标点生成一个独立的红橙色渐变粒子簇，为其赋予一个倾斜的旋转轴和极高的自转速率，使其像一个真正的飓风眼一样在云层中绞动。"
//     },
//     {
//       id: "moons",
//       title: "伽利略卫星系统",
//       reality: "木星有四颗著名的卫星，地质极其活跃（如木卫一的火山硫磺、木卫二的冰层裂纹、木卫三的磁场等）。",
//       tech: "为四颗卫星分配独立的轨道半径和公转速度。通过着色器给不同的卫星注入微观特效：比如让木卫一的粒子产生高频的向外随机抖动来模拟火山喷发。"
//     }
//   ],
//   SATURN: [
//     {
//       id: "rings",
//       title: "开普勒星环系统",
//       reality: "土星环并非一个整体，而是由无数冰块、岩石组成的复杂环带。越靠近土星内侧的碎片，受引力影响公转速度越快。",
//       tech: "彻底分离本体和星环粒子的运动逻辑。严格按照开普勒定律，利用粒子轨道半径的平方根反比（1/√R）来计算每颗星环粒子的专属公转速度。"
//     },
//     {
//       id: "albedo",
//       title: "冰晶高反照率对比",
//       reality: "土星本体是暗淡的气态物质，但星环由于主要由纯净的冰雪构成，反射阳光的能力（反照率）极强，非常明亮。",
//       tech: "在片元着色器中构建了一套“对比度引擎”，识别出星环粒子后，将其亮度曝光强制拉升至本体粒子的 1.8 倍，在视觉上形成极强的材质区分。"
//     },
//     {
//       id: "chaos",
//       title: "微观碎冰混沌扰动",
//       reality: "星环在极远处看就像平滑的黑胶唱片，但如果飞船极度靠近，就会发现里面是无数疯狂碰撞的碎冰与乱石。",
//       tech: "引入基于摄像机距离的 LOD 机制。当镜头拉近到阈值内，立刻激活 3D 噪声函数，打破原本完美的数学圆形轨道，让粒子产生剧烈的空间错位与混沌感。"
//     }
//   ],
//   URANUS: [
//     {
//       id: "axial_tilt",
//       title: "98度极轴倾角",
//       reality: "天王星在漫长的演化中似乎遭受过剧烈撞击，导致其自转轴完全“躺平”在公转轨道上，像一个滚动的球。",
//       tech: "在着色器渲染序列的最早阶段，强行给整个星球的所有坐标叠加一个 1.71 弧度（约98度）的二维旋转矩阵，使其呈现出独特的侧翻姿态。"
//     },
//     {
//       id: "smooth_surface",
//       title: "极度均匀的冰海",
//       reality: "与其他气态行星不同，天王星表面异常平静，几乎没有明显的条带或风暴，呈现出一种近乎完美、冰冷刺骨的青蓝色泽。",
//       tech: "在粒子生成时放弃了所有经纬度颜色绑定逻辑，随机分配极度相近的青绿、淡蓝色调，并在片元着色器中执行高阶平滑混色，制造出均匀凝固的视觉感受。"
//     },
//     {
//       id: "epsilon_ring",
//       title: "垂直暗弱星环",
//       reality: "天王星同样拥有星环，但它们极度暗弱，充满了灰黑色的冰块杂质。由于本体躺平，这些星环在视觉上是几乎垂直的。",
//       tech: "将这部分粒子分配为低透明度的深灰色，在 Additive Blending 缺失的情况下，深灰色在黑背景下会呈现出一种极其微弱的尘埃感，并跟随本体一同侧翻呈现垂直态。"
//     }
//   ],
//   NEPTUNE: [
//     {
//       id: "great_dark_spot",
//       title: "大黑斑与超音速风暴",
//       reality: "海王星拥有太阳系中最狂暴的超音速风暴系统，并时常出现类似木星大红斑的“大黑斑”高压气旋。",
//       tech: "使用深邃的藏蓝与暗蓝色块单独生成大黑斑粒子簇，并为其赋予独立的偏移中心与狂躁的旋转速度，使其像深海旋涡一样游荡在南半球。"
//     },
//     {
//       id: "fluid_dynamics",
//       title: "高纬度流体噪波",
//       reality: "海王星的甲烷大气在极度严寒中依然保持着极高的活跃度，呈现出非常复杂的流体力学条纹。",
//       tech: "在顶点着色器中引入带有时间维度的 3D Hash 噪波（Noise），并配合纬度渐变函数，让粒子除了公转，还在本地产生粘稠的流体扭曲感。"
//     },
//     {
//       id: "ring_arcs",
//       title: "不连续的弧状环",
//       reality: "海王星的星环非常特别，由于其卫星的引力摄动，星环并没有连成完整的圆，而是聚集成了不连续的“环弧”。",
//       tech: "在星环粒子生成的数学循环中引入条件判断：拦截部分生成逻辑，强行将粒子的起始角度（theta）压缩并聚集在几个特定的弧段区间内。"
//     }
//   ]
// };
const FEATURE_DB = {
  SUN: [
    {
      id: "core",
      title: "Photosphere and Boiling Convection",
      reality: "The surface of the sun is a constantly churning and boiling ocean of plasma, with an extremely high core temperature.",
      tech: "Uses a dense majority of particles to form a sphere, applying mathematical functions to generate random high-frequency fluctuations on the surface to simulate a boiling effect, and utilizes color blending to create a blinding white-hot core."
    },
    {
      id: "corona",
      title: "Corona and Solar Wind",
      reality: "The extremely thin outermost layer of the sun's atmosphere, constantly blowing solar winds into deep space.",
      tech: "Scatters extremely low-density, nearly transparent large particles around the sphere, making them slowly drift outward and smoothly fade away during movement, forming a faint halo."
    },
    {
      id: "flare",
      title: "Magnetic Prominences and Solar Flares",
      reality: "Massive plasma ejections bursting along the sun's magnetic field lines, often forming spectacular arch shapes.",
      tech: "By calculating the tangential direction of the sphere, a specific small group of bright particles is made to eject outward along a perfect parabolic trajectory and fall back, forming a dynamic magnetic circulation."
    }
  ],
  MERCURY: [
    {
      id: "surface",
      title: "Airless Cratered Rock",
      reality: "Mercury's surface is composed of rock, covered in impact craters, and grayish in color.",
      tech: "Compresses 85% of the particles with high density, discarding fluid rotation, and uses low-frequency noise to simulate the uneven cratered surface, stacking gray, brown, and red colors to create a dry, rocky texture."
    },
    {
      id: "exosphere",
      title: "Extremely Thin Exosphere",
      reality: "Strictly speaking, Mercury lacks a true atmosphere, possessing only an extremely thin 'exosphere' that constantly leaks into space.",
      tech: "Allocates only a minute amount of particles close to the surface, incorporating an exponential decay function so that particles quickly become transparent once they leave the surface, simulating a peeling and dissipating effect."
    },
    {
      id: "sodium_tail",
      title: "Ionized Sodium Tail",
      reality: "Swept by the solar wind, atoms sputtered from Mercury's surface are pushed to the night side, forming a tail similar to a comet's.",
      tech: "Extracts a portion of particles, forcing them to move in a long straight line along a vector pointing away from the sun, gradually spreading outward and becoming transparent as distance increases, drawing out a pale blue tail."
    }
  ],
  VENUS: [
    {
      id: "super_rotation",
      title: "Super-rotating Atmosphere and Y-shaped Clouds",
      reality: "Venus is enveloped in an extremely thick atmosphere. The high-altitude winds at the equator are incredibly fast (60 times faster than its rotation), presenting a massive global 'Y' shaped cloud texture under ultraviolet light.",
      tech: "Makes the light golden surface particles rotate at high speed around the axis, introducing a 'differential rotation' logic: equator particles move faster, while polar particles are forcefully pulled back, visually generating the iconic V/Y-shaped angles naturally."
    },
    {
      id: "greenhouse",
      title: "Greenhouse Effect and Popcorn Turbulence",
      reality: "The surface temperature of Venus reaches up to 460°C, and its clouds are filled with violent convection. Due to the extremely dense atmosphere, its unlit side (night) is not pitch black, but reveals a hellish dark red glow.",
      tech: "Removes the transparent additive blending mode, allowing particles to occlude each other to reflect a thick, viscous feel. Introduces 3D Perlin Noise to give the equatorial cloud bands a rolling, boiling 3D visual, and artificially retains a layer of dark purple/red glow on the dark side."
    },
    {
      id: "lightning_tail",
      title: "Deep Lightning and Viscous Wake",
      reality: "Lightning frequently erupts deep within Venus's thick sulfuric acid clouds; meanwhile, lacking a protective magnetic field of its own, the heavy atmosphere is slowly being stripped and blown away by the solar wind.",
      tech: "Embeds a small number of normally completely transparent particles inside the cloud layer, using time functions to control them to burst with purple-white light in fleeting moments; and draws a short, thick, dull particle wake with a sense of falling on the night side to represent the loss of heavy gases."
    }
  ],
  EARTH: [
    {
      id: "tide",
      title: "Ocean Distribution and Lunar Tides",
      reality: "71% of Earth is covered by oceans. The moon's gravity pulls on Earth's oceans and atmosphere, forming dynamic tidal bulges in the directions facing toward and away from the moon.",
      tech: "Introduces realistic specular maps to differentiate land and sea colors. Calculates the moon's orbital coordinates in real-time, using vector dot products to compute the gravitational angle, forcefully pulling outward the ocean and atmosphere particles affected by gravity to form a visually distinct dynamic ellipsoidal bulge."
    },
    {
      id: "atmosphere",
      title: "Oxygen-rich Atmosphere and Terminator Line",
      reality: "Earth has an atmosphere rich in oxygen and nitrogen, presenting an azure halo at its edges in space, with a distinct alternation of day and night.",
      tech: "Wraps a layer of semi-transparent particles around the sphere, utilizing an edge-glow algorithm (Fresnel) to create a thick azure filter. Combined with light source direction calculations, it achieves a smooth transition between day and night."
    },
    {
      id: "peace",
      title: "Human Prayer Array (Hidden Easter Egg)",
      reality: "Facing the vast universe, humanity's eternal prayer for peace (PEACE) transforms into an energy entity guarding the planet.",
      tech: "Uses off-screen Canvas 2D in the background to render text and extract tens of thousands of pixel coordinates. Utilizing an independent timeline, it controls 75,000 particles bursting from the core to converge into shape, eventually dissipating and ascending upward like a rain of light."
    }
  ],
  MARS: [
    {
      id: "terrain",
      title: "Valles Marineris and Olympus Mons",
      reality: "Mars boasts the tallest massive volcano in the solar system (Olympus Mons) and an extremely deep, giant rift valley (Valles Marineris).",
      tech: "Completely abandons a uniform, perfect sphere. Relying purely on 3D coordinate calculations, it forcefully pushes particles outward in specific areas to create a snow-capped volcano; at the equator, it uses sine curves to hollow out particles, combined with edge highlights, using optical illusion to create a seemingly bottomless rift."
    },
    {
      id: "dust_storm",
      title: "Global Raging Dust Storms",
      reality: "Mars's surface frequently experiences fierce dust storms sweeping the globe, blurring originally clear surface features.",
      tech: "Suspends a layer of semi-transparent reddish-brown particles above the surface. Besides letting them drift with the planet's rotation, high-frequency, low-amplitude trigonometric jitter is added, perfectly simulating the frantic and chaotic feel of blowing sand."
    },
    {
      id: "moons",
      title: "Captured Asteroid Twin Moons",
      reality: "Mars has two extremely irregularly shaped, tiny moons (Phobos and Deimos), with very low orbits and extremely fast orbital speeds.",
      tech: "Uses a completely random, tiny radial domain to generate two irregular clusters of grayish-brown particles on very close orbits. Phobos races at extreme speeds clinging to the surface, while Deimos slowly orbits on a slightly tilted, further track."
    }
  ],
  JUPITER: [
    {
      id: "bands",
      title: "Gaseous Bands and Differential Rotation",
      reality: "Jupiter is a gas giant with no solid surface; fierce winds at different latitudes tear the atmosphere into parallel bands of varying colors and flow speeds.",
      tech: "Extracts the latitude coordinates of all particles, uses the mathematical sine function (sin) to accurately slice multiple wind bands, allowing particles at different latitudes to perform rotation calculations at varying speeds or even in opposite directions."
    },
    {
      id: "red_spot",
      title: "Great Red Spot Super Storm",
      reality: "Jupiter's southern hemisphere features a colossal anticyclonic storm (the Great Red Spot), large enough to swallow the entire Earth, possessing extremely high wind speeds.",
      tech: "Generates an independent red-orange gradient particle cluster at specific coordinates, granting it a tilted rotation axis and an extremely high rotation rate, making it churn through the clouds like a true hurricane eye."
    },
    {
      id: "moons",
      title: "Galilean Moons System",
      reality: "Jupiter has four famous moons that are highly geologically active (e.g., Io's volcanic sulfur, Europa's ice cracks, Ganymede's magnetic field).",
      tech: "Assigns independent orbital radii and orbital speeds to the four moons. Micro-effects are injected into different moons via shaders: for instance, causing Io's particles to produce high-frequency, outward random jitter to simulate volcanic eruptions."
    }
  ],
  SATURN: [
    {
      id: "rings",
      title: "Keplerian Ring System",
      reality: "Saturn's rings are not a single solid entity, but a complex band composed of countless ice chunks and rocks. Fragments closer to Saturn's interior orbit faster due to gravity.",
      tech: "Completely separates the motion logic of the main body and the ring particles. Strictly following Kepler's laws, it uses the inverse square root of the particle's orbital radius (1/√R) to calculate the exclusive orbital speed for each ring particle."
    },
    {
      id: "albedo",
      title: "Ice Crystal High Albedo Contrast",
      reality: "Saturn itself consists of dim gaseous matter, but its rings, being mainly composed of pure ice and snow, have an extremely strong ability to reflect sunlight (albedo) and are very bright.",
      tech: "Builds a 'contrast engine' in the fragment shader; upon identifying ring particles, their brightness exposure is forcefully elevated to 1.8 times that of the body particles, forming a stark material distinction visually."
    },
    {
      id: "chaos",
      title: "Microscopic Ice Debris Chaotic Perturbation",
      reality: "From a great distance, the rings look like a smooth vinyl record, but if a spacecraft gets extremely close, it reveals countless madly colliding ice shards and rubble inside.",
      tech: "Introduces a camera distance-based LOD mechanism. When the lens pushes in within the threshold, it immediately activates a 3D noise function, breaking the original perfect mathematical circular orbits, causing the particles to produce severe spatial displacement and a sense of chaos."
    }
  ],
  URANUS: [
    {
      id: "axial_tilt",
      title: "98-Degree Axial Tilt",
      reality: "Uranus seems to have suffered a massive collision during its long evolution, causing its rotation axis to completely 'lie flat' on its orbital plane, like a rolling ball.",
      tech: "In the earliest stage of the shader rendering sequence, a 2D rotation matrix of 1.71 radians (about 98 degrees) is forcefully superimposed onto all coordinates of the entire planet, giving it its unique sideways posture."
    },
    {
      id: "smooth_surface",
      title: "Extremely Uniform Ice Ocean",
      reality: "Unlike other gas planets, Uranus's surface is unusually calm, with almost no obvious bands or storms, presenting a near-perfect, bone-chilling cyan-blue hue.",
      tech: "Abandons all latitude/longitude color binding logic during particle generation, randomly assigning extremely similar cyan and light blue tones, and executes high-order smooth color blending in the fragment shader to create a uniformly congealed visual experience."
    },
    {
      id: "epsilon_ring",
      title: "Vertical Faint Rings",
      reality: "Uranus also possesses rings, but they are extremely faint and full of dark gray ice impurities. Due to the planet lying flat, these rings appear almost vertical visually.",
      tech: "Assigns this set of particles a low-opacity dark gray; in the absence of Additive Blending, dark gray against a black background presents an extremely faint dusty feel, and follows the planet's tilt to appear vertical."
    }
  ],
  NEPTUNE: [
    {
      id: "great_dark_spot",
      title: "Great Dark Spot and Supersonic Storms",
      reality: "Neptune has the most violent supersonic storm systems in the solar system, and frequently exhibits 'Great Dark Spot' high-pressure cyclones similar to Jupiter's Great Red Spot.",
      tech: "Uses deep navy and dark blue patches to separately generate a Great Dark Spot particle cluster, assigning it an independent offset center and frantic rotation speed, making it roam the southern hemisphere like a deep-sea vortex."
    },
    {
      id: "fluid_dynamics",
      title: "High-Latitude Fluid Noise",
      reality: "Neptune's methane atmosphere maintains extremely high activity despite the severe cold, exhibiting very complex fluid dynamic striations.",
      tech: "Introduces 3D Hash Noise with a time dimension in the vertex shader, coordinated with a latitude gradient function, allowing particles to produce a viscous fluid distortion locally in addition to their orbital rotation."
    },
    {
      id: "ring_arcs",
      title: "Discontinuous Ring Arcs",
      reality: "Neptune's rings are very peculiar; due to gravitational perturbations from its moons, the rings do not form complete circles but aggregate into discontinuous 'ring arcs.'",
      tech: "Introduces a conditional check in the mathematical loop of ring particle generation: intercepts part of the generation logic, forcefully compressing and clustering the particles' starting angles (theta) into several specific arc intervals."
    }
  ]
};

export default function FeaturePanel() {
  const { currentView } = useGestureStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 当切换星球时，自动展开面板
  useEffect(() => {
    setIsCollapsed(false);
  }, [currentView]);

  if (currentView === 'HOME' || !FEATURE_DB[currentView]) return null;

  const features = FEATURE_DB[currentView];

  return (
    <>
      <style>{`
        .feature-panel-container {
          position: absolute; top: 50%; left: 40px; transform: translateY(-50%);
          z-index: 15; pointer-events: auto; color: white;
          font-family: 'Courier New', Courier, monospace;
          display: flex; flex-direction: column; gap: 10px;
        }
        
        .toggle-btn {
          align-self: flex-start; background: rgba(10, 2, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2); color: #aaa;
          padding: 5px 15px; border-radius: 4px; cursor: pointer;
          font-family: inherit; font-size: 0.8rem; letter-spacing: 2px;
          backdrop-filter: blur(8px); transition: all 0.3s;
        }
        .toggle-btn:hover { color: #fff; border-color: #ffaa00; }

        .feature-list {
          width: 380px; display: flex; flex-direction: column; gap: 15px;
          transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
          transform-origin: left center;
          opacity: ${isCollapsed ? 0 : 1};
          transform: ${isCollapsed ? 'translateX(-20px) scale(0.95)' : 'translateX(0) scale(1)'};
          pointer-events: ${isCollapsed ? 'none' : 'auto'};
        }

        .feature-card {
          background: linear-gradient(135deg, rgba(10, 2, 0, 0.6) 0%, rgba(20, 10, 5, 0.3) 100%);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1); border-left: 3px solid #ffaa00;
          padding: 15px; border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .feature-title { font-weight: bold; font-size: 0.95rem; color: #ffaa00; margin-bottom: 10px; }
        
        .compare-row { margin-bottom: 8px; }
        .compare-row:last-child { margin-bottom: 0; }
        .compare-label { font-size: 0.65rem; color: #888; text-transform: uppercase; margin-bottom: 3px; }
        .compare-text { font-size: 0.8rem; color: #ddd; line-height: 1.5; }
        .tech-text { color: #88ccff; }
      `}</style>

      <div className="feature-panel-container">
        <button 
          className="toggle-btn" 
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '[+] DATA LOGS' : '[-] CLOSE LOGS'}
        </button>

        <div className="feature-list">
          {features.map((item) => (
            <div className="feature-card" key={item.id}>
              {/* 这里使用 HTML 实体 &gt;&gt; 来替代 >> */}
              <div className="feature-title">&gt;&gt; {item.title}</div>
              
              <div className="compare-row">
                <div className="compare-label">REALITY (现实物理)</div>
                <div className="compare-text">{item.reality}</div>
              </div>
              
              <div className="compare-row">
                <div className="compare-label">PARTICLES (粒子表现)</div>
                <div className="compare-text tech-text">{item.tech}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}