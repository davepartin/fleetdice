"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TUNING, FLAG_FACES, WEAPON_GRID_IDS, WEAPON_IDS, WEAPON_NAMES, weaponAttack, weaponChargeCostOf,
  weaponEffect, weaponFilledThisRound, weaponStatus, weaponStored, weaponsOf, roundWeapon,
  canFillWeapon, isEnergyWeapon,
  type EnergyWeaponId, type MatchAction, type PlayerState, type WeaponId, type WeaponInventory, type WeaponUse,
} from "@/lib/engine";
import { EnergyBank, EnergyPrice } from "./ui";
import { StatIcon } from "./StatIcon";

const TONE: Record<WeaponId, string> = {
  rotate: "energy",
  shield: "shield",
  attack: "attack",
  repair: "repair",
  energyAttack: "attack",
  energyShield: "shield",
};
const STATE = { locked: "Locked", available: "Available", used: "Used" };
/** Short names for the compact dock tap. Full names stay in the window. */
const DOCK_NAME: Record<WeaponId, string> = {
  rotate: "Rotate",
  shield: "Shield",
  attack: "Attack",
  repair: "Repair",
  energyAttack: "E-Atk",
  energyShield: "E-Shd",
};

export function weaponUseText(use: WeaponUse): string {
  if (use.id === "rotate") return `Rotate Flagship · ${use.from ?? "?"} → ${use.to ?? "?"}`;
  if (use.id === "shield") return `Super Shield · ${use.amount} Attack stopped`;
  if (use.id === "energyAttack") return `Energy Attack · +${use.amount} Attack`;
  if (use.id === "energyShield") return `Energy Shield · +${use.amount} Shields`;
  return `${WEAPON_NAMES[use.id]} · +${use.amount}`;
}

/** Same four marks at the same size — unicode ↻ filled the box; ✦ did not. */
function WeaponIcon({ id, size = 22 }: { id: WeaponId; size?: number }) {
  if (id === "rotate") {
    return (
      <svg
        className="weapon-symbol"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M17.65 6.35C16.2 4.9 14.21 4 12 4 7.58 4 4.01 7.58 4.01 12S7.58 20 12 20c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"
        />
      </svg>
    );
  }
  const kind = id === "shield" || id === "energyShield" ? "shield"
    : id === "attack" || id === "energyAttack" ? "attack"
    : "repair";
  const mark = <StatIcon kind={kind} size={size} className="weapon-symbol" />;
  if (!isEnergyWeapon(id)) return mark;
  return (
    <span className="weapon-energy-mark" aria-hidden="true">
      {mark}
      <StatIcon kind="energy" size={Math.max(10, Math.round(size * 0.55))} className="weapon-energy-bolt" />
    </span>
  );
}

function LockMark() {
  return (
    <svg className="weapon-enemy-lock" viewBox="0 0 24 28" aria-hidden="true">
      <path
        d="M7 12.2V8.4C7 4.8 9.4 2.6 12 2.6s5 2.2 5 5.8v3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <rect x="3.6" y="11.4" width="16.8" height="14.4" rx="3.4" fill="currentColor" />
      <circle cx="12" cy="17.8" r="1.7" fill="var(--color-lock-hole)" />
      <path
        d="M12 18.8v2.8"
        stroke="var(--color-lock-hole)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Glanceable four-box strip: locked, charged, or spent. Same symbols as the cards. */
export function EnemyWeaponRow({ stock, name }: { stock: WeaponInventory; name: string }) {
  return <div className="weapon-enemy-row" aria-label={`${name} flagship weapons`}>
    <p className="weapon-enemy-row-label">{name}</p>
    <div className="weapon-enemy-boxes" role="list">
      {WEAPON_GRID_IDS.map(id => {
        const status = weaponStatus(stock, id);
        const usedRound = stock[id].usedRound;
        const caption = status === "used" && usedRound ? `Used · R${usedRound}` : STATE[status];
        return <div key={id} role="listitem"
          className={`weapon-enemy-box weapon-${id} weapon-enemy-${status}`}
          aria-label={`${WEAPON_NAMES[id]} · ${caption}`}
          title={`${WEAPON_NAMES[id]} · ${caption}`}>
          <span className="weapon-enemy-mark">
            <WeaponIcon id={id} size={18} />
            {status === "locked" && <LockMark />}
          </span>
          {status === "used" && <span className="weapon-enemy-slash" aria-hidden="true" />}
        </div>;
      })}
    </div>
  </div>;
}

export function WeaponStatusList({ stock, name }: { stock: WeaponInventory; name: string }) {
  return <div className="weapon-status-list" aria-label={`${name} flagship weapons`}>
    <p className="t-eyebrow">{name}</p>
    {WEAPON_GRID_IDS.map(id => {
      const status = weaponStatus(stock, id);
      const use = stock[id].use;
      const stored = isEnergyWeapon(id) ? weaponStored(stock, id) : 0;
      return <div key={id} className={`weapon-status-row weapon-status-${status}`}>
        <span className={`c-${TONE[id]} weapon-status-name`}><WeaponIcon id={id} size={16} />{WEAPON_NAMES[id]}</span>
        <span>{status === "used" && stock[id].usedRound ? `Used R${stock[id].usedRound}` : isEnergyWeapon(id) && status === "available" ? `${stored}/${TUNING.weaponEnergyStoreMax}` : STATE[status]}</span>
        {use && <small>{weaponUseText(use)}</small>}
      </div>;
    })}
  </div>;
}

export function WeaponReport({ yours, theirs, yourStock, enemyStock, enemyName }: {
  yours?: WeaponUse | null; theirs?: WeaponUse | null;
  yourStock?: WeaponInventory; enemyStock?: WeaponInventory; enemyName: string;
}) {
  return <div className="weapon-report">
    {yours && <p className={`c-${TONE[yours.id]}`}>You used {weaponUseText(yours)}</p>}
    {theirs && <p className={`c-${TONE[theirs.id]}`}>{enemyName} used {weaponUseText(theirs)}</p>}
    {(yourStock || enemyStock) && <details>
      <summary>Flagship weapons · available, locked &amp; used</summary>
      {yourStock && <WeaponStatusList stock={yourStock} name="You" />}
      {enemyStock && <WeaponStatusList stock={enemyStock} name={enemyName} />}
    </details>}
  </div>;
}

function WeaponEffectLine({ id, round, stored = 0 }: { id: WeaponId; round: number; stored?: number }) {
  if (id === "attack") {
    return (
      <p className="weapon-effect">
        <span className="weapon-effect-eq">
          Round ({round}) × {TUNING.weaponAttackPerRound} =
        </span>
        <span className="weapon-effect-hit t-num">{weaponAttack(round)} Attack</span>
      </p>
    );
  }
  return <p className="weapon-effect">{weaponEffect(id, round, stored)}</p>;
}

function lockedWeapons(player: PlayerState) {
  return WEAPON_IDS.filter((id) => weaponStatus(weaponsOf(player), id) === "locked");
}

function launcherLabel(player: PlayerState) {
  const used = roundWeapon(player);
  return used ? `Using ${DOCK_NAME[used.id]}` : "Flagship Weapon";
}

export function FlagshipWeapons({ player, enemy, shop = false, busy, onAction }: {
  player: PlayerState; enemy?: PlayerState | null; shop?: boolean; busy?: boolean;
  onAction(action: MatchAction): void;
}) {
  const [open, setOpen] = useState(false);
  const used = roundWeapon(player);
  const locked = lockedWeapons(player);
  const nextCost = locked.length ? Math.min(...locked.map(weaponChargeCostOf)) : TUNING.weaponChargeCost;
  const wait = shop && locked.length > 0 && player.energy < nextCost;
  const canCharge = shop && locked.length > 0;
  const charged = shop && locked.length === 0;
  return <>
    <button type="button"
      className={`weapon-launcher${shop ? " weapon-launcher-shop" : ""}${wait ? " weapon-launcher-wait" : ""}${charged ? " weapon-launcher-charged" : ""}${used && !shop ? ` weapon-launcher-using c-${TONE[used.id]}` : ""}`}
      aria-label={shop ? "Charge flagship weapons" : "Use flagship weapon"}
      aria-live={shop ? undefined : "polite"}
      onClick={() => setOpen(true)}>
      {shop ? (
        <>
          <span className="weapon-launcher-pad">Charge</span>
          <span className="weapon-launcher-meta">
            <span className="weapon-launcher-shop-label">Flagship Weapons</span>
            {canCharge && (
              <EnergyPrice
                cost={nextCost}
                affordable={player.energy >= nextCost}
              />
            )}
          </span>
        </>
      ) : (
        launcherLabel(player)
      )}
    </button>
    {open && <WeaponWindow player={player} enemy={enemy} shop={shop} busy={busy}
      onAction={onAction} onClose={() => setOpen(false)} />}
  </>;
}

function WeaponWindow({ player, enemy, shop, busy, onAction, onClose }: {
  player: PlayerState; enemy?: PlayerState | null; shop: boolean; busy?: boolean;
  onAction(action: MatchAction): void; onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tips, setTips] = useState(false);
  const [rotate, setRotate] = useState(false);
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  const stock = weaponsOf(player);
  const used = roundWeapon(player);
  const canFire = player.phase === "rolling" && !used && !busy;
  const fire = (action: MatchAction) => { onAction(action); onClose(); };
  const turning = rotate && canFire && weaponStatus(stock, "rotate") === "available";
  const shopLede = shop
    ? "One fire per round. Four once a game; energy weapons refill"
    : null;
  return createPortal(<dialog ref={dialog} className="weapon-window" aria-labelledby="weapon-title"
    onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="weapon-window-inner">
      <header className="weapon-window-head">
        <div>
          <p className="t-eyebrow weapon-window-kicker">
            {shop ? "Shipyard" : `Round ${player.round}`}
            <button type="button" className="weapon-tips-link" aria-expanded={tips} onClick={() => setTips(!tips)}>Tips</button>
          </p>
          <h2 id="weapon-title" className="t-display">Flagship weapons</h2>
        </div>
        <EnergyBank energy={player.energy} />
        <p className="weapon-lede">{shopLede ?? <>One fire per round. Four once a game;<br />Energy Attack and Energy Shield refill.</>}</p>
      </header>
      <div className="weapon-window-body">
        {tips && <div className="weapon-tips">
          <p>Rotate, Super Shield, Attack and Repair charge once in the shipyard for {TUNING.weaponChargeCost} Energy. Energy Attack costs {weaponChargeCostOf("energyAttack")} and Energy Shield costs {weaponChargeCostOf("energyShield")}. Those two then take Energy from your bank.</p>
          <p>Add up to {TUNING.weaponEnergyFillPerRound} Energy per weapon each round, one for one from the bank, up to {TUNING.weaponEnergyStoreMax} stored. Adding Energy is not firing. Firing Energy Attack or Energy Shield spends that round’s weapon and empties the store so you can fill it again.</p>
          <p>Both players can see charged and used weapons. Stored Energy and your activation stay hidden until both lock in.</p>
          <p><b>Rotate:</b> turn your flagship −1 or +1 after rolling. It can complete a straight or change your bonus.</p>
          <p><b>Super Shield:</b> halve enemy Attack before your Shields and blocking ships. An odd total rounds up after halving. Direct and War still follow their usual rules.</p>
          <p><b>Attack:</b> add Round (the current round) × {TUNING.weaponAttackPerRound} Attack. Waiting makes it stronger; enemy defenses still apply.</p>
          <p><b>Repair:</b> add {TUNING.weaponRepair} health alongside this volley’s damage. It can save your flagship and raise your health above its previous high.</p>
          <p><b>Energy Attack:</b> each stored Energy becomes 1 Attack when fired.</p>
          <p><b>Energy Shield:</b> each stored Energy becomes 1 Shield when fired. Shields stop Attack; they do not stop Direct or War.</p>
          <p>Opening this window or pressing Back spends nothing. Pressing +1 spends 1 Energy into that store. Pressing Use, or a rotation direction, fires that weapon immediately.</p>
        </div>}
        <div className="weapon-stage">
        {turning ? (
          <div className="weapon-rotate-controls">
            <p>Turn the flagship from {player.flag.face}.</p>
            <p className="weapon-rotate-wrap">
              {FLAG_FACES.length} up becomes 1. 1 down becomes {FLAG_FACES.length}.
            </p>
            <button type="button" className="btn btn-primary weapon-rotate-btn"
              aria-label="Turn the flagship −1"
              onClick={() => fire({ type: "flag-token", direction: -1 })}>
              <span className="weapon-rotate-dir">−1</span>
            </button>
            <button type="button" className="btn btn-primary weapon-rotate-btn"
              aria-label="Turn the flagship +1"
              onClick={() => fire({ type: "flag-token", direction: 1 })}>
              <span className="weapon-rotate-dir">+1</span>
            </button>
          </div>
        ) : (
        <div className="weapon-card-grid">
          {WEAPON_GRID_IDS.map(id => {
            const status = weaponStatus(stock, id);
            const cost = weaponChargeCostOf(id);
            const stored = weaponStored(stock, id);
            const filled = weaponFilledThisRound(stock, id, player.round);
            const energy = isEnergyWeapon(id);
            const canChargeThis = !busy && shop && player.phase === "shop" && status === "locked" && player.energy >= cost;
            const canUseThis = !busy && !shop && status === "available" && canFire && (!energy || stored > 0);
            const enabled = canChargeThis || canUseThis;
            return <section className={`weapon-card weapon-${id} weapon-card-${status}${energy ? " weapon-card-energy" : ""}`} key={id}>
              <div className="weapon-card-top"><WeaponIcon id={id} /><span className="weapon-state">{STATE[status]}</span></div>
              <h3>{WEAPON_NAMES[id]}</h3>
              <WeaponEffectLine id={id} round={player.round} stored={stored} />
              {energy && status === "available" && (
                <div className="weapon-energy-store">
                  <p className="weapon-energy-count t-num">{stored}/{TUNING.weaponEnergyStoreMax}</p>
                  <p className="weapon-energy-cap">{filled}/{TUNING.weaponEnergyFillPerRound} this round · 1 Energy each</p>
                  <button type="button"
                    className="weapon-energy-plus"
                    disabled={busy || !canFillWeapon(player, id)}
                    onClick={() => onAction({ type: "weapon-fill", weapon: id as EnergyWeaponId })}
                    aria-label={`Add 1 Energy to ${WEAPON_NAMES[id]}`}>
                    +1
                  </button>
                </div>
              )}
              <button type="button" disabled={!enabled}
                className={shop && status === "available" ? "weapon-btn-charged" : !shop && status === "available" && enabled ? "weapon-btn-ready" : undefined}
                onClick={() => {
                  if (shop) onAction({ type: "shop", operation: "weapon", weapon: id });
                  else if (id === "rotate") setRotate(true);
                  else fire({ type: "weapon", weapon: id as Exclude<WeaponId, "rotate"> });
                }} aria-label={shop ? `Charge ${WEAPON_NAMES[id]} for ${cost} Energy` : `Use ${WEAPON_NAMES[id]}`}>
                {status === "used" ? `Used${stock[id].usedRound ? ` · Round ${stock[id].usedRound}` : ""}`
                  : shop ? status === "available" ? energy ? "Unlocked" : "Charged" : `Charge · ${cost} Energy`
                  : status === "locked" ? "Charge in shipyard" : used ? "Next volley" : energy && stored <= 0 ? "Add Energy first" : "Use weapon"}
              </button>
            </section>;
          })}
        </div>
        )}
        </div>
      </div>
      {enemy && <EnemyWeaponRow stock={weaponsOf(enemy)} name={enemy.name} />}
      <footer><button type="button" className="btn btn-primary w-full" onClick={onClose}>Back</button></footer>
    </div>
  </dialog>, document.body);
}
