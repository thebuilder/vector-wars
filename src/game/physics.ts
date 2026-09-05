import { WORLDS, type WorldLayout } from "./worlds";
import { RAMPS, WORLD_CENTER_Z, WORLD_RADIUS, type Ramp } from "./layout";
export interface VehicleState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  steer: number;
  boost: number;
  airborne: boolean;
}
export interface DriveInput {
  throttle: number;
  turn: number;
  drift: boolean;
  boost: boolean;
  jump: boolean;
}
export const WORLD_LIMIT = WORLD_RADIUS;
export const ramps = RAMPS;
export const HOVER_HEIGHT = 1.7;
export const VEHICLE_RADIUS = 2.2;
export function terrainHeight(
  x: number,
  z: number,
  world: WorldLayout = WORLDS[0],
): number {
  const r = Math.hypot(x, z - WORLD_CENTER_Z);
  const rolling =
    Math.sin(x * 0.019) * Math.sin(z * 0.015) * 2.2 +
    Math.sin(z * 0.034 + x * 0.008) * 1.3;
  const mountains = Math.max(0, r - 980) / 160;
  const region =
    world.id === 1
      ? Math.sin(x * 0.006 + z * 0.002) * 6 + Math.sin(z * 0.014) * 2
      : world.id === 2
        ? Math.sin(x * 0.011) * Math.cos(z * 0.009) * 5 +
          Math.sin(z * 0.016) * 3
        : rolling;
  return (
    region +
    Math.min(1.8, mountains) *
      (28 +
        36 * Math.sin(x * 0.015 + z * 0.012) ** 2 +
        40 * Math.sin(x * 0.026 - z * 0.019) ** 2)
  );
}
export function rampHeight(
  ramp: Ramp,
  z: number,
  world: WorldLayout = WORLDS[0],
) {
  const t = Math.max(
    0,
    Math.min(1, (ramp.z + ramp.length / 2 - z) / ramp.length),
  );
  const low = terrainHeight(ramp.x, ramp.z + ramp.length / 2, world);
  const high =
    terrainHeight(ramp.x, ramp.z - ramp.length / 2, world) + ramp.height;
  return low + (high - low) * t;
}
export function surfaceHeight(
  x: number,
  z: number,
  world: WorldLayout = WORLDS[0],
): number {
  let h = terrainHeight(x, z, world);
  for (const ramp of world.ramps) {
    const t = (ramp.z + ramp.length / 2 - z) / ramp.length;
    if (Math.abs(x - ramp.x) < ramp.width / 2 && t >= 0 && t <= 1)
      h = Math.max(h, rampHeight(ramp, z, world));
  }
  return h;
}
export function createVehicle(world: WorldLayout = WORLDS[0]): VehicleState {
  return {
    x: world.spawn.x,
    y: surfaceHeight(world.spawn.x, world.spawn.z, world) + 1.7,
    z: world.spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    steer: 0,
    boost: 100,
    airborne: false,
  };
}
export function stepVehicle(
  v: VehicleState,
  input: DriveInput,
  dt: number,
  world: WorldLayout = WORLDS[0],
): { impact: number; boosting: boolean; landed: boolean } {
  const wasAirborne = v.airborne;
  const previous = { x: v.x, y: v.y, z: v.z };
  let impact = 0;
  const speed = Math.hypot(v.vx, v.vz);
  const boosting = input.boost && v.boost > 1 && input.throttle > 0;
  v.boost = Math.max(0, Math.min(100, v.boost + (boosting ? -28 : 14) * dt));
  const turnResponse = 1 - Math.exp(-9 * dt);
  v.steer += (input.turn - v.steer) * turnResponse;
  v.heading +=
    v.steer *
    (1.1 + Math.min(speed / 55, 1) * 0.85) *
    (input.drift ? 1.42 : 1) *
    dt;
  const fx = -Math.sin(v.heading),
    fz = -Math.cos(v.heading);
  const rx = Math.cos(v.heading),
    rz = -Math.sin(v.heading);
  const lateral = v.vx * rx + v.vz * rz;
  const traction = input.drift ? 0.65 : 5.2;
  v.vx -= rx * lateral * Math.min(1, traction * dt);
  v.vz -= rz * lateral * Math.min(1, traction * dt);
  const acceleration = (boosting ? 72 : 40) * input.throttle;
  v.vx += fx * acceleration * dt;
  v.vz += fz * acceleration * dt;
  const drag = Math.exp(-(input.throttle ? 0.48 : 1.1) * dt);
  v.vx *= drag;
  v.vz *= drag;
  v.x += v.vx * dt;
  v.z += v.vz * dt;
  impact += resolveWorldContacts(v, previous, world);
  const floor = surfaceHeight(v.x, v.z, world) + HOVER_HEIGHT;
  if (input.jump && !v.airborne) {
    v.vy = 17;
    v.y += 0.25;
  }
  const displacement = floor - v.y;
  const onRamp = world.ramps.some(
    (r) =>
      Math.abs(v.x - r.x) < r.width / 2 && Math.abs(v.z - r.z) < r.length / 2,
  );
  const followingDeck = onRamp && !wasAirborne && !input.jump;
  const supportVelocity = followingDeck
    ? (floor - surfaceHeight(previous.x, previous.z, world) - HOVER_HEIGHT) / dt
    : 0;
  if (displacement > -1.2 && (v.vy < 6 || followingDeck))
    v.vy += (displacement * 95 - (v.vy - supportVelocity) * 12 + 24) * dt;
  v.vy -= 24 * dt;
  v.y += v.vy * dt;
  v.airborne = v.y > floor + 0.8 || (v.vy > 6 && !followingDeck);
  if (v.y < floor - 0.55) {
    impact += Math.max(0, -v.vy - 24);
    v.y = floor - 0.55;
    v.vy = Math.max(0, v.vy) * 0.25;
  }
  const dist = Math.hypot(v.x, v.z - WORLD_CENTER_Z);
  if (dist > WORLD_LIMIT) {
    const nx = v.x / dist,
      nz = (v.z - WORLD_CENTER_Z) / dist;
    v.x = nx * WORLD_LIMIT;
    v.z = nz * WORLD_LIMIT + WORLD_CENTER_Z;
    const outward = v.vx * nx + v.vz * nz;
    if (outward > 0) {
      v.vx -= nx * outward * 1.5;
      v.vz -= nz * outward * 1.5;
      impact += outward * 0.08;
    }
  }
  return { impact, boosting, landed: wasAirborne && !v.airborne };
}
/** Resolve solid sides before sampling suspension support. A low side impact must
 * never turn into a landing on the wedge's deck. */
export function resolveWorldContacts(
  v: VehicleState,
  previous: { x: number; y: number; z: number },
  world: WorldLayout = WORLDS[0],
): number {
  let impact = 0;
  const bounce = (nx: number, nz: number) => {
    const closing = v.vx * nx + v.vz * nz;
    if (closing < 0) {
      v.vx -= nx * closing * 1.3;
      v.vz -= nz * closing * 1.3;
      impact += Math.max(0, -closing - 8) * 0.24;
    }
  };
  for (const ramp of world.ramps) {
    const left = ramp.x - ramp.width / 2,
      right = ramp.x + ramp.width / 2;
    const back = ramp.z - ramp.length / 2,
      front = ramp.z + ramp.length / 2;
    const r = VEHICLE_RADIUS;
    if (
      v.x <= left - r ||
      v.x >= right + r ||
      v.z <= back - r ||
      v.z >= front + r
    )
      continue;
    const deck = rampHeight(ramp, v.z, world);
    const prevDeck = rampHeight(ramp, previous.z, world);
    const wasSupported =
      previous.x >= left &&
      previous.x <= right &&
      previous.z >= back &&
      previous.z <= front &&
      previous.y >= prevDeck + 0.9;
    // Approach from above or follow a deck already supporting the suspension.
    if (v.y >= deck + 0.95 || wasSupported) continue;
    if (previous.x <= left - r) {
      v.x = left - r;
      bounce(-1, 0);
    } else if (previous.x >= right + r) {
      v.x = right + r;
      bounce(1, 0);
    } else if (previous.z <= back - r) {
      v.z = back - r;
      bounce(0, -1);
    } else if (previous.z >= front - r) {
      v.z = front + r;
      bounce(0, 1);
    } else {
      const distances = [v.x - (left - r), right + r - v.x, v.z - (back - r)];
      const side = distances.indexOf(Math.min(...distances));
      if (side === 0) {
        v.x = left - r;
        bounce(-1, 0);
      } else if (side === 1) {
        v.x = right + r;
        bounce(1, 0);
      } else {
        v.z = back - r;
        bounce(0, -1);
      }
    }
  }
  for (const pillar of world.pillars) {
    const ground = terrainHeight(pillar.x, pillar.z, world);
    if (v.y - 0.7 > ground + pillar.height || v.y + 0.7 < ground) continue;
    const dx = v.x - pillar.x,
      dz = v.z - pillar.z,
      dist = Math.hypot(dx, dz);
    const radius = pillar.radius + VEHICLE_RADIUS;
    if (dist >= radius) continue;
    const nx = dist > 0.001 ? dx / dist : 1,
      nz = dist > 0.001 ? dz / dist : 0;
    v.x = pillar.x + nx * radius;
    v.z = pillar.z + nz * radius;
    bounce(nx, nz);
  }
  return impact;
}

/** Horizontal hover-body contact transfers momentum and preserves separation. */
export function separateVehicles(
  player: VehicleState,
  other: { x: number; y: number; z: number; vx: number; vz: number },
  radius = 5.5,
): number {
  if (Math.abs(player.y - other.y) > 5) return 0;
  const dx = player.x - other.x,
    dz = player.z - other.z,
    d = Math.hypot(dx, dz);
  if (d >= radius) return 0;
  const nx = d > 0.001 ? dx / d : Math.cos(player.heading),
    nz = d > 0.001 ? dz / d : -Math.sin(player.heading);
  const overlap = radius - d;
  player.x += nx * overlap * 0.4;
  player.z += nz * overlap * 0.4;
  other.x -= nx * overlap * 0.6;
  other.z -= nz * overlap * 0.6;
  const closing = (player.vx - other.vx) * nx + (player.vz - other.vz) * nz;
  if (closing >= 0) return 0;
  const impulse = -closing * 0.7;
  player.vx += nx * impulse * 0.7;
  player.vz += nz * impulse * 0.7;
  other.vx -= nx * impulse;
  other.vz -= nz * impulse;
  return -closing;
}

export function segmentHitsSphere(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
): boolean {
  const dx = bx - ax,
    dy = by - ay,
    dz = bz - az;
  const lenSq = dx * dx + dy * dy + dz * dz;
  const t = lenSq
    ? Math.max(
        0,
        Math.min(1, ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / lenSq),
      )
    : 0;
  return (
    (ax + dx * t - cx) ** 2 +
      (ay + dy * t - cy) ** 2 +
      (az + dz * t - cz) ** 2 <=
    radius * radius
  );
}
