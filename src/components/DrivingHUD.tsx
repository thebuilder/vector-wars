import { Crosshair, Rocket, Disc, Map } from "lucide-react";
import { Progress } from "./ui/progress";
import { WEAPONS, type Snapshot, type Weapon } from "../game/types";
const ICONS = { laser: Crosshair, missile: Rocket, mine: Disc };
export function DrivingHUD({
  state,
  onWeapon,
  onMap,
}: {
  state: Snapshot;
  onWeapon: (weapon: Weapon) => void;
  onMap: () => void;
}) {
  const selected = WEAPONS.find((w) => w.id === state.weapon)!;
  return (
    <>
      <button className="map-trigger" onClick={onMap}>
        <Map size={15} />
        <kbd>M</kbd> MAP
      </button>
      <section className="drive-vitals" aria-label="Vehicle telemetry">
        <div className="drive-speed">
          <strong>{state.speed}</strong>
          <span>KM/H{state.altitude > 2 && <small>AIRBORNE</small>}</span>
        </div>
        <div className="drive-meters">
          <div>
            <span>HULL</span>
            <strong className={state.health < 30 ? "text-signal" : ""}>
              {Math.ceil(state.health)}%
            </strong>
          </div>
          <Progress
            value={state.health}
            aria-label="Hull integrity"
            className={state.health < 30 ? "hull-critical" : ""}
          />
          <div>
            <span>BOOST</span>
            <strong>{Math.round(state.boost)}%</strong>
          </div>
          <Progress
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
