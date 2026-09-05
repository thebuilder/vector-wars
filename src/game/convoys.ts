import { Vector3 } from "three";
import { worldRoadCurve, type WorldLayout } from "./worlds";
import { surfaceHeight } from "./physics";

/** Arc-length travel keeps transports at a consistent speed through corners. */
export class ConvoyRoute {
  private curve;
  readonly length;
  constructor(private world: WorldLayout) {
    this.curve = worldRoadCurve(world);
    this.length = this.curve.getLength();
  }
  pose(distance: number) {
    const t = (((distance / this.length) % 1) + 1) % 1;
    const position = this.curve.getPointAt(t);
    const tangent = this.curve.getTangentAt(t);
    position.y = surfaceHeight(position.x, position.z, this.world) + 5;
    return { position, heading: Math.atan2(-tangent.x, -tangent.z) };
  }
  velocity(distance: number, speed: number) {
    const t = (((distance / this.length) % 1) + 1) % 1;
    const tangent = this.curve.getTangentAt(t);
    return new Vector3(tangent.x * speed, 0, tangent.z * speed);
  }
}
