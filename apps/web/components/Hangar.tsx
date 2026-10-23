'use client';

import { useMemo, useState } from 'react';
import { droneArt, WEAPON_ART } from '@skyline/game/art';
import {
  DRONE_COLORS,
  DRONE_DESIGNS,
  MAX_WEAPON_LEVEL,
  ONE_SHOT_DAMAGE,
  WEAPON_IDS,
  WEAPONS,
  weaponStats,
  weaponUpgradeCost,
  type ColorId,
  type DesignId,
  type EquippedLoadout,
  type MarketItemId,
  type PlayerProfile,
  type WeaponId,
} from '@skyline/game-core';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { PixelArtCanvas } from './PixelArtCanvas';

type Tab = 'weapons' | 'frames' | 'paint';

const fmt = (n: number) => n.toLocaleString('en-US');

export function Hangar() {
  const { token, profile, setProfile } = useSession();
  const [tab, setTab] = useState<Tab>('weapons');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (!profile || !token) return null;
  const { loadout, owned, credits } = profile;

  async function act(key: string, run: () => Promise<PlayerProfile>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      setProfile(await run());
      setMessage({ tone: 'ok', text: success });
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setBusy(null);
    }
  }

  const equip = (patch: Partial<EquippedLoadout>, label: string) => {
    const next = { ...loadout, ...patch };
    // Equipping the other slot's weapon swaps the two.
    if (patch.primary && patch.primary === loadout.secondary) next.secondary = loadout.primary;
    if (patch.secondary && patch.secondary === loadout.primary) next.primary = loadout.secondary;
    return act(`equip:${label}`, () => api.setLoadout(token, next), `${label} equipped.`);
  };
  const buy = (id: MarketItemId, name: string) =>
    act(`buy:${id}`, () => api.purchase(token, id), `${name} purchased.`);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[18rem_1fr]">
      <aside className="flex flex-col gap-6 self-start border border-ink-700 bg-ink-900/80 p-6 lg:sticky lg:top-6">
        <div className="grid place-items-center bg-ink-950 py-8 blueprint">
          <PixelArtCanvas
            art={droneArt(loadout.design, loadout.color)}
            scale={10}
            label="Your drone"
          />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-400">Frame</dt>
          <dd className="text-right text-ink-100">{DRONE_DESIGNS[loadout.design].name}</dd>
          <dt className="text-ink-400">Paint</dt>
          <dd className="text-right text-ink-100">{DRONE_COLORS[loadout.color].name}</dd>
          <dt className="text-ink-400">Primary</dt>
          <dd className="text-right text-ink-100">{WEAPONS[loadout.primary].name}</dd>
          <dt className="text-ink-400">Secondary</dt>
          <dd className="text-right text-ink-100">{WEAPONS[loadout.secondary].name}</dd>
        </dl>
        <div className="border-t border-ink-700 pt-4">
          <p className="text-[10px] tracking-[0.3em] text-ink-400">CREDITS</p>
          <p className="font-display text-3xl font-bold tabular-nums text-salvage">
            {fmt(credits)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-400">
            Earned from arena kills and wins, and from extracted salvage. Every purchase is checked
            by the server.
          </p>
        </div>
      </aside>

      <section aria-label="Market">
        <div
          role="tablist"
          aria-label="Market sections"
          className="flex gap-1 border-b border-ink-700"
        >
          {(['weapons', 'frames', 'paint'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 font-display text-sm font-semibold tracking-[0.2em] uppercase ${
                tab === t ? 'border-b-2 border-scan text-scan' : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <p
          role="status"
          aria-live="polite"
          className={`min-h-6 py-3 text-sm ${message?.tone === 'error' ? 'text-hazard' : 'text-extract'}`}
        >
          {message?.text}
        </p>

        {tab === 'weapons' && (
          <ul className="grid gap-px border border-ink-700 bg-ink-700">
            {WEAPON_IDS.map((id) => (
              <WeaponRow
                key={id}
                id={id}
                level={owned[`weapon:${id}`]}
                credits={credits}
                loadout={loadout}
                busy={busy}
                onBuy={() => buy(`weapon:${id}`, WEAPONS[id].name)}
                onUpgrade={() =>
                  act(
                    `upgrade:${id}`,
                    () => api.upgrade(token, id),
                    `${WEAPONS[id].name} upgraded.`,
                  )
                }
                onEquip={(slot) => equip({ [slot]: id }, WEAPONS[id].name)}
              />
            ))}
          </ul>
        )}

        {tab === 'frames' && (
          <ul className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(DRONE_DESIGNS) as DesignId[]).map((id) => (
              <CosmeticCard
                key={id}
                name={DRONE_DESIGNS[id].name}
                description={DRONE_DESIGNS[id].description}
                price={DRONE_DESIGNS[id].price}
                owned={owned[`design:${id}`] !== undefined}
                equipped={loadout.design === id}
                credits={credits}
                busy={busy !== null}
                preview={
                  <PixelArtCanvas
                    art={droneArt(id, loadout.color)}
                    scale={6}
                    label={DRONE_DESIGNS[id].name}
                  />
                }
                onBuy={() => buy(`design:${id}`, DRONE_DESIGNS[id].name)}
                onEquip={() => equip({ design: id }, DRONE_DESIGNS[id].name)}
              />
            ))}
          </ul>
        )}

        {tab === 'paint' && (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(DRONE_COLORS) as ColorId[]).map((id) => (
              <CosmeticCard
                key={id}
                name={DRONE_COLORS[id].name}
                price={DRONE_COLORS[id].price}
                owned={owned[`color:${id}`] !== undefined}
                equipped={loadout.color === id}
                credits={credits}
                busy={busy !== null}
                preview={
                  <PixelArtCanvas
                    art={droneArt(loadout.design, id)}
                    scale={5}
                    label={DRONE_COLORS[id].name}
                  />
                }
                onBuy={() => buy(`color:${id}`, `${DRONE_COLORS[id].name} paint`)}
                onEquip={() => equip({ color: id }, `${DRONE_COLORS[id].name} paint`)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface WeaponRowProps {
  id: WeaponId;
  level: number | undefined;
  credits: number;
  loadout: EquippedLoadout;
  busy: string | null;
  onBuy: () => void;
  onUpgrade: () => void;
  onEquip: (slot: 'primary' | 'secondary') => void;
}

function WeaponRow({
  id,
  level,
  credits,
  loadout,
  busy,
  onBuy,
  onUpgrade,
  onEquip,
}: WeaponRowProps) {
  const def = WEAPONS[id];
  const isOwned = level !== undefined;
  const stats = weaponStats(id, level ?? 1);
  const upgradeCost = isOwned ? weaponUpgradeCost(id, level) : null;
  const next = isOwned && level < MAX_WEAPON_LEVEL ? weaponStats(id, level + 1) : null;
  const perShot = stats.damage;
  const oneShot = perShot >= ONE_SHOT_DAMAGE;
  const oneShotLevel = oneShot
    ? null
    : Array.from({ length: MAX_WEAPON_LEVEL }, (_, i) => i + 1).find(
        (l) => weaponStats(id, l).damage >= ONE_SHOT_DAMAGE,
      );
  const rpm = Math.round(60 / def.fireCooldownSec);
  const range = Math.round((def.projectileSpeed * def.projectileLifeSec) / 48);
  const slot = loadout.primary === id ? 'PRIMARY' : loadout.secondary === id ? 'SECONDARY' : null;
  const disabled = busy !== null;
  const art = useMemo(() => WEAPON_ART[id], [id]);

  return (
    <li className="grid gap-5 bg-ink-950 p-5 md:grid-cols-[7rem_1fr_auto] md:items-center">
      <div className="grid h-16 place-items-center bg-ink-900">
        <PixelArtCanvas art={art} scale={6} label={def.name} />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-semibold text-ink-100">{def.name}</h3>
          <span className="border border-ink-600 px-1.5 text-[10px] tracking-[0.2em] text-ink-300">
            TIER {def.tier}
          </span>
          {oneShot && (
            <span className="bg-hazard px-1.5 text-[10px] font-bold tracking-[0.2em] text-ink-950">
              ONE-SHOT
            </span>
          )}
          {oneShotLevel && (
            <span className="border border-hazard px-1.5 text-[10px] tracking-[0.2em] text-hazard">
              ONE-SHOT AT LV {oneShotLevel}
            </span>
          )}
          {slot && <span className="text-[10px] tracking-[0.2em] text-scan">{slot}</span>}
        </div>
        <p className="mt-1 text-sm text-ink-400">{def.description}</p>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <Stat
            label="DMG"
            value={def.pellets > 1 ? `${perShot}×${def.pellets}` : `${perShot}`}
            next={next && next.damage !== stats.damage ? `${next.damage}` : null}
          />
          <Stat label="RPM" value={`${rpm}`} />
          <Stat
            label="MAG"
            value={`${stats.magazine}`}
            next={next && next.magazine !== stats.magazine ? `${next.magazine}` : null}
          />
          <Stat
            label="RELOAD"
            value={`${stats.reloadSec}s`}
            next={next ? `${next.reloadSec}s` : null}
          />
          <Stat label="RANGE" value={`${range} tiles`} />
          {def.splashRadius > 0 && (
            <Stat label="BLAST" value={`${Math.round((def.splashRadius / 48) * 10) / 10} tiles`} />
          )}
        </dl>
        {isOwned && (
          <div
            className="mt-3 flex items-center gap-1"
            aria-label={`Level ${level} of ${MAX_WEAPON_LEVEL}`}
          >
            {Array.from({ length: MAX_WEAPON_LEVEL }, (_, i) => (
              <span key={i} className={`h-1.5 w-6 ${i < level ? 'bg-scan' : 'bg-ink-700'}`} />
            ))}
            <span className="ml-2 text-[10px] tracking-[0.2em] text-ink-400">LV {level}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
        {!isOwned ? (
          <button
            type="button"
            disabled={disabled || credits < def.price}
            onClick={onBuy}
            className={primaryButton}
          >
            BUY · {fmt(def.price)}
          </button>
        ) : (
          <>
            {upgradeCost !== null && (
              <button
                type="button"
                disabled={disabled || credits < upgradeCost}
                onClick={onUpgrade}
                className={primaryButton}
              >
                UPGRADE · {fmt(upgradeCost)}
              </button>
            )}
            <button
              type="button"
              disabled={disabled || loadout.primary === id}
              onClick={() => onEquip('primary')}
              className={secondaryButton}
            >
              EQUIP PRIMARY
            </button>
            <button
              type="button"
              disabled={disabled || loadout.secondary === id}
              onClick={() => onEquip('secondary')}
              className={secondaryButton}
            >
              EQUIP SECONDARY
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function Stat({ label, value, next }: { label: string; value: string; next?: string | null }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-ink-400">{label}</dt>
      <dd className="tabular-nums text-ink-100">
        {value}
        {next && next !== value && <span className="text-extract"> → {next}</span>}
      </dd>
    </div>
  );
}

interface CosmeticCardProps {
  name: string;
  description?: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  credits: number;
  busy: boolean;
  preview: React.ReactNode;
  onBuy: () => void;
  onEquip: () => void;
}

function CosmeticCard({
  name,
  description,
  price,
  owned,
  equipped,
  credits,
  busy,
  preview,
  onBuy,
  onEquip,
}: CosmeticCardProps) {
  return (
    <li
      className={`flex flex-col border bg-ink-950 ${equipped ? 'border-scan' : 'border-ink-700'}`}
    >
      <div className="grid h-32 place-items-center bg-ink-900 blueprint">{preview}</div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display font-semibold text-ink-100">{name}</h3>
          {description && <p className="mt-1 text-xs text-ink-400">{description}</p>}
        </div>
        <div className="mt-auto">
          {equipped ? (
            <p className="py-2 text-center text-[10px] tracking-[0.25em] text-scan">EQUIPPED</p>
          ) : owned ? (
            <button
              type="button"
              disabled={busy}
              onClick={onEquip}
              className={`w-full ${secondaryButton}`}
            >
              EQUIP
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || credits < price}
              onClick={onBuy}
              className={`w-full ${primaryButton}`}
            >
              BUY · {fmt(price)}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

const primaryButton =
  'bg-signal px-4 py-2 font-display text-xs font-semibold tracking-[0.2em] text-ink-950 hover:bg-signal-soft disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-400';
const secondaryButton =
  'border border-ink-600 px-4 py-2 font-display text-xs font-semibold tracking-[0.2em] text-ink-100 hover:border-ink-400 disabled:cursor-not-allowed disabled:opacity-40';
