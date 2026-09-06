import { describe, expect, it } from "vitest";
import { RouteGuidance, routeArrows, type RoutePoint } from "./route-guidance";
import { WORLDS } from "./worlds";

const distanceTo = (route: RoutePoint[], point: RoutePoint) =>
  Math.min(
    ...route.map((sample) =>
      Math.hypot(sample.x - point.x, sample.z - point.z),
    ),
  );

describe.each(WORLDS)("$name road guidance", (world) => {
  const guidance = new RouteGuidance(world);

  it("leaves spawn in authored road order and previews the remaining gates", () => {
    const site = world.outposts[0];
    const result = guidance.guide(world.spawn, site.gates[0], 0);
    expect(distanceTo(result.route, world.spawn)).toBeLessThan(7);
    expect(distanceTo(result.route, site.gates[0])).toBeLessThan(7);
    expect(result.remaining).toEqual(site.gates.slice(1));
    expect(distanceTo(result.preview, site.gates[1])).toBeLessThan(7);
    expect(distanceTo(result.preview, site.gates[2])).toBeLessThan(7);
    result.route.slice(1).forEach((point, index) => {
      const before = guidance.road.indexOf(result.route[index]);
      expect(guidance.road.indexOf(point)).toBe(
        (before + 1) % guidance.road.length,
      );
    });
  });

  it.each(world.outposts)(
    "guides $name from gate 02 over its ramp toward the coupler",
    (site) => {
      const result = guidance.guide(site.gates[1], site.gates[2], 2);
      const ramp = world.ramps.find(
        (ramp) => ramp.x === site.x && ramp.z === site.z + 121,
      )!;
      expect(result.remaining).toEqual([]);
      expect(
        distanceTo(result.route, { x: ramp.x, z: ramp.z + ramp.length / 2 }),
      ).toBeLessThan(7);
      expect(
        distanceTo(result.route, { x: ramp.x, z: ramp.z - ramp.length / 2 }),
      ).toBeLessThan(7);
      const last = result.route.slice(-5);
      expect(last.at(-1)!.z).toBeLessThan(last[0].z);
    },
  );

  it("returns an off-road coupler approach to the ramp lead-in", () => {
    const site = world.outposts[0];
    const gate = site.gates[2];
    const result = guidance.guide({ x: gate.x + 50, z: gate.z + 30 }, gate, 2);
    const ramp = world.ramps.find(
      (ramp) => ramp.x === site.x && ramp.z === site.z + 121,
    )!;
    const approach = { x: ramp.x, z: ramp.z + ramp.length / 2 + 35 };
    expect(
      Math.hypot(
        result.route[0].x - approach.x,
        result.route[0].z - approach.z,
      ),
    ).toBeLessThan(7);
    expect(result.route[0].z).toBeGreaterThan(ramp.z + ramp.length / 2);
    expect(result.rejoin).toHaveLength(4);
    expect(Math.abs(result.rejoin[1].x - ramp.x)).toBeGreaterThan(
      ramp.width / 2,
    );
  });

  it.each([0, 1, 2])(
    "does not recommend a lap when sampling just beyond gate %i",
    (gateIndex) => {
      const gate = world.outposts[0].gates[gateIndex];
      const nearest = guidance.road.reduce(
        (best, point, index, road) =>
          Math.hypot(point.x - gate.x, point.z - gate.z) <
          Math.hypot(road[best].x - gate.x, road[best].z - gate.z)
            ? index
            : best,
        0,
      );
      const player = {
        ...guidance.road[(nearest + 1) % guidance.road.length],
        airborne: true,
      };
      expect(Math.hypot(player.x - gate.x, player.z - gate.z)).toBeLessThan(15);
      const result = guidance.guide(player, gate, gateIndex);
      expect(result.route.length).toBeLessThan(4);
      expect(result.rejoin).toEqual([]);
    },
  );

  it.each(world.outposts)(
    "returns an overshot $name coupler around the ramp instead of a lap",
    (site) => {
      const gate = site.gates[2];
      const player = { x: gate.x, z: gate.z - 45, airborne: true };
      const result = guidance.guide(player, gate, 2);
      const ramp = world.ramps.find(
        (ramp) => ramp.x === site.x && ramp.z === site.z + 121,
      )!;
      expect(result.rejoin[0]).toEqual({ x: player.x, z: player.z });
      expect(result.rejoin).toHaveLength(4);
      expect(result.rejoin[1].x).toBeGreaterThan(ramp.x + ramp.width / 2);
      expect(result.rejoin[2].z).toBeGreaterThan(ramp.z + ramp.length / 2);
      expect(result.route.length).toBeLessThan(40);
      expect(result.route[0].z).toBeGreaterThan(ramp.z + ramp.length / 2);
      expect(
        distanceTo(result.route, { x: ramp.x, z: ramp.z - ramp.length / 2 }),
      ).toBeLessThan(7);
    },
  );

  it("distinguishes a grounded missed coupler from a continuing airborne pass", () => {
    const gate = world.outposts[0].gates[2];
    const player = { x: gate.x, z: gate.z + 2, airborne: false };
    const missed = guidance.guide(player, gate, 2);
    expect(missed.rejoin).toHaveLength(4);
    expect(missed.route.length).toBeLessThan(40);
    const continuing = guidance.guide({ ...player, airborne: true }, gate, 2);
    expect(continuing.rejoin).toEqual([]);
    expect(continuing.route.length).toBeLessThan(4);
  });

  it("wraps the closed road instead of drawing a chord across the world", () => {
    const start = guidance.road.length - 3;
    const result = guidance.guide(guidance.road[start], guidance.road[2], -1);
    expect(result.route.slice(0, 6)).toEqual([
      ...guidance.road.slice(start),
      ...guidance.road.slice(0, 3),
    ]);
  });

  it("finishes the reactor route with its short off-road approach", () => {
    const result = guidance.guide(world.spawn, world.boss, -1);
    expect(result.route.at(-1)).toEqual(world.boss);
    expect(result.remaining).toEqual([]);
    expect(result.preview).toEqual([]);
  });
});

describe("route direction arrows", () => {
  it("points north and east in map coordinates", () => {
    expect(
      routeArrows([
        { x: 0, z: 0 },
        { x: 0, z: -200 },
      ])[0].angle,
    ).toBe(0);
    expect(
      routeArrows([
        { x: 0, z: 0 },
        { x: 200, z: 0 },
      ])[0].angle,
    ).toBe(90);
  });
  it("keeps a long route readable by limiting arrow density", () => {
    const arrows = routeArrows(
      Array.from({ length: 1001 }, (_, i) => ({ x: i * 10, z: 0 })),
    );
    expect(arrows.length).toBeLessThanOrEqual(10);
    expect(arrows.length).toBeGreaterThan(0);
  });
});
