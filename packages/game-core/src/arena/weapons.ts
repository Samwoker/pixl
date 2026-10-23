export type WeaponId =
  'pulse_pistol' | 'storm_smg' | 'scatter_gun' | 'volt_rifle' | 'rail_sniper' | 'nova_launcher';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  price: number;
  description: string;
  damage: number;
  pellets: number;
  spread: number;
  fireCooldownSec: number;
  magazine: number;
  reloadSec: number;
  projectileSpeed: number;
  projectileLifeSec: number;
  /** Area damage radius; direct hits always deal full damage. */
  splashRadius: number;
  color: string;
  projectileScale: number;
}

export const MAX_WEAPON_LEVEL = 3;

export const WEAPONS: Readonly<Record<WeaponId, WeaponDefinition>> = {
  pulse_pistol: {
    id: 'pulse_pistol',
    name: 'Pulse Pistol',
    tier: 1,
    price: 0,
    description: 'Standard issue. Reliable, accurate, forgettable.',
    damage: 18,
    pellets: 1,
    spread: 0.03,
    fireCooldownSec: 0.28,
    magazine: 12,
    reloadSec: 1.2,
    projectileSpeed: 700,
    projectileLifeSec: 0.8,
    splashRadius: 0,
    color: '#5fe3ff',
    projectileScale: 1,
  },
  storm_smg: {
    id: 'storm_smg',
    name: 'Storm SMG',
    tier: 2,
    price: 800,
    description: 'Hoses the room. Falls off fast past mid range.',
    damage: 9,
    pellets: 1,
    spread: 0.12,
    fireCooldownSec: 0.08,
    magazine: 32,
    reloadSec: 1.6,
    projectileSpeed: 760,
    projectileLifeSec: 0.5,
    splashRadius: 0,
    color: '#ffd23f',
    projectileScale: 0.8,
  },
  scatter_gun: {
    id: 'scatter_gun',
    name: 'Scatter Gun',
    tier: 2,
    price: 1200,
    description: 'Seven pellets. Deletes anything inside two tiles.',
    damage: 13,
    pellets: 7,
    spread: 0.42,
    fireCooldownSec: 0.75,
    magazine: 5,
    reloadSec: 1.9,
    projectileSpeed: 680,
    projectileLifeSec: 0.32,
    splashRadius: 0,
    color: '#ff8a3d',
    projectileScale: 0.8,
  },
  volt_rifle: {
    id: 'volt_rifle',
    name: 'Volt Rifle',
    tier: 3,
    price: 2200,
    description: 'Fast, accurate auto rifle. The all-rounder.',
    damage: 15,
    pellets: 1,
    spread: 0.04,
    fireCooldownSec: 0.12,
    magazine: 26,
    reloadSec: 1.8,
    projectileSpeed: 900,
    projectileLifeSec: 0.85,
    splashRadius: 0,
    color: '#7dff9b',
    projectileScale: 1,
  },
  rail_sniper: {
    id: 'rail_sniper',
    name: 'Rail Sniper',
    tier: 4,
    price: 3800,
    description: 'One clean hit takes a full-health drone down. Miss and you are reloading.',
    damage: 130,
    pellets: 1,
    spread: 0,
    fireCooldownSec: 1.1,
    magazine: 4,
    reloadSec: 2.4,
    projectileSpeed: 1800,
    projectileLifeSec: 0.75,
    splashRadius: 0,
    color: '#ffffff',
    projectileScale: 1.3,
  },
  nova_launcher: {
    id: 'nova_launcher',
    name: 'Nova Launcher',
    tier: 5,
    price: 5500,
    description: 'Slow rockets with a wide blast. Max level one-shots on a direct hit.',
    damage: 105,
    pellets: 1,
    spread: 0,
    fireCooldownSec: 1.3,
    magazine: 2,
    reloadSec: 2.8,
    projectileSpeed: 440,
    projectileLifeSec: 1.6,
    splashRadius: 90,
    color: '#ff4d6d',
    projectileScale: 2,
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

export function isWeaponId(value: unknown): value is WeaponId {
  return typeof value === 'string' && value in WEAPONS;
}

export interface WeaponStats {
  damage: number;
  magazine: number;
  reloadSec: number;
}

/** Each level: +12% damage, +15% magazine, -8% reload time. */
export function weaponStats(id: WeaponId, level: number): WeaponStats {
  const def = WEAPONS[id];
  const steps = Math.max(0, Math.min(MAX_WEAPON_LEVEL, level) - 1);
  return {
    damage: Math.round(def.damage * (1 + 0.12 * steps)),
    magazine: def.magazine + Math.floor(def.magazine * 0.15 * steps),
    reloadSec: Math.round(def.reloadSec * (1 - 0.08 * steps) * 100) / 100,
  };
}

/** Cost to go from `level` to `level + 1`. */
export function weaponUpgradeCost(id: WeaponId, level: number): number | null {
  if (level >= MAX_WEAPON_LEVEL) return null;
  const base = Math.max(WEAPONS[id].price, 400);
  return Math.round(base * 0.6 * level);
}
