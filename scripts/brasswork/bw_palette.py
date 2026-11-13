"""Brasswork icon palette: hue-shifted ramps (dark to light) built around the look spec colours
(/mnt/project-files/portfolio/automation-game/LOOK-SPEC.md). Shadows lean warm brown, highlights lean cream, so every icon
sits in the lamplit workshop instead of reading as neutral grey."""
import icon3d  # noqa: F401,E402  (puts the naOS kit on the path)
from nodefarm_icon_kit import P, ramp

BW = {
    # metals
    "iron": ramp("#14161d", "#262b37", "#3a4252", "#4e5a6e", "#67758c", "#7f8ca3", "#a6b2c4", "#dbe2ea"),
    "gun": ramp("#0e1014", "#1c2028", "#2c323c", "#3e4450", "#545c68", "#6e7884", "#96a0aa", "#c8d0d6"),
    "steel": ramp("#120f0c", "#231d18", "#3a3128", "#4c4237", "#5e5348", "#7d7266", "#a59a8c", "#d6cec0"),
    "cu": ramp("#1e0c06", "#3f160a", "#7a3a18", "#a34a22", "#c4682f", "#e08a48", "#f4b070", "#ffdca8"),
    "al": ramp("#22262c", "#3e454e", "#5f6873", "#87919c", "#aab4bf", "#cdd6e0", "#eaf0f5", "#ffffff"),
    "brass": ramp("#1e1206", "#46290a", "#8a5a1e", "#b07a28", "#d29a3c", "#e8b85a", "#f6d688", "#fff2c8"),
    "patina": ramp("#0c201c", "#163c34", "#245e50", "#3a8774", "#58b09a", "#8ad6c0", "#cdf2e4"),
    # minerals
    "rock": ramp("#16110e", "#2a221d", "#3e342d", "#544840", "#6b625a", "#7a7068", "#988e84", "#bcb2a6"),
    "rust": ramp("#2a0c06", "#5a1c0c", "#8a3016", "#b04a22", "#cf6a36", "#e8945a"),
    "coal": ramp("#060608", "#0e0e12", "#18181e", "#25252b", "#34343e", "#4a4a58", "#6e6e84", "#a8a8c0"),
    "qz": ramp("#2a1a28", "#4a3046", "#73546c", "#a07e96", "#c8a8bc", "#e2c8d6", "#eed9e4", "#fff6fa"),
    "si": ramp("#0a0e1a", "#151e33", "#22304c", "#2f4161", "#3f5576", "#56709a", "#7e98c0", "#bccbe4"),
    "bauxite": ramp("#2a1e14", "#4a3826", "#6e5a42", "#94805f", "#b8a47e", "#d4c4a0", "#ece0c4", "#fff8e8"),
    # surfaces
    "cream": ramp("#3a2c18", "#6e5a3a", "#a8946c", "#d4c49a", "#f0dfb8", "#fff4dc"),
    "board": ramp("#081410", "#0f2219", "#173324", "#214632", "#2e5c42", "#447a58"),
    "wood": ramp("#1a0e06", "#36200e", "#5a3618", "#7a4c22", "#9a6430", "#ba8244"),
    "glass": ramp("#1a2430", "#2a4458", "#3e6e86", "#5ea2b4", "#94d0d8", "#d8f4f0", "#ffffff"),
    "mirror": ramp("#2a2018", "#5a4a3a", "#8e7c66", "#c4b49a", "#ece0c4", "#fff6e4", "#ffffff"),
    "glow": ramp("#5a1c06", "#a8400c", "#e8741c", "#ffa63a", "#ffd070", "#fff0b8", "#fffbe8"),
    "cell": ramp("#0a0c1c", "#141a36", "#1e2a58", "#2c4080", "#4060a8", "#6a8ad0", "#a8c4f0"),
    "brick": ramp("#1e0a06", "#3e160c", "#6a2814", "#8e3a1e", "#b0522c", "#c87040", "#e09a64"),
}
P.update(BW)
