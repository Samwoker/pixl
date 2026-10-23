export type DesignId = 'quad' | 'wasp' | 'manta' | 'orb';
export type ColorId =
  'signal' | 'ember' | 'toxic' | 'violet' | 'crimson' | 'ghost' | 'void' | 'gold';

export interface DesignDefinition {
  id: DesignId;
  name: string;
  price: number;
  description: string;
}

export interface ColorDefinition {
  id: ColorId;
  name: string;
  price: number;
  primary: string;
  light: string;
  dark: string;
}

export const DRONE_DESIGNS: Readonly<Record<DesignId, DesignDefinition>> = {
  quad: { id: 'quad', name: 'Quad', price: 0, description: 'Four rotors, no surprises.' },
  wasp: { id: 'wasp', name: 'Wasp', price: 600, description: 'Swept stinger frame.' },
  manta: { id: 'manta', name: 'Manta', price: 1500, description: 'Flat delta wing.' },
  orb: { id: 'orb', name: 'Orb', price: 2500, description: 'Armoured sphere with a single eye.' },
};

export const DRONE_COLORS: Readonly<Record<ColorId, ColorDefinition>> = {
  signal: {
    id: 'signal',
    name: 'Signal',
    price: 0,
    primary: '#3d7bff',
    light: '#9cc4ff',
    dark: '#1d3f8f',
  },
  ember: {
    id: 'ember',
    name: 'Ember',
    price: 0,
    primary: '#ff7a2e',
    light: '#ffc08f',
    dark: '#8f3a10',
  },
  toxic: {
    id: 'toxic',
    name: 'Toxic',
    price: 400,
    primary: '#5fdc3a',
    light: '#c6ff9a',
    dark: '#2a6b16',
  },
  violet: {
    id: 'violet',
    name: 'Violet',
    price: 400,
    primary: '#9b4dff',
    light: '#d2b0ff',
    dark: '#4b2391',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    price: 600,
    primary: '#e0303f',
    light: '#ff9aa4',
    dark: '#6e1019',
  },
  ghost: {
    id: 'ghost',
    name: 'Ghost',
    price: 900,
    primary: '#d9dee8',
    light: '#ffffff',
    dark: '#6b7384',
  },
  void: {
    id: 'void',
    name: 'Void',
    price: 1200,
    primary: '#2b2f3a',
    light: '#5b6577',
    dark: '#0b0d12',
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    price: 1500,
    primary: '#ffb800',
    light: '#ffe9a0',
    dark: '#8a5a00',
  },
};

export interface DroneCosmetics {
  design: DesignId;
  color: ColorId;
}

export const DEFAULT_COSMETICS: DroneCosmetics = { design: 'quad', color: 'signal' };

export function isDesignId(value: unknown): value is DesignId {
  return typeof value === 'string' && value in DRONE_DESIGNS;
}

export function isColorId(value: unknown): value is ColorId {
  return typeof value === 'string' && value in DRONE_COLORS;
}
