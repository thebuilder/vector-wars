import * as THREE from "three";
import { glow, outlined } from "./world";

/** Broad cargo hull, exposed containers, and four suspended ion nacelles. */
export function createTransport(texture: THREE.Texture) {
  const root = new THREE.Group();
  const hull = outlined(new THREE.BoxGeometry(7, 2, 15), 0x9bddff, 0x132634);
  root.add(hull);
  const cockpit = outlined(
    new THREE.CylinderGeometry(2.2, 3.8, 5, 4),
    0x9bddff,
    0x1c4050,
  );
  cockpit.rotation.x = Math.PI / 2;
  cockpit.position.set(0, 0.3, -8);
  root.add(cockpit);
  for (const z of [-3.5, 2]) {
    const cargo = outlined(
      new THREE.BoxGeometry(5.4, 3, 4),
      0xffbc57,
      0x342b20,
    );
    cargo.position.set(0, 2, z);
    root.add(cargo);
  }
  for (const x of [-5.4, 5.4]) {
    for (const z of [-5, 5]) {
      const strut = outlined(new THREE.BoxGeometry(5, 0.5, 1), 0x659ea5);
      strut.position.set(x * 0.6, -0.5, z);
      root.add(strut);
      const engine = outlined(
        new THREE.CylinderGeometry(1.2, 0.8, 3.6, 6),
        0x9bddff,
        0x112930,
      );
      engine.rotation.x = Math.PI / 2;
      engine.position.set(x, -0.3, z);
      root.add(engine);
      const exhaust = glow(0x68d9ff, 4, texture);
      exhaust.position.set(x, -0.3, z + 2);
      root.add(exhaust);
    }
  }
  return root;
}
