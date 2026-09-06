import { Crosshair, Rocket, Disc } from "lucide-react";
import { Progress } from "./ui/progress";
import { WEAPONS, type Snapshot, type Weapon } from "../game/types";
const ICONS = { laser: Crosshair, missile: Rocket, mine: Disc };
export function DrivingHUD({
  state,
  onWeapon,
}: {
  state: Snapshot;
  onWeapon: (weapon: Weapon) => void;
}) {
  const selected = WEAPONS.find((w) => w.id === state.weapon)!;
  return (
    <>
      <section className="drive-vitals" aria-label="Vehicle telemetry">
        <div className="vitals-heading">
          <span>
            <i className="led" /> VXR–01 / ONLINE
          </span>
          <span>ION DRIVE</span>
        </div>
        <div className="drive-speed">
          <strong>{String(state.speed).padStart(3, "0")}</strong>
          <span>
            KM/H
            <small>{state.altitude > 2 ? "AIRBORNE" : "GROUND SPEED"}</small>
          </span>
          <div className="drive-speed-segments" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} className={i < state.speed / 12 ? "lit" : ""} />
            ))}
          </div>
        </div>
        <div className="drive-meters">
          <div>
            <span>HULL</span>
            <strong className={state.health < 30 ? "text-signal" : ""}>
              {Math.ceil(state.health)}%
            </strong>
          </div>
          <Progress
            cells={22}
            value={state.health}
            aria-label="Hull integrity"
            className={state.health < 30 ? "hull-critical" : ""}
          />
          <div className={state.overdrive > 0 ? "overdrive-active" : undefined}>
            <span>
              {state.overdrive > 0 ? "OVERDRIVE · FREE BOOST" : "BOOST"}
            </span>
            <strong>
              {state.overdrive > 0
                ? `${Math.ceil(state.overdrive)} S`
                : `${Math.round(state.boost)}%`}
            </strong>
          </div>
          <Progress
            cells={22}
            value={state.boost}
            aria-label="Boost capacitor"
            className="boost-progress"
          />
        </div>
      </section>
      <section className="drive-weapons" aria-label="Weapons">
        <div className="equipped-weapon">
          <span>{selected.name}</span>
          <strong>
            {state.weapon === "laser"
              ? "∞"
              : state.weapon === "missile"
                ? state.missiles
                : state.mines}
          </strong>
        </div>
        <div>
          {WEAPONS.map((w) => {
            const Icon = ICONS[w.id];
            return (
              <button
                key={w.id}
                onClick={() => onWeapon(w.id)}
                aria-label={`${w.name} (${w.key})`}
                aria-pressed={state.weapon === w.id}
                title={`${w.name} · ${w.key}`}
              >
                <kbd>{w.key}</kbd>
                <Icon size={19} />
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
