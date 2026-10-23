import { Container } from 'pixi.js';
import {
  DRONE_TUNING,
  generateMap,
  itemValue,
  ZONES,
  type DroneCosmetics,
  type DroneStats,
  type MissionSpec,
} from '@skyline/game-core';
import type { AudioManager } from '../audio/AudioManager';
import type { AssetManager } from '../engine/AssetManager';
import { EventBus } from '../engine/EventBus';
import type { Scene } from '../engine/SceneManager';
import { ExtractionZone } from '../entities/ExtractionZone';
import { PlayerDrone } from '../entities/PlayerDrone';
import type { Keyboard } from '../input/Keyboard';
import type { Mouse } from '../input/Mouse';
import { Camera } from '../rendering/Camera';
import { Effects } from '../rendering/Effects';
import { CombatSystem } from '../systems/CombatSystem';
import { EnemyAISystem } from '../systems/EnemyAISystem';
import { LootSystem } from '../systems/LootSystem';
import { MissionSystem } from '../systems/MissionSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { SpawnSystem } from '../systems/SpawnSystem';
import type { HudSnapshot, MissionEnd } from '../types';
import { renderCity } from '../world/CityRenderer';
import type { MissionEvents, MissionLayers, MissionWorld } from '../world/MissionWorld';

export interface MissionSceneDeps {
  spec: MissionSpec;
  stats: DroneStats;
  cosmetics: DroneCosmetics;
  assets: AssetManager;
  keyboard: Keyboard;
  mouse: Mouse;
  audio: AudioManager;
  onEnd: (end: MissionEnd) => void;
}

export type MissionHud = Omit<HudSnapshot, 'paused' | 'muted'>;

const ALERT_SEC = 3;

export class MissionScene implements Scene {
  readonly container = new Container();
  private readonly worldContainer = new Container();
  private readonly world: MissionWorld;
  private readonly movement: MovementSystem;
  private readonly combat: CombatSystem;
  private readonly ai: EnemyAISystem;
  private readonly lootSystem: LootSystem;
  private readonly spawner: SpawnSystem;
  private readonly mission: MissionSystem;
  private readonly effects: Effects;
  private alert: { text: string; until: number } | null = null;
  private renderTime = 0;

  constructor(private readonly deps: MissionSceneDeps) {
    const { spec, stats, assets, keyboard, mouse } = deps;
    const map = generateMap(spec);
    const events = new EventBus<MissionEvents>();
    const { worldContainer } = this;
    const layers: MissionLayers = {
      ground: new Container(),
      extraction: new Container(),
      loot: new Container(),
      enemies: new Container(),
      player: new Container(),
      projectiles: new Container(),
      effects: new Container(),
    };
    worldContainer.addChild(...Object.values(layers));
    this.container.addChild(worldContainer);
    layers.ground.addChild(renderCity(map));

    const camera = new Camera(map.width * map.tileSize, map.height * map.tileSize);
    const player = new PlayerDrone(assets.drone(deps.cosmetics), stats, map.playerSpawn);
    const extraction = new ExtractionZone(map.extraction);
    layers.extraction.addChild(extraction.view);
    layers.player.addChild(player.sprite, extraction.indicator);

    this.world = {
      spec,
      map,
      zone: ZONES[spec.zone],
      assets,
      events,
      keyboard,
      mouse,
      camera,
      layers,
      player,
      enemies: [],
      loot: [],
      extraction,
      stats: { elapsedSec: 0, kills: 0, damageTaken: 0, shotsFired: 0, items: {} },
      aimWorld: { ...map.playerSpawn },
      time: 0,
      ended: false,
    };

    this.movement = new MovementSystem(this.world);
    this.combat = new CombatSystem(this.world);
    this.ai = new EnemyAISystem(this.world, this.combat);
    this.lootSystem = new LootSystem(this.world);
    this.spawner = new SpawnSystem(this.world);
    this.mission = new MissionSystem(this.world, deps.onEnd);
    this.effects = new Effects(layers.effects, camera, events);

    this.spawner.spawnFromMap();
    this.lootSystem.spawnFromMap();
    this.wireFeedback();
    camera.snapTo(player);
  }

  update(dt: number): void {
    const { world } = this;
    world.time += dt;
    world.aimWorld = world.camera.screenToWorld(world.mouse.screenX, world.mouse.screenY);

    if (!world.ended) {
      this.movement.update(dt);
      this.ai.update(dt);
      this.combat.update(dt);
      this.lootSystem.update(dt);
      this.spawner.update(dt);
      this.pruneDead();
    }
    this.mission.update(dt);
    world.keyboard.endStep();
  }

  render(frameDt: number): void {
    const { world } = this;
    this.renderTime += frameDt;
    const t = this.renderTime;
    const { camera, player } = world;

    camera.follow(player, world.aimWorld, frameDt);
    player.syncView(t);
    for (const enemy of world.enemies) {
      enemy.view.visible = camera.isVisible(enemy, 64);
      if (enemy.view.visible) enemy.syncView(t);
    }
    for (const item of world.loot) item.syncView(t);
    world.extraction.syncView(
      t,
      player,
      player.alive && !player.hidden,
      camera.isVisible(world.extraction.position, -world.extraction.radius),
    );
    this.effects.update(frameDt);
    camera.apply(this.worldContainer);
  }

  hud(): MissionHud {
    const { player, zone, stats, extraction, spec } = this.world;
    const lootValue = [...player.cargo.entries()].reduce(
      (sum, [id, count]) => sum + itemValue(id, spec.zone) * count,
      0,
    );
    const alertActive = this.alert && this.alert.until > this.world.time ? this.alert.text : null;
    return {
      hp: Math.ceil(player.hp),
      maxHp: player.stats.hp,
      shield: Math.ceil(player.shield),
      maxShield: player.stats.shield,
      energy: Math.floor(player.energy),
      maxEnergy: player.stats.energy,
      cargoUsed: player.cargoUsed,
      cargoCapacity: player.stats.cargoCapacity,
      zone: spec.zone,
      zoneName: zone.name,
      elapsedSec: stats.elapsedSec,
      lootValue,
      kills: stats.kills,
      extractionDistance: Math.round(
        Math.hypot(extraction.position.x - player.x, extraction.position.y - player.y),
      ),
      extractionProgress: extraction.progress,
      extractionSecondsLeft: this.mission.extractionSecondsLeft,
      inExtractionZone: this.mission.inExtractionZone && player.alive,
      dashReady: 1 - player.dashCooldown / DRONE_TUNING.dashCooldownSec,
      scanReady: 1 - player.scanCooldown / DRONE_TUNING.scanCooldownSec,
      nextWaveSec: Math.ceil(this.spawner.secondsToNextWave),
      alert: alertActive,
    };
  }

  resize(width: number, height: number): void {
    this.world.camera.resize(width, height);
  }

  destroy(): void {
    this.effects.destroy();
    this.combat.destroy();
    this.world.events.clear();
    this.container.destroy({ children: true });
  }

  private pruneDead(): void {
    const { world } = this;
    for (let i = world.enemies.length - 1; i >= 0; i--) {
      const enemy = world.enemies[i];
      if (enemy && !enemy.alive) {
        enemy.view.destroy({ children: true });
        world.enemies.splice(i, 1);
      }
    }
    for (let i = world.loot.length - 1; i >= 0; i--) {
      const item = world.loot[i];
      if (item?.collected) {
        item.view.destroy({ children: true });
        world.loot.splice(i, 1);
      }
    }
  }

  private wireFeedback(): void {
    const { events } = this.world;
    const { audio } = this.deps;
    const showAlert = (text: string) => {
      this.alert = { text, until: this.world.time + ALERT_SEC };
    };
    events.on('shot', ({ owner }) => audio.play(owner === 'player' ? 'shoot' : 'enemyShoot'));
    events.on('enemyHit', () => audio.play('hit'));
    events.on('enemyKilled', () => audio.play('explode'));
    events.on('playerHit', () => audio.play('hurt'));
    events.on('playerDestroyed', () => audio.play('explode'));
    events.on('dash', () => audio.play('dash'));
    events.on('scan', () => audio.play('scan'));
    events.on('itemCollected', () => audio.play('pickup'));
    events.on('extracted', () => audio.play('extract'));
    events.on('cargoFull', () => showAlert('CARGO FULL — HEAD FOR EXTRACTION'));
    events.on('reinforcements', ({ count }) => {
      audio.play('alarm');
      showAlert(`REINFORCEMENTS INBOUND ×${count}`);
    });
  }
}
