"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TUNING, FLAG_FACES, WEAPON_IDS, WEAPON_NAMES, weaponAttack, weaponEffect, weaponStatus, weaponsOf, roundWeapon,
  type MatchAction, type PlayerState, type WeaponId, type WeaponInventory, type WeaponUse,
} from "@/lib/engine";
import { EnergyBank, EnergyPrice } from "./ui";
import { StatIcon } from "./StatIcon";

const TONE = { rotate: "energy", shield: "shield", attack: "attack", repair: "repair" };
const STATE = { locked: "Locked", available: "Available", used: "Used" };
/** Short names for the compact dock tap. Full names stay in the window. */
const DOCK_NAME = { rotate: "Rotate", shield: "Shield", attack: "Attack", repair: "Repair" };

export function weaponUseText(use: WeaponUse): string {
  if (use.id === "rotate") return `Rotate Flagship · ${use.from ?? "?"} → ${use.to ?? "?"}`;
  if (use.id === "shield") return `Super Shield · ${use.amount} Attack stopped`;
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
  const kind = id === "shield" ? "shield" : id === "attack" ? "attack" : "repair";
  return <StatIcon kind={kind} size={size} className="weapon-symbol" />;
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
      {WEAPON_IDS.map(id => {
        const status = weaponStatus(stock, id);
        const usedRound = stock[id].usedRound;
        const caption = status === "used" && usedRound ? `Used · R${usedRound}` : STATE[status];
        return <div key={id} role="listitem"
          className={`weapon-enemy-box weapon-${id} weapon-enemy-${status}`}
          aria-label={`${WEAPON_NAMES[id]} · ${caption}`}
          title={`${WEAPON_NAMES[id]} · ${caption}`}>
          <span className="weapon-enemy-mark">
            <WeaponIcon id={id} size={22} />
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
    {WEAPON_IDS.map(id => {
      const status = weaponStatus(stock, id);
      const use = stock[id].use;
      return <div key={id} className={`weapon-status-row weapon-status-${status}`}>
        <span className={`c-${TONE[id]} weapon-status-name`}><WeaponIcon id={id} size={16} />{WEAPON_NAMES[id]}</span>
        <span>{status === "used" && stock[id].usedRound ? `Used R${stock[id].usedRound}` : STATE[status]}</span>
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

function WeaponEffectLine({ id, round }: { id: WeaponId; round: number }) {
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
  return <p className="weapon-effect">{weaponEffect(id, round)}</p>;
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
  const wait = shop && locked.length > 0 && player.energy < TUNING.weaponChargeCost;
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
                cost={TUNING.weaponChargeCost}
                affordable={player.energy >= TUNING.weaponChargeCost}
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
  const shopLede = shop ? "One-time use per game and only 1 per round" : null;
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
        {shop && <EnergyBank energy={player.energy} />}
        <p className="weapon-lede">{shopLede ?? <>Each may be used <b>once</b> per game<br />and only <b>one</b> per round.</>}</p>
      </header>
      <div className="weapon-window-body">
        {tips && <div className="weapon-tips">
          <p>Charge each weapon once in the shipyard for {TUNING.weaponChargeCost} Energy. Save it for any later volley. Firing costs no extra Energy.</p>
          <p>Both players can see charged and used weapons. Your activation stays hidden until both lock in.</p>
          <p><b>Rotate:</b> turn your flagship −1 or +1 after rolling. It can complete a straight or change your bonus.</p>
          <p><b>Super Shield:</b> halve enemy Attack before your Shields and blocking ships. An odd total rounds up after halving. Direct and War still follow their usual rules.</p>
          <p><b>Attack:</b> add Round (the current round) × {TUNING.weaponAttackPerRound} Attack. Waiting makes it stronger; enemy defenses still apply.</p>
          <p><b>Repair:</b> add {TUNING.weaponRepair} health alongside this volley’s damage. It can save your flagship and raise your health above its previous high.</p>
          <p>Opening this window or pressing Back spends nothing. Pressing Use, or a rotation direction, spends that charge immediately.</p>
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
          {WEAPON_IDS.map(id => {
            const status = weaponStatus(stock, id);
            const enabled = !busy && (shop
              ? player.phase === "shop" && status === "locked" && player.energy >= TUNING.weaponChargeCost
              : status === "available" && canFire);
            return <section className={`weapon-card weapon-${id} weapon-card-${status}`} key={id}>
              <div className="weapon-card-top"><WeaponIcon id={id} /><span className="weapon-state">{STATE[status]}</span></div>
              <h3>{WEAPON_NAMES[id]}</h3>
              <WeaponEffectLine id={id} round={player.round} />
              <button type="button" disabled={!enabled}
                className={shop && status === "available" ? "weapon-btn-charged" : undefined}
                onClick={() => {
                  if (shop) onAction({ type: "shop", operation: "weapon", weapon: id });
                  else if (id === "rotate") setRotate(true);
                  else fire({ type: "weapon", weapon: id });
                }} aria-label={shop ? `Charge ${WEAPON_NAMES[id]} for ${TUNING.weaponChargeCost} Energy` : `Use ${WEAPON_NAMES[id]}`}>
                {status === "used" ? `Used${stock[id].usedRound ? ` · Round ${stock[id].usedRound}` : ""}`
                  : shop ? status === "available" ? "Charged" : `Charge · ${TUNING.weaponChargeCost} Energy`
                  : status === "locked" ? "Charge in shipyard" : used ? "Next volley" : "Use weapon"}
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
