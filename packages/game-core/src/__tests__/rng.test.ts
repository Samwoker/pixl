import { describe, expect, it } from 'vitest';
import { deriveSeed, Rng } from '../rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('stays within [0, 1) and int() is inclusive', () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seen.add(rng.int(1, 3));
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('derives independent, stable seeds', () => {
    expect(deriveSeed(10, 'layout')).toBe(deriveSeed(10, 'layout'));
    expect(deriveSeed(10, 'layout')).not.toBe(deriveSeed(10, 'loot'));
  });
});
