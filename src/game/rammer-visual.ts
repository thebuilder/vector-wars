import * as THREE from "three";
import { glow, outlined } from "./world";

/** Amber forked hull and a terrain-following charge lane, distinct from orbiting drones. */
export function createRammer(texture: THREE.Texture) {
  const object = new THREE.Group();
  const hull = outlined(new THREE.OctahedronGeometry(2.4), 0xffbc57, 0x302017);
  hull.scale.set(1, 0.45, 1.7);
  object.add(hull);
  for (const side of [-1, 1]) {
    const tine = outlined(
      new THREE.ConeGeometry(0.75, 6, 4),
      0xffbc57,
      0x302017,
    );
    tine.rotation.x = -Math.PI / 2;
    tine.position.set(side * 2.2, 0, -1.8);
    object.add(tine);
  }
  const engine = glow(0xffbc57, 5, texture);
  engine.position.z = 3;
  object.add(engine);
  const positions = new Float32Array(20 * 2 * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const lane = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: new THREE.Color(0xffbc57).multiplyScalar(2),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  lane.frustumCulled = false;
  lane.visible = false;
  return {
    object,
    lane,
    update(
      warning: boolean,
      heading: number,
      time: number,
      height: (x: number, z: number) => number,
    ) {
      lane.visible = warning;
      engine.scale.setScalar(warning ? 7 + Math.sin(time * 18) * 2 : 5);
      if (!warning) return;
      let index = 0;
      const dx = -Math.sin(heading),
        dz = -Math.cos(heading);
      for (const side of [-1, 1]) {
        for (let segment = 0; segment < 20; segment++) {
          for (const t of [segment / 20, (segment + 1) / 20]) {
            const x = object.position.x + dx * t * 120 + dz * side * 3;
            const z = object.position.z + dz * t * 120 - dx * side * 3;
            positions[index++] = x;
            positions[index++] = height(x, z) + 0.4;
            positions[index++] = z;
          }
        }
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}
