import { OUTPOSTS } from "./layout";
import { terrainHeight, segmentHitsSphere, type VehicleState } from "./physics";
export const BREACH_SECONDS = 14;
export interface Breach {
  gate: number;
  remaining: number;
  breached: boolean;
}
export const createBreaches = (): Breach[] =>
  OUTPOSTS.map(() => ({ gate: 0, remaining: 0, breached: false }));
export type BreachEvent = {
  site: number;
  kind: "started" | "gate" | "breached" | "expired";
};
export function advanceBreaches(
  states: Breach[],
  previous: Pick<VehicleState, "x" | "y" | "z">,
  vehicle: VehicleState,
  dt: number,
): BreachEvent[] {
  const events: BreachEvent[] = [];
  states.forEach((state, index) => {
    if (state.breached) return;
    if (state.gate > 0) {
      state.remaining = Math.max(0, state.remaining - dt);
      if (state.remaining === 0) {
        state.gate = 0;
        events.push({ site: index, kind: "expired" });
        return;
      }
    }
    const gate = OUTPOSTS[index].gates[state.gate];
    const y = terrainHeight(gate.x, gate.z) + gate.altitude;
    const hit = gate.airborne
      ? vehicle.airborne &&
        Math.hypot(vehicle.vx, vehicle.vz) >= 25 &&
        segmentHitsSphere(
          previous.x,
          previous.y,
          previous.z,
          vehicle.x,
          vehicle.y,
          vehicle.z,
          gate.x,
          y,
          gate.z,
          8,
        )
      : segmentHitsSphere(
          previous.x,
          0,
          previous.z,
          vehicle.x,
          0,
          vehicle.z,
          gate.x,
          0,
          gate.z,
          15,
        );
    if (!hit) return;
    state.gate++;
    if (state.gate === 3) {
      state.breached = true;
      state.remaining = 0;
      events.push({ site: index, kind: "breached" });
    } else if (state.gate === 1) {
      state.remaining = BREACH_SECONDS;
      events.push({ site: index, kind: "started" });
    } else events.push({ site: index, kind: "gate" });
  });
  return events;
}
