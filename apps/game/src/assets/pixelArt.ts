import {
  DRONE_COLORS,
  type ColorId,
  type DesignId,
  type EnemyKind,
  type ItemId,
  type WeaponId,
} from '@skyline/game-core';
import type { PixelArt } from '../rendering/SpriteRenderer';

// All ship sprites face +X (right); entities rotate them toward their heading.
// This module must stay free of pixi imports: the web app uses it for previews.

const OUTLINE = '#0b0f17';

/** b/l/d are recoloured per paint job; everything else is fixed hardware. */
const DRONE_ROWS: Record<DesignId, readonly string[]> = {
  quad: [
    '.ggg.....ggg.',
    'gr.rg...gr.rg',
    'g.k.g...g.k.g',
    'gr.rg...gr.rg',
    '.ggkk...kkgg.',
    '....kbbbk....',
    '....kblbwcc..',
    '....kbbbk....',
    '.ggkk...kkgg.',
    'gr.rg...gr.rg',
    'g.k.g...g.k.g',
    'gr.rg...gr.rg',
    '.ggg.....ggg.',
  ],
  wasp: [
    '.kk..........',
    'kllkk........',
    'klbbbkk......',
    '.kbbbbbk.....',
    '..kdbbbbkk...',
    '...kddbbbbkk.',
    '...kdddbbwwck',
    '...kddbbbbkk.',
    '..kdbbbbkk...',
    '.kbbbbbk.....',
    'klbbbkk......',
    'kllkk........',
    '.kk..........',
  ],
  manta: [
    'kkkkk........',
    'kdddbkk......',
    '.kddbbbkk....',
    '..kdbbbbbkk..',
    '...kbbbllbbk.',
    '....kbbllwwk.',
    '....kbbllwwck',
    '....kbbllwwk.',
    '...kbbbllbbk.',
    '..kdbbbbbkk..',
    '.kddbbbkk....',
    'kdddbkk......',
    'kkkkk........',
  ],
  orb: [
    '....kkkkk....',
    '..kkdddddkk..',
    '.kddbbbbbddk.',
    '.kdbbbllbbdk.',
    'kdbbllllbbbdk',
    'kdbblkkkkbbwk',
    'kdbblkcckbwwc',
    'kdbblkkkkbbwk',
    'kdbbllllbbbdk',
    '.kdbbbllbbdk.',
    '.kddbbbbbddk.',
    '..kkdddddkk..',
    '....kkkkk....',
  ],
};

export function droneArt(design: DesignId, color: ColorId): PixelArt {
  const paint = DRONE_COLORS[color];
  return {
    palette: {
      k: OUTLINE,
      g: '#4a5466',
      r: '#1f2633',
      w: '#e8f1ff',
      c: '#5fe3ff',
      b: paint.primary,
      l: paint.light,
      d: paint.dark,
    },
    rows: DRONE_ROWS[design],
  };
}

const WEAPON_PALETTE = {
  k: OUTLINE,
  m: '#6b6f80',
  o: '#ff8a3d',
  c: '#5fe3ff',
  r: '#ff4d6d',
  y: '#ffd23f',
};

export const WEAPON_ART: Record<WeaponId, PixelArt> = {
  pulse_pistol: {
    palette: WEAPON_PALETTE,
    rows: ['.kkkkkkk....', 'kmmmmmmmkc..', 'kmmkkkkkk...', 'kmk.........', 'kk..........'],
  },
  storm_smg: {
    palette: WEAPON_PALETTE,
    rows: ['..kkkkkkkk..', 'kkmmmmmmmmky', 'kmmkkmkkkk..', 'kmk.kmk.....', 'kk..kk......'],
  },
  scatter_gun: {
    palette: WEAPON_PALETTE,
    rows: ['kkkkkkkkkkk.', 'kmmmmmmmmmmk', 'kookkkkkkkk.', 'kok.........', 'kk..........'],
  },
  volt_rifle: {
    palette: WEAPON_PALETTE,
    rows: ['...kkkkkkk..', 'kkkmmmmmmmkc', 'kookkmkkkkk.', 'kok..mk.....', 'kk..........'],
  },
  rail_sniper: {
    palette: WEAPON_PALETTE,
    rows: ['....kk......', 'kkkkkkkkkkkk', 'kmmmmmmmmmcc', 'kookkkkkkkk.', 'kk..........'],
  },
  nova_launcher: {
    palette: WEAPON_PALETTE,
    rows: [
      'kkkkkkkkkk..',
      'kmmmmmmmmmkk',
      'kmrrrrrrmmyk',
      'kmmmmmmmmmkk',
      'kkkmkkkkkk..',
      '..kk........',
    ],
  },
};

export const ENEMY_ART: Record<EnemyKind, PixelArt> = {
  security: {
    palette: { k: '#1a0b0e', r: '#c8323c', d: '#7a1b24', y: '#ffd23f', w: '#ffffff' },
    rows: [
      '...kkkkk...',
      '.kkdrrrdkk.',
      '.kdrrrrrrk.',
      'kdrrrrrkkrk',
      'kdrrrrkyykk',
      'kdrrrrkywyk',
      'kdrrrrkyykk',
      'kdrrrrrkkrk',
      '.kdrrrrrrk.',
      '.kkdrrrdkk.',
      '...kkkkk...',
    ],
  },
  scout: {
    palette: { k: '#1c0f05', o: '#ff8a3d', d: '#a2501c', y: '#fff1a8' },
    rows: [
      'kk.......',
      'kook.....',
      'kdoook...',
      '.kdoooyk.',
      '.kddooyyk',
      '.kdoooyk.',
      'kdoook...',
      'kook.....',
      'kk.......',
    ],
  },
  guardian: {
    palette: { k: '#120a1f', m: '#6b6f80', d: '#4b2391', p: '#9b4dff', y: '#ff4d6d', w: '#ffd6de' },
    rows: [
      '..kkkkkkkkkkk..',
      '.kmmmmmmmmmmmk.',
      'kmmdddddddddmmk',
      'kmdpppppppppdmk',
      'kmdpppppppppdmk',
      'kmdppkkkkkppdmk',
      'kmdppkyyykkkkkk',
      'kmdppkywykmmmmk',
      'kmdppkyyykkkkkk',
      'kmdppkkkkkppdmk',
      'kmdpppppppppdmk',
      'kmdpppppppppdmk',
      'kmmdddddddddmmk',
      '.kmmmmmmmmmmmk.',
      '..kkkkkkkkkkk..',
    ],
  },
  hunter: {
    palette: { k: '#06070a', s: '#2b2f3a', h: '#d9dee8', r: '#ff2e4d' },
    rows: [
      'kk...........',
      'kskk.........',
      '.kssk........',
      '.kshhkk......',
      '..khhhhkk....',
      '..kshhhhhkk..',
      '...kshhrrrhhk',
      '..kshhhhhkk..',
      '..khhhhkk....',
      '.kshhkk......',
      '.kssk........',
      'kskk.........',
      'kk...........',
    ],
  },
};

export const ITEM_ART: Record<ItemId, PixelArt> = {
  energy_cell: {
    palette: { k: OUTLINE, w: '#e8f1ff', g: '#3fbf4f', y: '#c6ff7a' },
    rows: ['..kwk..', '.kkkkk.', '.kgygk.', '.kgygk.', '.kgygk.', '.kgggk.', '.kkkkk.'],
  },
  circuit_board: {
    palette: { k: OUTLINE, g: '#2fa35a', y: '#ffd23f' },
    rows: ['kkkkkkk', 'kgygggk', 'kgyyygk', 'kgggygk', 'kgyyygk', 'kgygggk', 'kkkkkkk'],
  },
  drone_part: {
    palette: { k: OUTLINE, m: '#9fb3c8' },
    rows: ['.k.k.k.', 'kmmmmmk', '.mkkkm.', 'kmk.kmk', '.mkkkm.', 'kmmmmmk', '.k.k.k.'],
  },
  shield_module: {
    palette: { k: OUTLINE, b: '#3d7bff', l: '#9cc4ff' },
    rows: ['..kkk..', '.kbbbk.', 'kbllbbk', 'kblbbbk', 'kbbbbbk', '.kbbbk.', '..kkk..'],
  },
  quantum_chip: {
    palette: { k: OUTLINE, p: '#8a4dff', c: '#5fe3ff', w: '#ffffff' },
    rows: ['.k.k.k.', 'kpppppk', '.pcccp.', 'kpcwcpk', '.pcccp.', 'kpppppk', '.k.k.k.'],
  },
  plasma_cannon: {
    palette: { k: OUTLINE, m: '#6b6f80', o: '#ff8a3d', y: '#fff1a8' },
    rows: ['.......', 'kkkkk..', 'kmmmmkk', 'kmoooyy', 'kmmmmkk', 'kkkkk..', '.......'],
  },
  ancient_cpu: {
    palette: { k: OUTLINE, y: '#ffb03d', r: '#ff2e4d' },
    rows: ['y.y.y.y', '.kkkkk.', 'ykyyyky', '.kyryk.', 'ykyyyky', '.kkkkk.', 'y.y.y.y'],
  },
};

export const PROJECTILE_ART = {
  player: {
    palette: { c: '#5fe3ff', w: '#ffffff' },
    rows: ['.cc..', 'ccwww', '.cc..'],
  },
  enemy: {
    palette: { r: '#ff4d6d', w: '#fff1f3' },
    rows: ['.r.', 'rwr', '.r.'],
  },
} satisfies Record<string, PixelArt>;
