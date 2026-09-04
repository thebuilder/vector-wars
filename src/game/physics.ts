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
export const WORLD_LIMIT = 340;
export const ramps = [
  { x: 0, z: 65, width: 16, length: 26, height: 8 },
  { x: -112, z: -75, width: 20, length: 28, height: 10 },
  { x: 102, z: -65, width: 18, length: 26, height: 9 },
];
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z + 50);
  const rolling =
    Math.sin(x * 0.019) * Math.sin(z * 0.015) * 2.2 +
    Math.sin(z * 0.034 + x * 0.008) * 1.3;
  const mountains = Math.max(0, r - 330) / 160;
  return (
    rolling +
    Math.min(1.8, mountains) *
      (28 +
        36 * Math.sin(x * 0.015 + z * 0.012) ** 2 +
        40 * Math.sin(x * 0.026 - z * 0.019) ** 2)
  );
}
export function surfaceHeight(x: number, z: number): number {
  let h = terrainHeight(x, z);
  for (const ramp of ramps) {
    const t = (ramp.z + ramp.length / 2 - z) / ramp.length;
    if (Math.abs(x - ramp.x) < ramp.width / 2 && t >= 0 && t <= 1)
      h = Math.max(h, terrainHeight(ramp.x, ramp.z) + t * ramp.height);
  }
  return h;
}
export function createVehicle(): VehicleState {
  return {
    x: 0,
    y: surfaceHeight(0, 125) + 1.7,
    z: 125,
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
): { impact: number; boosting: boolean; landed: boolean } {
  const wasAirborne = v.airborne;
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
  const floor = surfaceHeight(v.x, v.z) + 1.7;
  if (input.jump && !v.airborne) {
    v.vy = 17;
    v.y += 0.25;
  }
  const displacement = floor - v.y;
  if (displacement > -1.2 && v.vy < 6)
    v.vy += (displacement * 95 - v.vy * 12 + 24) * dt;
  v.vy -= 24 * dt;
  v.y += v.vy * dt;
  v.airborne = v.y > floor + 0.8 || v.vy > 6;
  let impact = 0;
  if (v.y < floor - 0.55) {
    impact = Math.max(0, -v.vy - 24);
    v.y = floor - 0.55;
    v.vy = Math.max(0, v.vy) * 0.25;
  }
  const dist = Math.hypot(v.x, v.z + 50);
  if (dist > WORLD_LIMIT) {
    const nx = v.x / dist,
      nz = (v.z + 50) / dist;
    v.x = nx * WORLD_LIMIT;
    v.z = nz * WORLD_LIMIT - 50;
    const outward = v.vx * nx + v.vz * nz;
    if (outward > 0) {
      v.vx -= nx * outward * 1.5;
      v.vz -= nz * outward * 1.5;
      impact += outward * 0.08;
    }
  }
  return { impact, boosting, landed: wasAirborne && !v.airborne };
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
