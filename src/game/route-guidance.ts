import { worldRoadCurve, type WorldLayout } from "./worlds";

export interface RoutePoint {
  x: number;
  z: number;
}

/** Navigation follows the road's authored direction, including every ramp.
 * It never substitutes a straight line through a bend or a reversed jump. */
export class RouteGuidance {
  readonly road: RoutePoint[];

  constructor(private readonly world: WorldLayout) {
    this.road = worldRoadCurve(world).getSpacedPoints(1200).slice(0, -1);
  }

  private nearest(point: RoutePoint) {
    let closest = 0;
    let distance = Infinity;
    this.road.forEach((sample, index) => {
      const d = Math.hypot(sample.x - point.x, sample.z - point.z);
      if (d < distance) {
        closest = index;
        distance = d;
      }
    });
    return { index: closest, distance };
  }

  private forward(start: number, end: number) {
    const count = (end - start + this.road.length) % this.road.length;
    return Array.from(
      { length: count + 1 },
      (_, offset) => this.road[(start + offset) % this.road.length],
    );
  }

  guide(
    player: RoutePoint & { airborne?: boolean },
    waypoint: RoutePoint,
    missionGate: number,
  ) {
    const site = this.world.outposts.find((outpost) =>
      outpost.gates.some(
        (gate) => Math.hypot(gate.x - waypoint.x, gate.z - waypoint.z) < 1,
      ),
    );
    let entry = this.nearest(player);
    const destination = this.nearest(waypoint);
    const nearGate = Math.hypot(player.x - waypoint.x, player.z - waypoint.z);
    let rejoin: RoutePoint[] = [];
    // Rounding to the sample just beyond an occupied gate must not turn a
    // metre of remaining travel into a complete lap of the sector.
    if (site && nearGate <= 15) entry = destination;

    if (site && missionGate === 2) {
      const ramp = this.world.ramps.find(
        (ramp) => ramp.x === site.x && ramp.z === site.z + 121,
      );
      if (ramp) {
        const approach = { x: ramp.x, z: ramp.z + ramp.length / 2 + 35 };
        const leadIn = this.nearest(approach);
        const approachLength =
          (destination.index - leadIn.index + this.road.length) %
          this.road.length;
        const approachProgress =
          (entry.index - leadIn.index + this.road.length) % this.road.length;
        const dx = waypoint.x - ramp.x;
        const dz = waypoint.z - ramp.z;
        const progress =
          ((player.x - waypoint.x) * dx + (player.z - waypoint.z) * dz) /
          Math.hypot(dx, dz);
        const missed =
          nearGate < 120 &&
          (progress > 8 || (player.airborne === false && progress > -8));
        // A craft beside the launch lane must return to the toe, not be guided
        // laterally into the elevated deck or airborne gate.
        if (
          missed ||
          (entry.distance > 12 && approachProgress <= approachLength)
        ) {
          entry = leadIn;
          const side = player.x >= ramp.x ? 1 : -1;
          const sideX = ramp.x + side * (ramp.width / 2 + 18);
          // This dashed off-road suggestion skirts the launch lane. It is a
          // rejoin cue, not obstacle-aware pathfinding or a reversed jump.
          rejoin = [
            { x: player.x, z: player.z },
            { x: sideX, z: player.z },
            { x: sideX, z: approach.z },
            this.road[leadIn.index],
          ];
        }
      }
    }

    const route = this.forward(entry.index, destination.index);
    const remaining = site
      ? site.gates.slice(Math.max(0, missionGate) + 1)
      : [];
    const preview = remaining.length
      ? this.forward(
          destination.index,
          this.nearest(remaining[remaining.length - 1]).index,
        )
      : [];
    // Relays and reactors sit beside the road. Only their final short approach
    // leaves the authored lane; checkpoint routes remain on it.
    if (!site) route.push({ x: waypoint.x, z: waypoint.z });

    return { route, preview, remaining, rejoin };
  }
}

export function routeArrows(points: RoutePoint[], spacing = 180) {
  const arrows: { x: number; z: number; angle: number }[] = [];
  const length = points
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum + Math.hypot(point.x - points[index].x, point.z - points[index].z),
      0,
    );
  spacing = Math.max(spacing, length / 10);
  let distance = 0;
  points.slice(1).forEach((point, index) => {
    const before = points[index];
    distance += Math.hypot(point.x - before.x, point.z - before.z);
    if (distance < spacing) return;
    arrows.push({
      ...point,
      angle:
        (Math.atan2(point.x - before.x, -(point.z - before.z)) * 180) / Math.PI,
    });
    distance %= spacing;
  });
  return arrows;
}
