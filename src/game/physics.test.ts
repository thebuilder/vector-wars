import { WORLD_CENTER_Z, PILLARS, RAMPS } from "./layout";
import { describe, expect, it } from "vitest";
import {
  createVehicle,
  stepVehicle,
  surfaceHeight,
  segmentHitsSphere,
  WORLD_LIMIT,
  terrainHeight,
  resolveWorldContacts,
  separateVehicles,
  type DriveInput,
} from "./physics";
const idle: DriveInput = {
  throttle: 0,
  turn: 0,
  drift: false,
  boost: false,
  jump: false,
};
function simulate(input: DriveInput, seconds = 3) {
  const v = createVehicle();
  for (let i = 0; i < seconds * 120; i++) stepVehicle(v, input, 1 / 120);
  return v;
}
describe("hovercraft physics", () => {
  it("settles on its hover spring without drifting or gaining energy", () => {
    const v = simulate(idle, 10);
    expect(v.y).toBeCloseTo(surfaceHeight(v.x, v.z) + 1.7, 3);
    expect(v.vy).toBeCloseTo(0, 3);
    expect(v.z).toBe(125);
  });
  it("accelerates, boosts faster, and consumes a rechargeable capacitor", () => {
    const regular = simulate({ ...idle, throttle: 1 }, 2),
      boost = simulate({ ...idle, throttle: 1, boost: true }, 2);
    expect(Math.hypot(boost.vx, boost.vz)).toBeGreaterThan(
      Math.hypot(regular.vx, regular.vz) * 1.5,
    );
    expect(boost.boost).toBeLessThan(regular.boost);
    for (let i = 0; i < 120; i++) stepVehicle(boost, idle, 1 / 120);
    expect(boost.boost).toBeCloseTo(58, 0);
  });
  it("preserves more sideways momentum when drifting", () => {
    const grip = createVehicle(),
      drift = createVehicle();
    grip.vx = drift.vx = 40;
    for (let i = 0; i < 120; i++) {
      stepVehicle(grip, idle, 1 / 120);
      stepVehicle(drift, { ...idle, drift: true }, 1 / 120);
    }
    expect(drift.vx).toBeGreaterThan(grip.vx * 5);
  });
  it("launches from ramps and lands back on the terrain", () => {
    const v = createVehicle();
    v.vz = -60;
    let airborne = false;
    for (let i = 0; i < 360; i++) {
      stepVehicle(v, { ...idle, throttle: i < 150 ? 1 : 0 }, 1 / 120);
      airborne ||= v.airborne;
    }
    expect(airborne).toBe(true);
    for (let i = 0; i < 1200; i++) stepVehicle(v, idle, 1 / 120);
    expect(v.airborne).toBe(false);
    expect(Number.isFinite(v.y)).toBe(true);
  });
  it("jumps with an impulse and cannot jump again in midair", () => {
    const v = createVehicle();
    stepVehicle(v, { ...idle, jump: true }, 1 / 120);
    for (let i = 0; i < 35; i++) stepVehicle(v, idle, 1 / 120);
    expect(v.airborne).toBe(true);
    const vy = v.vy;
    stepVehicle(v, { ...idle, jump: true }, 1 / 120);
    expect(v.vy).toBeLessThan(vy);
  });
  it("reflects velocity at the arena boundary without escaping", () => {
    const v = createVehicle();
    v.x = WORLD_LIMIT - 1;
    v.z = WORLD_CENTER_Z;
    v.vx = 100;
    for (let i = 0; i < 60; i++) stepVehicle(v, idle, 1 / 120);
    expect(Math.hypot(v.x, v.z - WORLD_CENTER_Z)).toBeLessThanOrEqual(
      WORLD_LIMIT,
    );
    expect(v.vx).toBeLessThan(0);
  });
  it("remains finite under sustained steering and repeated arena impacts", () => {
    const v = simulate({ ...idle, throttle: 1, turn: 0.3, boost: true }, 60);
    expect(
      Object.values(v)
        .filter((x) => typeof x === "number")
        .every(Number.isFinite),
    ).toBe(true);
    expect(Math.hypot(v.x, v.z - WORLD_CENTER_Z)).toBeLessThanOrEqual(
      WORLD_LIMIT,
    );
    expect(Math.abs(v.y)).toBeLessThan(100);
  });
});
describe("swept projectile collision", () => {
  it("hits targets between frames so fast lasers do not tunnel", () =>
    expect(segmentHitsSphere(0, 0, 0, 0, 0, -100, 0, 0, -50, 3)).toBe(true));
  it("rejects targets behind and outside the flight segment", () => {
    expect(segmentHitsSphere(0, 0, 0, 0, 0, -10, 0, 0, -50, 3)).toBe(false);
    expect(segmentHitsSphere(0, 0, 0, 0, 0, -100, 10, 0, -50, 3)).toBe(false);
  });
  it("handles a stationary projectile", () => {
    expect(segmentHitsSphere(1, 2, 3, 1, 2, 3, 1, 2, 3, 1)).toBe(true);
  });
});

describe("solid hovercraft contacts", () => {
  it.each([25, 80, 150])(
    "blocks a ramp side at %i m/s without lifting onto it",
    (speed) => {
      const r = RAMPS[0],
        v = createVehicle();
      v.x = r.x - r.width / 2 - 3;
      v.z = r.z - r.length / 2 + 5;
      v.y = terrainHeight(v.x, v.z) + 1.7;
      v.vx = speed;
      const height = v.y;
      for (let i = 0; i < 15; i++)
        stepVehicle(v, { ...idle, drift: true }, 1 / 120);
      expect(v.x).toBeLessThan(r.x - r.width / 2);
      expect(v.y).toBeLessThan(height + 1);
      expect(v.vx).toBeLessThan(0);
    },
  );
  it("blocks the high rear face but permits passing above the deck", () => {
    const r = RAMPS[0],
      v = createVehicle();
    v.x = r.x;
    v.z = r.z - r.length / 2 - 1;
    v.y = terrainHeight(v.x, v.z) + 1.7;
    v.vz = 60;
    const previous = { x: v.x, y: v.y, z: v.z - 2 };
    expect(resolveWorldContacts(v, previous)).toBeGreaterThan(0);
    expect(v.vz).toBeLessThan(0);
    v.y = 30;
    v.vz = 60;
    v.z = r.z;
    resolveWorldContacts(v, { x: v.x - 20, y: 30, z: v.z });
    expect(v.vz).toBe(60);
  });
  it.each([30, 150])(
    "collides with a pillar at %i m/s and transfers impact",
    (speed) => {
      const p = PILLARS.find((p) => p.x === -38)!,
        v = createVehicle();
      v.x = p.x - p.radius - 3;
      v.z = p.z;
      v.y = terrainHeight(v.x, v.z) + 1.7;
      v.vx = speed;
      let impact = 0;
      for (let i = 0; i < 25; i++)
        impact += stepVehicle(v, { ...idle, drift: true }, 1 / 120).impact;
      expect(v.x).toBeLessThan(p.x - p.radius);
      expect(v.vx).toBeLessThan(0);
      expect(impact).toBeGreaterThan(0);
    },
  );
  it("separates overlapping enemies and exchanges momentum", () => {
    const p = createVehicle();
    p.vx = 30;
    const e = { x: 3, y: p.y + 2, z: p.z, vx: -10, vz: 0 };
    expect(separateVehicles(p, e)).toBe(40);
    expect(Math.hypot(p.x - e.x, p.z - e.z)).toBeCloseTo(5.5);
    expect(p.vx).toBeLessThan(30);
    expect(e.vx).toBeGreaterThan(-10);
  });
});
