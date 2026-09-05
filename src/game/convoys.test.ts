import { describe, expect, it } from "vitest";
import { ConvoyRoute } from "./convoys";
import { WORLDS } from "./worlds";
import { surfaceHeight } from "./physics";

describe("convoy navigation", () => {
  it.each(WORLDS)(
    "follows $name roads at constant speed and clears ramps",
    (world) => {
      const route = new ConvoyRoute(world);
      for (let distance = 0; distance < route.length; distance += 9) {
        const a = route.pose(distance),
          b = route.pose(distance + 0.25);
        expect(
          Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z),
        ).toBeCloseTo(0.25, 1);
        expect(
          a.position.y - surfaceHeight(a.position.x, a.position.z, world),
        ).toBeCloseTo(5);
        expect(route.velocity(distance, 25).length()).toBeCloseTo(25);
      }
      expect(
        route.pose(route.length).position.distanceTo(route.pose(0).position),
      ).toBeLessThan(0.001);
    },
  );
});
