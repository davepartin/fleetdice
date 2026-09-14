"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TUNING, WEAPON_IDS, WEAPON_NAMES, weaponAttack, weaponEffect, weaponStatus, weaponsOf, roundWeapon,
  type MatchAction, type PlayerState, type WeaponInventory, type WeaponUse,
} from "@/lib/engine";

const ICON = { rotate: "↻", shield: "◈", attack: "✦", repair: "+" };
const TONE = { rotate: "energy", shield: "shield", attack: "attack", repair: "repair" };
const STATE = { locked: "Locked", available: "Available", used: "Used" };

export function weaponUseText(use: WeaponUse): string {
  if (use.id === "rotate") return `Rotate Flagship · ${use.from ?? "?"} → ${use.to ?? "?"}`;
  if (use.id === "shield") return `Super Shield · ${use.amount} Attack stopped`;
  return `${WEAPON_NAMES[use.id]} · +${use.amount}`;
}

export function WeaponStatusList({ stock, name }: { stock: WeaponInventory; name: string }) {
  return <div className="weapon-status-list" aria-label={`${name} flagship weapons`}>
    <p className="t-eyebrow">{name}</p>
    {WEAPON_IDS.map(id => {
      const status = weaponStatus(stock, id);
      const use = stock[id].use;
      return <div key={id} className={`weapon-status-row weapon-status-${status}`}>
        <span className={`c-${TONE[id]}`}><span aria-hidden="true">{ICON[id]} </span>{WEAPON_NAMES[id]}</span>
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

function lockedWeapons(player: PlayerState) {
  return WEAPON_IDS.filter((id) => weaponStatus(weaponsOf(player), id) === "locked");
}

function launcherLabel(player: PlayerState, shop: boolean) {
  if (!shop) {
    const used = roundWeapon(player);
    return used ? `Using ${WEAPON_NAMES[used.id]}` : "Use flagship weapon";
  }
  if (lockedWeapons(player).length && player.energy < TUNING.weaponChargeCost) {
    return `Need ${TUNING.weaponChargeCost} Energy to charge`;
  }
  return `Flagship Weapons · ${TUNING.weaponChargeCost} Energy`;
}

/** On the roll dock: the weapon already fired this volley, in words. */
export function WeaponUsingCue({ player }: { player: PlayerState }) {
  const used = roundWeapon(player);
  if (!used) return null;
  return (
    <p className={`weapon-using-cue c-${TONE[used.id]}`} aria-live="polite">
      Using {WEAPON_NAMES[used.id]}
    </p>
  );
}

export function FlagshipWeapons({ player, enemy, shop = false, busy, onAction }: {
  player: PlayerState; enemy?: PlayerState | null; shop?: boolean; busy?: boolean;
  onAction(action: MatchAction): void;
}) {
  const [open, setOpen] = useState(false);
  const used = roundWeapon(player);
  const wait = shop && lockedWeapons(player).length > 0 && player.energy < TUNING.weaponChargeCost;
  return <>
    <button type="button"
      className={`weapon-launcher${wait ? " weapon-launcher-wait" : ""}${used && !shop ? ` weapon-launcher-using c-${TONE[used.id]}` : ""}`}
      aria-label={shop ? "Charge flagship weapons" : "Use flagship weapon"}
      onClick={() => setOpen(true)}>
      {launcherLabel(player, shop)}
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
  return createPortal(<dialog ref={dialog} className="weapon-window" aria-labelledby="weapon-title"
    onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="weapon-window-inner">
      <header className="weapon-window-head">
        <div><p className="t-eyebrow">{shop ? "Shipyard" : `Round ${player.round}`}</p>
          <h2 id="weapon-title" className="t-display">Flagship weapons</h2></div>
        <button type="button" className="weapon-small-button" aria-expanded={tips} onClick={() => setTips(!tips)}>Tips</button>
      </header>
      <div className="weapon-window-scroll">
        <p className="weapon-guide">{shop
          ? player.energy < TUNING.weaponChargeCost && lockedWeapons(player).length
            ? `Need ${TUNING.weaponChargeCost} Energy to charge · ${player.energy} in the bank`
            : `${player.energy} Energy in the bank · ${TUNING.weaponChargeCost} per charge`
          : "You may use one flagship weapon per round."}</p>
        {tips && <div className="weapon-tips">
          <p>Charge each weapon once in the shipyard for {TUNING.weaponChargeCost} Energy. Save it for any later volley. Firing costs no extra Energy.</p>
          <p>Both players can see charged and used weapons. Your activation stays hidden until both lock in.</p>
          <p><b>Rotate:</b> turn your flagship −1 or +1 after rolling. It can complete a straight or change your bonus.</p>
          <p><b>Super Shield:</b> halve enemy Attack before your Shields and blocking ships. An odd total rounds up after halving. Direct and War still follow their usual rules.</p>
          <p><b>Attack:</b> add the current round × {TUNING.weaponAttackPerRound} Attack. Waiting makes it stronger; enemy defenses still apply.</p>
          <p><b>Repair:</b> add {TUNING.weaponRepair} health alongside this volley’s damage. It can save your flagship and raise your health above its previous high.</p>
          <p>Opening this window or pressing Back spends nothing. Pressing Use, or a rotation direction, spends that charge immediately.</p>
        </div>}
        {rotate && canFire && weaponStatus(stock, "rotate") === "available" && <div className="weapon-rotate-controls">
          <p>Turn the flagship from {player.flag.face}:</p>
          <button type="button" className="btn btn-primary weapon-rotate-btn" autoFocus
            aria-label="Turn the flagship −1"
            onClick={() => fire({ type: "flag-token", direction: -1 })}>
            <span className="weapon-rotate-dir">−1</span>
          </button>
          <button type="button" className="btn btn-primary weapon-rotate-btn"
            aria-label="Turn the flagship +1"
            onClick={() => fire({ type: "flag-token", direction: 1 })}>
            <span className="weapon-rotate-dir">+1</span>
          </button>
        </div>}
        <div className="weapon-card-grid">
          {WEAPON_IDS.map(id => {
            const status = weaponStatus(stock, id);
            const enabled = !busy && (shop
              ? player.phase === "shop" && status === "locked" && player.energy >= TUNING.weaponChargeCost
              : status === "available" && canFire);
            return <section className={`weapon-card weapon-${id} weapon-card-${status}`} key={id}>
              <div className="weapon-card-top"><span className="weapon-symbol" aria-hidden="true">{ICON[id]}</span><span className="weapon-state">{STATE[status]}</span></div>
              <h3>{WEAPON_NAMES[id]}</h3>
              <p className="weapon-effect">{weaponEffect(id, player.round)}</p>
              {id === "attack" && <p className="weapon-effect-now">+{weaponAttack(player.round)} Attack</p>}
              <button type="button" disabled={!enabled} onClick={() => {
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
        {!shop && player.phase !== "rolling" && <p className="weapon-guide">{player.phase === "ready" ? "Roll your fleet before using a weapon." : "Your volley is locked in."}</p>}
        {enemy && <details className="weapon-enemy-status"><summary>{enemy.name} · weapon status</summary>
          <WeaponStatusList stock={weaponsOf(enemy)} name={enemy.name} />
        </details>}
      </div>
      <footer><button type="button" className="btn btn-primary w-full" onClick={onClose}>Back</button></footer>
    </div>
  </dialog>, document.body);
}
