export const RENDER = {
  background: 0x07090d,
  spriteScale: 3,
  fixedStepSec: 1 / 60,
  maxStepsPerFrame: 5,
  hudIntervalMs: 100,
  cameraLerp: 8,
  cameraLookAhead: 0.18,
  aggroRefreshSec: 0.2,
  flowFieldRange: 48,
} as const;

export const PALETTE = {
  road: 0x12151b,
  roadSpeck: 0x1a1e26,
  ground: 0x1e232c,
  groundSeam: 0x262c37,
  wall: 0x05070a,
  shadow: 0x030406,
  debris: 0x4a2f24,
  debrisLight: 0x6e4634,
  roofs: [
    [0x2a3140, 0x363f52, 0x1d222d],
    [0x2c2d36, 0x3a3c48, 0x1f2028],
    [0x253238, 0x31424a, 0x1a2328],
    [0x30293a, 0x3e3550, 0x221d2a],
  ],
  neon: [0x3d7bff, 0x5fe3ff, 0xff4d6d, 0xb27bff],
  accent: 0x3d7bff,
  cyan: 0x5fe3ff,
  danger: 0xff4d6d,
  extraction: 0x7dff9b,
  tierGlow: [0x7dff6a, 0x9fb3c8, 0x5fe3ff, 0x3d7bff, 0xb27bff, 0xffb03d],
} as const;
