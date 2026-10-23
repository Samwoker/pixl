import {
  deriveSeed,
  DRONE_TUNING,
  ENERGY_CELL_RESTORE,
  itemValue,
  Rng,
  salvageWeights,
  type ItemId,
} from '@skyline/game-core';
import { Loot } from '../entities/Loot';
import type { MissionWorld } from '../world/MissionWorld';

const MAGNET_RADIUS = 70;
const MAGNET_SPEED = 260;
const CARGO_FULL_NOTICE_SEC = 1.5;

export class LootSystem {
  private readonly dropRng: Rng;
  private readonly weights: [ItemId, number][];
  private dropCount = 0;
  private cargoNoticeCooldown = 0;

  constructor(private readonly world: MissionWorld) {
    this.dropRng = new Rng(deriveSeed(world.spec.seed, 'drops'));
    this.weights = salvageWeights(world.spec.zone);
    world.events.on('enemyKilled', ({ enemy }) => {
      if (this.dropRng.chance(enemy.def.dropChance)) {
        this.spawn(
          `drop_${this.dropCount++}`,
          this.dropRng.weighted(this.weights),
          enemy.x,
          enemy.y,
          true,
        );
      }
    });
  }

  spawnFromMap(): void {
    for (const spawn of this.world.map.loot) {
      // Energy cells are always visible; salvage has to be found with the scanner.
      this.spawn(spawn.id, spawn.itemId, spawn.x, spawn.y, spawn.itemId === 'energy_cell');
    }
  }

  update(dt: number): void {
    const { player, keyboard, loot, events } = this.world;
    player.scanCooldown = Math.max(0, player.scanCooldown - dt);
    this.cargoNoticeCooldown = Math.max(0, this.cargoNoticeCooldown - dt);
    if (!player.alive) return;

    if (
      keyboard.wasPressed('Space') &&
      player.scanCooldown <= 0 &&
      player.energy >= DRONE_TUNING.scanEnergyCost
    ) {
      player.scanCooldown = DRONE_TUNING.scanCooldownSec;
      player.energy -= DRONE_TUNING.scanEnergyCost;
      const radius = player.stats.scanRange;
      let revealed = 0;
      for (const item of loot) {
        if (item.revealed || item.collected) continue;
        if (Math.hypot(item.x - player.x, item.y - player.y) <= radius) {
          item.reveal();
          revealed++;
        }
      }
      events.emit('scan', { x: player.x, y: player.y, radius, revealed });
    }

    for (const item of loot) {
      if (item.collected || !item.revealed) continue;
      item.revealFlash = Math.max(0, item.revealFlash - dt);
      const dx = player.x - item.x;
      const dy = player.y - item.y;
      const dist = Math.hypot(dx, dy);
      const blocked = item.usesCargo && player.cargoFull;

      if (!blocked && dist < MAGNET_RADIUS && dist > 1) {
        const pull = Math.min(dist, MAGNET_SPEED * dt);
        item.x += (dx / dist) * pull;
        item.y += (dy / dist) * pull;
      }
      if (dist > DRONE_TUNING.pickupRadius) continue;
      if (blocked) {
        if (this.cargoNoticeCooldown <= 0) {
          this.cargoNoticeCooldown = CARGO_FULL_NOTICE_SEC;
          events.emit('cargoFull', { x: player.x, y: player.y });
        }
        continue;
      }
      this.collect(item);
    }
  }

  private collect(item: Loot): void {
    const { player, stats, events, spec } = this.world;
    item.collected = true;
    item.view.visible = false;
    stats.items[item.itemId] = (stats.items[item.itemId] ?? 0) + 1;
    player.cargo.set(item.itemId, (player.cargo.get(item.itemId) ?? 0) + 1);
    if (item.usesCargo) player.cargoUsed++;
    if (item.itemId === 'energy_cell') {
      player.energy = Math.min(player.stats.energy, player.energy + ENERGY_CELL_RESTORE);
    }
    events.emit('itemCollected', {
      itemId: item.itemId,
      x: item.x,
      y: item.y,
      value: itemValue(item.itemId, spec.zone),
    });
  }

  private spawn(id: string, itemId: ItemId, x: number, y: number, revealed: boolean): void {
    const item = new Loot(id, itemId, this.world.assets.get(`item:${itemId}`), x, y, revealed);
    this.world.loot.push(item);
    this.world.layers.loot.addChild(item.view);
  }
}
