import { WORLDS } from "./worlds";
import { describe, expect, it } from "vitest";
import { OUTPOSTS, compassHeading, compassTicks } from "./layout";
import { createBreaches, advanceBreaches } from "./mission";
import { createVehicle, stepVehicle, terrainHeight } from "./physics";

function crossGate(
  states: ReturnType<typeof createBreaches>,
  gateIndex: number,
  airborne = true,
  speed = 65,
) {
  const gate = OUTPOSTS[0].gates[gateIndex];
  const v = {
    ...createVehicle(),
    x: gate.x,
    y: terrainHeight(gate.x, gate.z) + gate.altitude,
    z: gate.z - 1,
    vz: -speed,
    airborne,
  };
  return advanceBreaches(states, { ...v, z: gate.z + 1 }, v, 1 / 120);
}
describe("outpost breach routes", () => {
  it("requires the gates in order and an airborne coupler pass", () => {
    const states = createBreaches();
    crossGate(states, 2);
    expect(states[0].gate).toBe(0);
    crossGate(states, 0);
    expect(states[0].remaining).toBe(14);
    crossGate(states, 2);
    expect(states[0].gate).toBe(1);
    crossGate(states, 1);
    crossGate(states, 2, false);
    expect(states[0].breached).toBe(false);
    expect(crossGate(states, 2)[0].kind).toBe("breached");
    expect(states[0].breached).toBe(true);
  });
  it("expires an unfinished link and preserves completed breaches", () => {
    const states = createBreaches();
    crossGate(states, 0);
    const v = createVehicle();
    advanceBreaches(states, v, v, 15);
    expect(states[0].gate).toBe(0);
    crossGate(states, 0);
    crossGate(states, 1);
    crossGate(states, 2);
    advanceBreaches(states, v, v, 60);
    expect(states[0].breached).toBe(true);
  });
  it.each([
    { airborne: true, speed: 24, reason: "speed" },
    { airborne: false, speed: 65, reason: "airborne" },
  ])(
    "explains a coupler miss caused by $reason without resetting the run",
    ({ airborne, speed, reason }) => {
      const states = createBreaches();
      crossGate(states, 0);
      crossGate(states, 1);
      const remaining = states[0].remaining;
      expect(crossGate(states, 2, airborne, speed)).toEqual([
        { site: 0, kind: "missed", reason },
      ]);
      expect(states[0].gate).toBe(2);
      expect(states[0].remaining).toBeCloseTo(remaining - 1 / 120);
      expect(states[0].breached).toBe(false);
    },
  );
  it("warns once inside the coupler and allows another warning after leaving", () => {
    const states = createBreaches();
    crossGate(states, 0);
    crossGate(states, 1);
    expect(crossGate(states, 2, true, 24)).toHaveLength(1);
    expect(crossGate(states, 2, true, 24)).toEqual([]);
    const gate = OUTPOSTS[0].gates[2];
    const v = {
      ...createVehicle(),
      x: gate.x,
      y: terrainHeight(gate.x, gate.z) + gate.altitude,
      z: gate.z + 20,
      vz: 24,
      airborne: true,
    };
    expect(advanceBreaches(states, { ...v, z: gate.z }, v, 1 / 120)).toEqual(
      [],
    );
    expect(crossGate(states, 2, true, 24)).toEqual([
      { site: 0, kind: "missed", reason: "speed" },
    ]);
  });
  it("accepts a valid retry even after a missed crossing", () => {
    const states = createBreaches();
    crossGate(states, 0);
    crossGate(states, 1);
    crossGate(states, 2, true, 24);
    expect(crossGate(states, 2, true, 25)).toEqual([
      { site: 0, kind: "breached" },
    ]);
    expect(states[0].missedInside).toBe(false);
  });
  it("does not report a coupler miss without a swept sphere intersection", () => {
    const states = createBreaches();
    crossGate(states, 0);
    crossGate(states, 1);
    const gate = OUTPOSTS[0].gates[2];
    const v = {
      ...createVehicle(),
      x: gate.x + 20,
      y: terrainHeight(gate.x, gate.z) + gate.altitude,
      z: gate.z - 10,
      vz: -20,
      airborne: true,
    };
    expect(
      advanceBreaches(states, { ...v, z: gate.z + 10 }, v, 1 / 120),
    ).toEqual([]);
  });
  it("clears coupler warning state when the link expires", () => {
    const states = createBreaches();
    crossGate(states, 0);
    crossGate(states, 1);
    crossGate(states, 2, true, 24);
    const v = createVehicle();
    advanceBreaches(states, v, v, 15);
    expect(states[0].missedInside).toBe(false);
    crossGate(states, 0);
    crossGate(states, 1);
    expect(crossGate(states, 2, true, 24)).toEqual([
      { site: 0, kind: "missed", reason: "speed" },
    ]);
  });
  it.each(OUTPOSTS)(
    "launches through the $name coupler using the actual ramp physics",
    (site) => {
      const v = createVehicle();
      v.x = site.x;
      v.z = site.z + 162;
      v.y = terrainHeight(v.x, v.z) + 1.7;
      v.vz = -65;
      const states = createBreaches(),
        index = OUTPOSTS.indexOf(site);
      states[index].gate = 2;
      states[index].remaining = 14;
      for (let i = 0; i < 240 && !states[index].breached; i++) {
        const prev = { ...v };
        stepVehicle(
          v,
          { throttle: 1, turn: 0, drift: false, boost: false, jump: false },
          1 / 120,
        );
        advanceBreaches(states, prev, v, 1 / 120);
      }
      expect(states[index].breached).toBe(true);
    },
  );
  it.each(
    WORLDS.flatMap((world) =>
      world.outposts.map((site) => ({
        world,
        site,
        name: `${world.name} / ${site.name}`,
      })),
    ),
  )(
    "can drive the entire $name breach route before the link expires",
    ({ world, site }) => {
      const states = createBreaches(),
        index = world.outposts.indexOf(site),
        first = site.gates[0];
      const v = createVehicle(world);
      Object.assign(v, {
        x: first.x,
        y: terrainHeight(first.x, first.z, world) + 1.7,
        z: first.z,
        vz: 0,
      });
      v.heading = Math.atan2(
        -(site.gates[1].x - v.x),
        -(site.gates[1].z - v.z),
      );
      for (let i = 0; i < 14 * 120 && !states[index].breached; i++) {
        const gate = site.gates[states[index].gate];
        const desired = Math.atan2(-(gate.x - v.x), -(gate.z - v.z));
        const angle = Math.atan2(
          Math.sin(desired - v.heading),
          Math.cos(desired - v.heading),
        );
        const speed = Math.hypot(v.vx, v.vz);
        const targetSpeed = Math.abs(angle) > 0.35 ? 32 : 65;
        const prev = { ...v };
        stepVehicle(
          v,
          {
            throttle: Math.max(-1, Math.min(1, (targetSpeed - speed) / 10)),
            turn: Math.max(-1, Math.min(1, angle * 2)),
            drift: Math.abs(angle) > 0.65 && speed > 45,
            boost: Math.abs(angle) < 0.15 && speed < 60,
            jump: false,
          },
          1 / 120,
          world,
        );
        advanceBreaches(states, prev, v, 1 / 120, world);
      }
      expect(
        states[index].breached,
        JSON.stringify({
          state: states[index],
          x: v.x - site.x,
          z: v.z - site.z,
          y: v.y,
        }),
      ).toBe(true);
    },
  );
});
describe("continuous compass", () => {
  it.each([
    [0, 0],
    [-Math.PI / 2, 90],
    [Math.PI / 2, 270],
    [Math.PI, 180],
    [-Math.PI * 2, 0],
  ])("maps heading %f to %i degrees", (heading, expected) =>
    expect(compassHeading(heading)).toBeCloseTo(expected),
  );
  it("wraps neighboring labels and moves the tape continuously", () => {
    const ticks = compassTicks((-359 * Math.PI) / 180);
    expect(ticks.find((t) => t.degrees === 0)?.offset).toBeCloseTo(3.1);
    expect(ticks.find((t) => t.degrees === 345)?.offset).toBeCloseTo(-43.4);
    for (let i = 1; i < ticks.length; i++)
      expect(ticks[i].offset - ticks[i - 1].offset).toBeCloseTo(46.5);
  });
});
