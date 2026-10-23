import { z } from 'zod';
import {
  ARENA_IDS,
  DRONE_COLORS,
  DRONE_DESIGNS,
  ITEMS,
  WEAPON_IDS,
  type ArenaId,
  type ClientMessage,
  type ColorId,
  type DesignId,
  type ItemId,
  type WeaponId,
} from '@skyline/game-core';

export const CallsignSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{3,16}$/, '3–16 letters, numbers, - or _');

const weaponEnum = z.enum(WEAPON_IDS as [WeaponId, ...WeaponId[]]);

export const RegisterBody = z.object({ callsign: CallsignSchema });
export const PurchaseBody = z.object({ itemId: z.string().max(64) });
export const UpgradeBody = z.object({ weaponId: weaponEnum });
export const LoadoutBody = z.object({
  primary: weaponEnum,
  secondary: weaponEnum,
  design: z.enum(Object.keys(DRONE_DESIGNS) as [DesignId, ...DesignId[]]),
  color: z.enum(Object.keys(DRONE_COLORS) as [ColorId, ...ColorId[]]),
});

export const SalvageMissionBody = z.object({ zone: z.number().int().min(1).max(5) });

const count = z.number().int().min(0).max(100_000);
export const SalvageResultBody = z.object({
  result: z.object({
    missionId: z.string().max(64),
    seed: z
      .number()
      .int()
      .min(0)
      .max(2 ** 32),
    zone: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    durationSec: z.number().min(0).max(36_000),
    extracted: z.boolean(),
    enemiesKilled: count,
    damageTaken: z.number().min(0).max(1_000_000),
    shotsFired: count,
    items: z.partialRecord(z.enum(Object.keys(ITEMS) as [ItemId, ...ItemId[]]), count),
  }),
});

const unit = z.number().min(-1).max(1);
const arenaEnum = z.enum(ARENA_IDS as [ArenaId, ...ArenaId[]]);
const modeEnum = z.enum(['ffa', 'tdm']);

export const ClientMessageSchema = z.union([
  z.object({ t: z.literal('hello'), token: z.string().min(20).max(200) }),
  z.object({
    t: z.literal('join'),
    kind: z.literal('quick'),
    mode: modeEnum,
    arena: z.union([z.literal('any'), arenaEnum]),
  }),
  z.object({
    t: z.literal('join'),
    kind: z.literal('create'),
    mode: modeEnum,
    arena: arenaEnum,
    bots: z.number().int().min(0).max(7),
    difficulty: z.enum(['easy', 'normal', 'hard']),
  }),
  z.object({
    t: z.literal('join'),
    kind: z.literal('code'),
    code: z.string().regex(/^[A-Z2-9]{5}$/),
  }),
  z.object({
    t: z.literal('input'),
    seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    mx: unit,
    my: unit,
    aim: z.number().min(-10).max(10),
    fire: z.boolean(),
    dash: z.boolean(),
    swap: z.boolean(),
    reload: z.boolean(),
  }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('ping'), c: z.number() }),
]) satisfies z.ZodType<ClientMessage>;
