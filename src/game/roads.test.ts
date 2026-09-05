import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { OUTPOSTS, RAMPS, PILLARS } from "./layout";
import {
  createRoadCurve,
  sampleRoad,
  ROAD_HALF_WIDTH,
  roadIsJumpGap,
} from "./roads";
const points = createRoadCurve().getSpacedPoints(1800);
function cross(a: Vector3, b: Vector3, c: Vector3) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}
function intersects(a: Vector3, b: Vector3, c: Vector3, d: Vector3) {
  return (
    cross(a, b, c) * cross(a, b, d) < -1e-8 &&
    cross(c, d, a) * cross(c, d, b) < -1e-8
  );
}
describe("road topology", () => {
  it("passes through every checkpoint in its approach direction", () => {
    const curve = createRoadCurve();
    for (const site of OUTPOSTS)
      for (const gate of site.gates) {
        const closest = points.reduce(
          (best, p, i) =>
            p.distanceToSquared(new Vector3(gate.x, 0, gate.z)) <
            points[best].distanceToSquared(new Vector3(gate.x, 0, gate.z))
              ? i
              : best,
          0,
        );
        expect(
          points[closest].distanceTo(new Vector3(gate.x, 0, gate.z)),
        ).toBeLessThan(3);
        expect(curve.getTangentAt(closest / 1800).z).toBeLessThan(-0.25);
      }
  });
  it("has no self-intersections in the centerline or either road edge", () => {
    const samples = sampleRoad();
    for (const key of ["p", "left", "right"] as const) {
      for (let i = 0; i < samples.length - 1; i++)
        for (let j = i + 2; j < samples.length - 1; j++) {
          if (i === 0 && j === samples.length - 2) continue;
          if (
            intersects(
              samples[i][key],
              samples[i + 1][key],
              samples[j][key],
              samples[j + 1][key],
            )
          )
            throw new Error(`${key} crosses at ${i}/${j}`);
        }
    }
  });
  it("keeps opposite road edges from crossing each other", () => {
    const samples = sampleRoad();
    for (let i = 0; i < samples.length - 1; i++)
      for (let j = 0; j < samples.length - 1; j++) {
        if (
          intersects(
            samples[i].left,
            samples[i + 1].left,
            samples[j].right,
            samples[j + 1].right,
          )
        )
          throw new Error(`Road width overlaps at ${i}/${j}`);
      }
  });
  it("aligns each launch lane with its ramp and leaves a real jump gap", () => {
    OUTPOSTS.forEach((site, i) => {
      const ramp = RAMPS[i + 1];
      const approach = points.filter(
        (p) =>
          p.z > ramp.z - ramp.length / 2 &&
          p.z < ramp.z + ramp.length / 2 &&
          Math.abs(p.x - ramp.x) < 50,
      );
      expect(approach.length).toBeGreaterThan(2);
      for (const p of approach)
        expect(Math.abs(p.x - ramp.x) + ROAD_HALF_WIDTH).toBeLessThan(
          ramp.width / 2,
        );
      expect(roadIsJumpGap(site.gates[2].x, site.gates[2].z)).toBe(true);
      expect(roadIsJumpGap(site.x, site.z + 45)).toBe(false);
    });
  });
  it("does not route the driving surface through solid pillars", () => {
    for (const p of points)
      for (const pillar of PILLARS)
        if (
          Math.hypot(p.x - pillar.x, p.z - pillar.z) <=
          pillar.radius + ROAD_HALF_WIDTH
        )
          throw new Error(`Road intersects pillar ${pillar.x},${pillar.z}`);
  });
});
