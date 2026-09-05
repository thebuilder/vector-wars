import * as THREE from "three";
import { terrainHeight } from "./physics";

type Fragment = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  ttl: number;
  life: number;
};
type Wave = {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
  size: number;
};
/** Bounded, physical debris survives the destroyed actor and settles on the ground. */
export class CombatEffects {
  private fragments: Fragment[] = [];
  private waves: Wave[] = [];
  private geometry = new THREE.BoxGeometry(1, 1, 1);
  private materials = [0x253e49, 0xff925a, 0x8df5d8].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        metalness: 0.6,
        roughness: 0.5,
        transparent: true,
      }),
  );
  constructor(
    private scene: THREE.Scene,
    private height: (x: number, z: number) => number = terrainHeight,
  ) {}
  burst(position: THREE.Vector3, size = 1) {
    for (
      let i = 0;
      i < Math.min(22, 8 + size * 4) && this.fragments.length < 150;
      i++
    ) {
      const mesh = new THREE.Mesh(this.geometry, this.materials[i % 3]);
      mesh.position.copy(position);
      mesh.scale.set(
        0.3 + Math.random() * size,
        0.2 + Math.random() * size,
        0.5 + Math.random() * size * 2,
      );
      this.scene.add(mesh);
      const life = 4 + Math.random() * 2;
      this.fragments.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 24,
          8 + Math.random() * 16,
          (Math.random() - 0.5) * 24,
        ).multiplyScalar(Math.sqrt(size)),
        spin: new THREE.Vector3(
          Math.random() * 6,
          Math.random() * 5,
          Math.random() * 7,
        ),
        ttl: life,
        life,
      });
    }
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffbd87,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    this.scene.add(mesh);
    this.waves.push({ mesh, age: 0, size: 15 * size });
  }
  update(dt: number) {
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const f = this.fragments[i];
      f.ttl -= dt;
      f.velocity.y -= 20 * dt;
      f.mesh.position.addScaledVector(f.velocity, dt);
      f.mesh.rotation.x += f.spin.x * dt;
      f.mesh.rotation.z += f.spin.z * dt;
      const ground = this.height(f.mesh.position.x, f.mesh.position.z) + 0.3;
      if (f.mesh.position.y < ground) {
        f.mesh.position.y = ground;
        f.velocity.y = Math.abs(f.velocity.y) * 0.3;
        f.velocity.x *= 0.93;
        f.velocity.z *= 0.93;
        f.spin.multiplyScalar(0.94);
      }
      if (f.ttl < 1) f.mesh.scale.multiplyScalar(Math.exp(-3 * dt));
      if (f.ttl <= 0) {
        this.scene.remove(f.mesh);
        this.fragments.splice(i, 1);
      }
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.age += dt;
      w.mesh.scale.setScalar(1 + w.age * w.size);
      w.mesh.material.opacity = Math.max(0, 0.7 - w.age * 0.5);
      if (w.age > 1.4) {
        this.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
        this.waves.splice(i, 1);
      }
    }
  }
  clear() {
    this.fragments.forEach((f) => this.scene.remove(f.mesh));
    this.fragments = [];
    this.waves.forEach((w) => {
      this.scene.remove(w.mesh);
      w.mesh.geometry.dispose();
      w.mesh.material.dispose();
    });
    this.waves = [];
  }
  dispose() {
    this.clear();
    this.geometry.dispose();
    this.materials.forEach((m) => m.dispose());
  }
}
