import { Vector3 } from "three";
import { WORLDS, worldRoadCurve, type WorldLayout } from "./worlds";
export { createRoadCurve } from "./layout";
import { surfaceHeight } from "./physics";

export const ROAD_HALF_WIDTH = 10;
export function roadIsJumpGap(
  x: number,
  z: number,
  world: WorldLayout = WORLDS[0],
) {
  return world.outposts.some((site, index) => {
    const ramp = world.ramps[index + 1];
    return (
      Math.abs(x - site.x) < ramp.width / 2 + 5 &&
      z < ramp.z - ramp.length / 2 &&
      z > site.z + 50
    );
  });
}
export function sampleRoad(world: WorldLayout = WORLDS[0]) {
  const curve = worldRoadCurve(world);
  // Arc-length spacing keeps the mesh regular on long connectors and tight turns.
  const count = Math.ceil(curve.getLength() / 3);
  return Array.from({ length: count + 1 }, (_, i) => {
    const p = curve.getPointAt(i / count),
      t = curve.getTangentAt(i / count);
    const normal = new Vector3(-t.z, 0, t.x);
    const left = p.clone().addScaledVector(normal, ROAD_HALF_WIDTH),
      right = p.clone().addScaledVector(normal, -ROAD_HALF_WIDTH);
    left.y = surfaceHeight(left.x, left.z, world) + 0.25;
    right.y = surfaceHeight(right.x, right.z, world) + 0.25;
    p.y = surfaceHeight(p.x, p.z, world) + 0.27;
    return { p, t, normal, left, right, gap: roadIsJumpGap(p.x, p.z, world) };
  });
}
