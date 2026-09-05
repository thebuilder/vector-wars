import * as THREE from "three";
import type { BossAttackEvent } from "./boss-attacks";

type Wave = {
  x: number;
  z: number;
  radius: number;
  hit: boolean;
  line: THREE.Mesh;
};
export class BossHazards {
  private warnings: { line: THREE.LineSegments; remaining: number }[] = [];
  private waves: Wave[] = [];
  constructor(
    private scene: THREE.Scene,
    private height: (x: number, z: number) => number,
  ) {}
  warn(event: Extract<BossAttackEvent, { kind: "warning" }>) {
    const points: number[] = [];
    const bearing = Math.atan2(
      event.targetX - event.x,
      event.targetZ - event.z,
    );
    if (event.attack === "shockwave") {
      for (let i = 0; i < 48; i++)
        for (const angle of [i, i + 1]) {
          const x = event.x + Math.sin((angle / 48) * Math.PI * 2) * 32;
          const z = event.z + Math.cos((angle / 48) * Math.PI * 2) * 32;
          points.push(x, this.height(x, z) + 1, z);
        }
    } else {
      for (const offset of event.attack === "fan"
        ? [-0.3, 0, 0.3]
        : [-0.65, 0, 0.65]) {
        const distance = Math.hypot(
          event.targetX - event.x,
          event.targetZ - event.z,
        );
        const x = event.x + Math.sin(bearing + offset) * distance,
          z = event.z + Math.cos(bearing + offset) * distance;
        points.push(
          event.x,
          this.height(event.x, event.z) + 22,
          event.z,
          x,
          this.height(event.targetX, event.targetZ) + 1.7,
          z,
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    const line = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(
          event.attack === "shockwave" ? 0xffbc57 : 0xff749c,
        ).multiplyScalar(2),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    this.scene.add(line);
    this.warnings.push({ line, remaining: event.duration });
  }
  shockwave(x: number, z: number) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(96 * 6 * 3), 3),
    );
    const line = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffd9a0).multiplyScalar(2),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    );
    line.frustumCulled = false;
    this.scene.add(line);
    this.waves.push({ x, z, radius: 25, hit: false, line });
  }
  update(dt: number, player: { x: number; y: number; z: number }) {
    let hit = false;
    for (const warning of this.warnings) warning.remaining -= dt;
    this.warnings = this.warnings.filter((w) => {
      if (w.remaining > 0) return true;
      this.remove(w.line);
      return false;
    });
    this.waves = this.waves.filter((wave) => {
      const before = wave.radius;
      wave.radius += 65 * dt;
      const distance = Math.hypot(player.x - wave.x, player.z - wave.z);
      if (
        !wave.hit &&
        distance >= before - 3 &&
        distance <= wave.radius + 3 &&
        player.y - this.height(player.x, player.z) < 5
      ) {
        wave.hit = true;
        hit = true;
      }
      const attribute = wave.line.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      for (let i = 0; i < 96; i++) {
        const corners = [
          [i, -1.2],
          [i, 1.2],
          [i + 1, -1.2],
          [i + 1, -1.2],
          [i, 1.2],
          [i + 1, 1.2],
        ];
        corners.forEach(([index, offset], j) => {
          const angle = (index / 96) * Math.PI * 2,
            x = wave.x + Math.sin(angle) * (wave.radius + offset),
            z = wave.z + Math.cos(angle) * (wave.radius + offset);
          attribute.setXYZ(i * 6 + j, x, this.height(x, z) + 1.2, z);
        });
      }
      attribute.needsUpdate = true;
      (wave.line.material as THREE.MeshBasicMaterial).opacity = Math.min(
        1,
        (250 - wave.radius) / 45,
      );
      if (wave.radius < 250) return true;
      this.remove(wave.line);
      return false;
    });
    return hit;
  }
  private remove(line: THREE.LineSegments | THREE.Mesh) {
    this.scene.remove(line);
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }
  clear() {
    for (const w of this.warnings) this.remove(w.line);
    for (const w of this.waves) this.remove(w.line);
    this.warnings = [];
    this.waves = [];
  }
}
