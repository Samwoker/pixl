import { DRONE_COLORS, DRONE_DESIGNS, type ColorId, type DesignId } from './cosmetics';
import { WEAPONS, type WeaponId } from './weapons';

export type MarketItemId = `weapon:${WeaponId}` | `design:${DesignId}` | `color:${ColorId}`;
export type MarketItemKind = 'weapon' | 'design' | 'color';

export interface MarketItem {
  id: MarketItemId;
  kind: MarketItemKind;
  key: string;
  name: string;
  price: number;
}

export const MARKET_ITEMS: readonly MarketItem[] = [
  ...Object.values(WEAPONS).map((w) => ({
    id: `weapon:${w.id}` as const,
    kind: 'weapon' as const,
    key: w.id,
    name: w.name,
    price: w.price,
  })),
  ...Object.values(DRONE_DESIGNS).map((d) => ({
    id: `design:${d.id}` as const,
    kind: 'design' as const,
    key: d.id,
    name: d.name,
    price: d.price,
  })),
  ...Object.values(DRONE_COLORS).map((c) => ({
    id: `color:${c.id}` as const,
    kind: 'color' as const,
    key: c.id,
    name: c.name,
    price: c.price,
  })),
];

const BY_ID = new Map<string, MarketItem>(MARKET_ITEMS.map((item) => [item.id, item]));

export function findMarketItem(id: string): MarketItem | undefined {
  return BY_ID.get(id);
}

/** Free items are owned by everyone without a database row. */
export const STARTER_ITEMS: readonly MarketItemId[] = MARKET_ITEMS.filter((i) => i.price === 0).map(
  (i) => i.id,
);
