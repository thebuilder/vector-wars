import { WORLDS, type WorldLayout } from "./worlds";
import { terrainHeight, segmentHitsSphere, type VehicleState } from "./physics";
export const BREACH_SECONDS = 14;
export interface Breach {
  gate: number;
  remaining: number;
  breached: boolean;
  missedInside?: boolean;
}
export const createBreaches = (): Breach[] =>
  WORLDS[0].outposts.map(() => ({ gate: 0, remaining: 0, breached: false }));
export type BreachEvent = {
  site: number;
  kind: "started" | "gate" | "breached" | "expired" | "missed";
  reason?: "speed" | "airborne";
};
export function advanceBreaches(
  states: Breach[],
  previous: Pick<VehicleState, "x" | "y" | "z">,
  vehicle: VehicleState,
  dt: number,
  world: WorldLayout = WORLDS[0],
): BreachEvent[] {
  const events: BreachEvent[] = [];
  states.forEach((state, index) => {
    if (state.breached) return;
    if (state.gate > 0) {
      state.remaining = Math.max(0, state.remaining - dt);
      if (state.remaining === 0) {
        state.gate = 0;
        state.missedInside = false;
        events.push({ site: index, kind: "expired" });
        return;
      }
    }
    const gate = world.outposts[index].gates[state.gate];
    const y = terrainHeight(gate.x, gate.z, world) + gate.altitude;
    const hit = gate.airborne
      ? segmentHitsSphere(
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
    if (gate.airborne) {
      const inside =
        Math.hypot(vehicle.x - gate.x, vehicle.y - y, vehicle.z - gate.z) <= 8;
      const reason = !vehicle.airborne
        ? "airborne"
        : Math.hypot(vehicle.vx, vehicle.vz) < 25
          ? "speed"
          : undefined;
      if (hit && reason) {
        if (!state.missedInside)
          events.push({ site: index, kind: "missed", reason });
        state.missedInside = inside;
        return;
      }
      if (!inside) state.missedInside = false;
    }
    if (!hit) return;
    state.missedInside = false;
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
