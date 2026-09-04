import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GameAudio } from "./audio";
import {
  createVehicle,
  stepVehicle,
  terrainHeight,
  segmentHitsSphere,
  type VehicleState,
} from "./physics";
import {
  createWorld,
  createShip,
  createRelay,
  createBoss,
  createDrone,
  glowTexture,
  glow,
  disposeObject,
} from "./world";
import {
  initialSnapshot,
  LEVELS,
  WEAPONS,
  type Snapshot,
  type Settings,
  type Weapon,
  type Phase,
} from "./types";

type Enemy = {
  kind: "relay" | "boss" | "drone";
  object: THREE.Group;
  hp: number;
  maxHp: number;
  radius: number;
  cooldown: number;
  home: THREE.Vector3;
  phase: number;
};
type Shot = {
  object: THREE.Mesh;
  velocity: THREE.Vector3;
  ttl: number;
  damage: number;
  hostile: boolean;
  target?: Enemy;
  mine: boolean;
  age: number;
};
type Particle = {
  object: THREE.Sprite;
  velocity: THREE.Vector3;
  ttl: number;
  life: number;
  scale: number;
};
type Pickup = { object: THREE.Group; active: boolean; cooldown: number };
const UP = new THREE.Vector3(0, 1, 0);
const RELAY_POSITIONS = [
  [
    [-95, -30],
    [105, -95],
    [-65, -195],
  ],
  [
    [-145, -100],
    [140, -15],
    [45, -225],
  ],
  [
    [-160, -130],
    [140, -130],
    [0, 5],
  ],
];
const KEY_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "KeyQ",
  "KeyE",
  "KeyJ",
  "KeyF",
  "Digit1",
  "Digit2",
  "Digit3",
  "KeyR",
]);

export class GameEngine {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1800);
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private texture = glowTexture();
  private ship = createShip(this.texture);
  private dynamic = new THREE.Group();
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private particles: Particle[] = [];
  private pickups: Pickup[] = [];
  private bossVisual?: ReturnType<typeof createBoss>;
  private player: VehicleState = createVehicle();
  private keys = new Set<string>();
  private audio = new GameAudio();
  private snapshot: Snapshot = { ...initialSnapshot };
  private settings: Settings;
  private observer: ResizeObserver;
  private frame = 0;
  private previous = 0;
  private accumulator = 0;
  private uiTime = 0;
  private time = 0;
  private fireCooldown = 0;
  private sectorStartScore = 0;
  private jumpCooldown = 0;
  private invulnerable = 0;
  private messageUntil = 0;
  private shake = 0;
  private mouseFire = false;
  private destroyed = false;
  private cameraPosition = new THREE.Vector3();
  private cameraLook = new THREE.Vector3();
  private target?: Enemy;
  private particlesGeo = new THREE.SphereGeometry(0.22, 6, 4);
  private mineGeo = new THREE.OctahedronGeometry(0.8);
  private laserGeo = new THREE.BoxGeometry(0.13, 0.13, 2.3);
  private hostileMaterial = new THREE.MeshBasicMaterial({ color: 0xff5b82 });
  private laserMaterial = new THREE.MeshBasicMaterial({ color: 0x8ffff1 });
  private missileMaterial = new THREE.MeshBasicMaterial({ color: 0xffbc57 });

  constructor(
    private host: HTMLElement,
    private onUpdate: (snapshot: Snapshot) => void,
    settings: Settings,
  ) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, settings.quality === "high" ? 1.75 : 1),
    );
    this.renderer.setClearColor(0x05090a);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D hovercraft combat arena. Controls and mission status are available in the surrounding interface.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    host.appendChild(this.renderer.domElement);
    createWorld(this.scene);
    this.scene.add(this.ship.root, this.dynamic);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.55, 0.7);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.readBest();
    this.loadLevel(0);
    this.updateSettings(settings);
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    window.addEventListener("blur", this.blur);
    document.addEventListener("visibilitychange", this.visibility);
    this.renderer.domElement.addEventListener("pointerdown", this.pointerDown);
    window.addEventListener("pointerup", this.pointerUp);
    this.renderer.domElement.addEventListener("contextmenu", this.contextMenu);
    this.frame = requestAnimationFrame(this.animate);
  }
  private readBest() {
    try {
      const v = Number(localStorage.getItem("vector-wars-best"));
      this.snapshot.best = Number.isFinite(v) ? v : 0;
    } catch {
      /* Play works without storage. */
    }
  }
  private resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }
  updateSettings(settings: Settings) {
    this.settings = settings;
    this.audio.sound = settings.sound;
    this.audio.music = settings.music;
    this.bloom.enabled = settings.effects;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, settings.quality === "high" ? 1.75 : 1),
    );
    this.resize();
  }
  private loadLevel(level: number) {
    this.sectorStartScore = this.snapshot.score;
    this.shots.forEach((s) => this.scene.remove(s.object));
    this.shots = [];
    this.particles.forEach((p) => {
      this.scene.remove(p.object);
      p.object.material.dispose();
    });
    this.particles = [];
    // Dynamic enemy materials share the global glow map, so keep that texture alive.
    this.dynamic.traverse((o) => {
      if (o instanceof THREE.Sprite) o.material.map = null;
    });
    disposeObject(this.dynamic);
    this.dynamic.clear();
    this.enemies = [];
    this.pickups = [];
    this.player = createVehicle();
    this.fireCooldown = 0;
    this.jumpCooldown = 0;
    this.invulnerable = 2;
    this.target = undefined;
    this.time = 0;
    this.snapshot = {
      ...initialSnapshot,
      level,
      score: this.snapshot.score,
      best: this.snapshot.best,
      bossMaxHealth: LEVELS[level].bossHealth,
      bossHealth: LEVELS[level].bossHealth,
      enemies: LEVELS[level].drones,
    };
    RELAY_POSITIONS[level].forEach(([x, z], i) => {
      const object = createRelay(i, this.texture);
      object.position.set(x, terrainHeight(x, z), z);
      this.dynamic.add(object);
      this.enemies.push({
        kind: "relay",
        object,
        hp: 200,
        maxHp: 200,
        radius: 6,
        cooldown: 3 + i,
        home: object.position.clone(),
        phase: i,
      });
    });
    const boss = createBoss(
      this.texture,
      new THREE.Color(LEVELS[level].color).getHex(),
    );
    this.bossVisual = boss;
    boss.group.position.set(0, 34, -185);
    this.dynamic.add(boss.group);
    this.enemies.push({
      kind: "boss",
      object: boss.group,
      hp: LEVELS[level].bossHealth,
      maxHp: LEVELS[level].bossHealth,
      radius: 14,
      cooldown: 3,
      home: boss.group.position.clone(),
      phase: 0,
    });
    for (let i = 0; i < LEVELS[level].drones; i++) {
      const home = this.enemies[i % 3].home.clone();
      const a = i * 2.4;
      const object = createDrone(this.texture);
      object.position.set(
        home.x + Math.cos(a) * 22,
        7,
        home.z + Math.sin(a) * 22,
      );
      this.dynamic.add(object);
      this.enemies.push({
        kind: "drone",
        object,
        hp: 45,
        maxHp: 45,
        radius: 3.3,
        cooldown: 2 + i * 0.3,
        home,
        phase: a,
      });
    }
    for (const [x, z] of [
      [-30, 60],
      [115, 35],
      [-150, -125],
      [60, -230],
    ]) {
      const object = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.OctahedronGeometry(2),
        new THREE.MeshBasicMaterial({ color: 0x86fadd, wireframe: true }),
      );
      object.add(box);
      for (const [w, h] of [
        [2.5, 0.65],
        [0.65, 2.5],
      ])
        object.add(
          new THREE.Mesh(
            new THREE.BoxGeometry(w, h, 0.65),
            new THREE.MeshBasicMaterial({ color: 0x86fadd }),
          ),
        );
      object.add(glow(0x86fadd, 8, this.texture));
      object.position.set(x, terrainHeight(x, z) + 3, z);
      this.dynamic.add(object);
      this.pickups.push({ object, active: true, cooldown: 0 });
    }
    this.ship.root.position.set(this.player.x, this.player.y, this.player.z);
    this.ship.root.rotation.set(0, 0, 0);
    this.cameraPosition.set(15, 10, 145);
    this.cameraLook.set(-10, 8, 70);
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraLook);
    this.emit();
  }
  start() {
    if (this.snapshot.phase === "paused") {
      this.resume();
      return;
    }
    this.keys.clear();
    this.snapshot.phase = "playing";
    this.audio.start();
    this.message("DESTROY THE 3 SHIELD RELAYS", 6);
    this.emit();
  }
  pause() {
    if (this.snapshot.phase !== "playing") return;
    this.snapshot.phase = "paused";
    this.keys.clear();
    this.mouseFire = false;
    this.audio.pause();
    this.emit();
  }
  resume() {
    if (this.snapshot.phase !== "paused") return;
    this.snapshot.phase = "playing";
    this.keys.clear();
    this.audio.start();
    this.emit();
  }
  restart() {
    this.audio.pause();
    this.snapshot.score = this.sectorStartScore;
    this.loadLevel(this.snapshot.level);
    this.start();
  }
  nextLevel() {
    if (this.snapshot.level < 2) {
      const score = this.snapshot.score;
      this.loadLevel(this.snapshot.level + 1);
      this.snapshot.score = score;
      this.start();
    } else {
      this.snapshot.phase = "complete";
      this.emit();
    }
  }
  newCampaign() {
    this.snapshot.score = 0;
    this.loadLevel(0);
    this.start();
  }
  returnToMenu() {
    this.audio.pause();
    this.snapshot.score = this.sectorStartScore;
    this.loadLevel(this.snapshot.level);
    this.snapshot.phase = "ready";
    this.emit();
  }
  setWeapon(weapon: Weapon) {
    this.snapshot.weapon = weapon;
    this.audio.effect("mine");
    this.emit();
  }
  getState(): Readonly<Snapshot> {
    return this.snapshot;
  }
  private keyDown = (event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('dialog, input, select, textarea, [role="dialog"]'))
      return;
    if (event.code === "Escape") {
      event.preventDefault();
      if (this.snapshot.phase === "playing") this.pause();
      else if (this.snapshot.phase === "paused") this.resume();
      return;
    }
    if (
      event.code === "Enter" &&
      this.snapshot.phase === "ready" &&
      !target?.closest("button")
    ) {
      event.preventDefault();
      this.start();
      return;
    }
    if (this.snapshot.phase !== "playing") return;
    if (KEY_CODES.has(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (!event.repeat) {
      if (
        (event.code === "KeyJ" || event.code === "KeyF") &&
        this.fireCooldown <= 0
      )
        this.fire(
          new THREE.Vector3(this.player.x, this.player.y, this.player.z),
        );
      if (["Digit1", "Digit2", "Digit3"].includes(event.code))
        this.setWeapon(WEAPONS[Number(event.code.slice(-1)) - 1].id);
      if (event.code === "KeyQ" || event.code === "KeyE") {
        const index = WEAPONS.findIndex((w) => w.id === this.snapshot.weapon);
        this.setWeapon(
          WEAPONS[(index + (event.code === "KeyE" ? 1 : 2)) % 3].id,
        );
      }
      if (event.code === "KeyR") {
        this.player = createVehicle();
        this.invulnerable = 3;
        this.message("VEHICLE RECOVERED", 2);
      }
    }
  };
  private keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };
  private blur = () => {
    this.keys.clear();
    this.pause();
  };
  private visibility = () => {
    if (document.hidden) this.pause();
  };
  private pointerDown = (e: PointerEvent) => {
    if (e.button === 0 && this.snapshot.phase === "playing") {
      this.mouseFire = true;
      if (this.fireCooldown <= 0)
        this.fire(
          new THREE.Vector3(this.player.x, this.player.y, this.player.z),
        );
    }
  };
  private pointerUp = () => {
    this.mouseFire = false;
  };
  private contextMenu = (e: Event) => e.preventDefault();
  private message(text: string, duration = 3) {
    this.snapshot.message = text;
    this.messageUntil = this.time + duration;
  }
  private emit() {
    this.onUpdate({ ...this.snapshot, blips: [...this.snapshot.blips] });
  }
  private animate = (now: number) => {
    if (this.destroyed) return;
    const rawDt = this.previous ? (now - this.previous) / 1000 : 1 / 60;
    const dt = Math.min(0.05, rawDt);
    this.previous = now;
    this.snapshot.fps +=
      (1 / Math.max(0.001, rawDt) - this.snapshot.fps) * 0.05;
    if (this.snapshot.phase === "playing") {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) {
        this.step(1 / 120);
        this.accumulator -= 1 / 120;
        if (this.snapshot.phase !== "playing") {
          this.accumulator = 0;
          break;
        }
      }
    } else this.accumulator = 0;
    if (this.snapshot.phase === "ready") this.time += dt;
    this.renderScene(dt);
    this.uiTime += dt;
    if (this.uiTime > 0.1) {
      this.refreshSnapshot();
      this.emit();
      this.uiTime = 0;
    }
    this.composer.render();
    this.frame = requestAnimationFrame(this.animate);
  };
  private step(dt: number) {
    this.time += dt;
    this.snapshot.elapsed += dt;
    this.fireCooldown -= dt;
    this.jumpCooldown -= dt;
    this.invulnerable -= dt;
    const keys = this.keys;
    const jump =
      (keys.has("ControlLeft") || keys.has("ControlRight")) &&
      this.jumpCooldown <= 0;
    const result = stepVehicle(
      this.player,
      {
        throttle:
          Number(keys.has("KeyW") || keys.has("ArrowUp")) -
          Number(keys.has("KeyS") || keys.has("ArrowDown")),
        turn:
          Number(keys.has("KeyA") || keys.has("ArrowLeft")) -
          Number(keys.has("KeyD") || keys.has("ArrowRight")),
        drift: keys.has("Space"),
        boost: keys.has("ShiftLeft") || keys.has("ShiftRight"),
        jump,
      },
      dt,
    );
    if (jump) {
      this.jumpCooldown = 1.1;
      this.audio.effect("jump");
    }
    if (result.landed) {
      this.shake = Math.min(0.3, Math.abs(this.player.vy) * 0.008);
      if (Math.hypot(this.player.vx, this.player.vz) > 30) {
        this.snapshot.score += 25;
        this.message("CLEAN LANDING +25", 1.5);
      }
    }
    if (result.impact > 2) this.damagePlayer(result.impact);
    this.audio.update(
      Math.hypot(this.player.vx, this.player.vz),
      result.boosting,
    );
    const playerPos = new THREE.Vector3(
      this.player.x,
      this.player.y,
      this.player.z,
    );
    this.findTarget(playerPos);
    if (
      (keys.has("KeyJ") || keys.has("KeyF") || this.mouseFire) &&
      this.fireCooldown <= 0
    )
      this.fire(playerPos);
    this.updateEnemies(dt, playerPos);
    this.updateShots(dt, playerPos);
    this.updateParticles(dt);
    this.updatePickups(dt, playerPos);
    if (this.time > this.messageUntil)
      this.snapshot.message =
        this.snapshot.relays === 3
          ? "SHIELD DOWN. FINISH THE " +
            LEVELS[this.snapshot.level].boss.replace("THE ", "") +
            "."
          : "HUNT THE RELAYS. BREAK THE SHIELD.";
  }
  private findTarget(position: THREE.Vector3) {
    const forward = new THREE.Vector3(
      -Math.sin(this.player.heading),
      0,
      -Math.cos(this.player.heading),
    );
    let best = Infinity;
    this.target = undefined;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.kind === "boss" && this.snapshot.relays < 3) continue;
      const point = this.aimPoint(enemy);
      const direction = point.sub(position);
      const distance = direction.length();
      direction.y = 0;
      direction.normalize();
      const dot = direction.dot(forward);
      if (distance < 210 && dot > 0.78) {
        const weight = distance * (2 - dot) + (enemy.kind === "drone" ? 0 : 10);
        if (weight < best) {
          best = weight;
          this.target = enemy;
        }
      }
    }
  }
  private aimPoint(enemy: Enemy): THREE.Vector3 {
    const p = enemy.object.position.clone();
    if (enemy.kind === "relay") p.y += 10;
    return p;
  }
  private fire(position: THREE.Vector3) {
    const weapon = this.snapshot.weapon;
    if (
      (weapon === "missile" && this.snapshot.missiles <= 0) ||
      (weapon === "mine" && this.snapshot.mines <= 0)
    ) {
      this.message("AMMO EMPTY. FIND A SUPPLY CACHE.", 2);
      this.fireCooldown = 0.5;
      return;
    }
    const direction = new THREE.Vector3(
      -Math.sin(this.player.heading),
      0,
      -Math.cos(this.player.heading),
    );
    if (weapon === "mine") {
      this.snapshot.mines--;
      const mine = new THREE.Mesh(this.mineGeo, this.missileMaterial);
      mine.position.copy(position).addScaledVector(direction, -3);
      mine.position.y = terrainHeight(mine.position.x, mine.position.z) + 0.6;
      this.scene.add(mine);
      this.shots.push({
        object: mine,
        velocity: new THREE.Vector3(),
        ttl: 24,
        damage: 150,
        hostile: false,
        mine: true,
        age: 0,
      });
      this.fireCooldown = 0.7;
    } else {
      if (this.target)
        direction.copy(this.aimPoint(this.target).sub(position).normalize());
      const missile = weapon === "missile";
      if (missile) this.snapshot.missiles--;
      for (const side of missile ? [0] : [-1, 1]) {
        const shot = new THREE.Mesh(
          missile ? this.particlesGeo : this.laserGeo,
          missile ? this.missileMaterial : this.laserMaterial,
        );
        shot.position.copy(position);
        shot.position.x += Math.cos(this.player.heading) * side * 1.1;
        shot.position.z -= Math.sin(this.player.heading) * side * 1.1;
        shot.position.y += 0.5;
        shot.position.addScaledVector(direction, 2.5);
        if (missile) shot.scale.set(2, 2, 4);
        shot.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          direction,
        );
        this.scene.add(shot);
        this.shots.push({
          object: shot,
          velocity: direction.clone().multiplyScalar(missile ? 95 : 250),
          ttl: missile ? 5 : 1.2,
          damage: missile ? 125 : 13,
          hostile: false,
          target: missile ? this.target : undefined,
          mine: false,
          age: 0,
        });
      }
      this.fireCooldown = missile ? 0.65 : 0.12;
    }
    this.audio.effect(weapon);
    this.shake = Math.max(this.shake, weapon === "missile" ? 0.16 : 0.025);
  }
  private updateEnemies(dt: number, player: THREE.Vector3) {
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.cooldown -= dt;
      const p = enemy.object.position;
      const distance = p.distanceTo(player);
      if (enemy.kind === "drone") {
        let destination: THREE.Vector3;
        if (distance < 140) {
          const a = this.time * 0.6 + enemy.phase;
          destination = new THREE.Vector3(
            player.x + Math.cos(a) * 19,
            player.y + 3 + Math.sin(a) * 2,
            player.z + Math.sin(a) * 19,
          );
        } else
          destination = new THREE.Vector3(
            enemy.home.x + Math.cos(this.time * 0.3 + enemy.phase) * 24,
            terrainHeight(p.x, p.z) + 7,
            enemy.home.z + Math.sin(this.time * 0.3 + enemy.phase) * 24,
          );
        const delta = destination.sub(p);
        const move = Math.min(
          delta.length(),
          (this.snapshot.level * 2 + 17) * dt,
        );
        p.addScaledVector(delta.normalize(), move);
        enemy.object.lookAt(player);
        enemy.object.rotation.z = Math.sin(this.time * 2 + enemy.phase) * 0.15;
        if (distance < 5) {
          this.damagePlayer(8);
          p.addScaledVector(p.clone().sub(player).normalize(), 5);
        }
      }
      if (enemy.kind === "boss")
        p.y = enemy.home.y + Math.sin(this.time * 0.7) * 3;
      const range =
        enemy.kind === "boss" ? 210 : enemy.kind === "relay" ? 105 : 90;
      if (enemy.cooldown <= 0 && distance < range) {
        const origin = this.aimPoint(enemy);
        const direction = player
          .clone()
          .add(
            new THREE.Vector3(
              this.player.vx,
              this.player.vy,
              this.player.vz,
            ).multiplyScalar((distance / 100) * 0.45),
          )
          .sub(origin)
          .normalize();
        const spread =
          enemy.kind === "boss" ? (this.snapshot.relays === 3 ? 5 : 3) : 1;
        for (let i = 0; i < spread; i++) {
          const d = direction
            .clone()
            .applyAxisAngle(UP, (i - (spread - 1) / 2) * 0.14);
          const object = new THREE.Mesh(
            this.particlesGeo,
            this.hostileMaterial,
          );
          object.scale.setScalar(enemy.kind === "boss" ? 3 : 1.8);
          object.position.copy(origin);
          this.scene.add(object);
          this.shots.push({
            object,
            velocity: d.multiplyScalar(enemy.kind === "boss" ? 48 : 58),
            ttl: 5,
            damage: enemy.kind === "boss" ? 10 : 5,
            hostile: true,
            mine: false,
            age: 0,
          });
        }
        enemy.cooldown =
          (enemy.kind === "boss" ? 1.6 : enemy.kind === "relay" ? 3 : 2.3) -
          this.snapshot.level * 0.2;
      }
      if (
        enemy.kind === "relay" &&
        Math.hypot(p.x - player.x, p.z - player.z) < 7 &&
        player.y < p.y + 14
      ) {
        const normal = new THREE.Vector3(
          player.x - p.x,
          0,
          player.z - p.z,
        ).normalize();
        this.player.x = p.x + normal.x * 7.2;
        this.player.z = p.z + normal.z * 7.2;
        this.player.vx += normal.x * 12;
        this.player.vz += normal.z * 12;
        this.damagePlayer(6);
      }
    }
  }
  private updateShots(dt: number, player: THREE.Vector3) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      shot.ttl -= dt;
      shot.age += dt;
      const prev = shot.object.position.clone();
      if (shot.target && shot.target.hp > 0) {
        const desired = this.aimPoint(shot.target)
          .sub(prev)
          .normalize()
          .multiplyScalar(105);
        shot.velocity.lerp(desired, 1 - Math.exp(-5 * dt));
        shot.object.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          shot.velocity.clone().normalize(),
        );
      }
      shot.object.position.addScaledVector(shot.velocity, dt);
      const p = shot.object.position;
      if (shot.mine) {
        shot.object.rotation.y += dt * 2;
        shot.object.scale.setScalar(1 + Math.sin(this.time * 8) * 0.1);
        if (
          shot.age > 0.6 &&
          this.enemies.some(
            (e) => e.hp > 0 && this.aimPoint(e).distanceTo(p) < 14,
          )
        ) {
          this.enemies.forEach((e) => {
            if (e.hp > 0 && this.aimPoint(e).distanceTo(p) < 27)
              this.damageEnemy(e, shot.damage);
          });
          this.explode(p, 0xffbc57, 24);
          shot.ttl = 0;
        }
      } else if (shot.hostile) {
        if (
          segmentHitsSphere(
            prev.x,
            prev.y,
            prev.z,
            p.x,
            p.y,
            p.z,
            player.x,
            player.y,
            player.z,
            2.1,
          )
        ) {
          this.damagePlayer(shot.damage);
          shot.ttl = 0;
        }
      } else {
        for (const enemy of this.enemies) {
          if (enemy.hp <= 0) continue;
          const c = this.aimPoint(enemy);
          if (
            segmentHitsSphere(
              prev.x,
              prev.y,
              prev.z,
              p.x,
              p.y,
              p.z,
              c.x,
              c.y,
              c.z,
              enemy.radius,
            )
          ) {
            this.damageEnemy(enemy, shot.damage);
            this.explode(
              p,
              enemy.kind === "boss" && this.snapshot.relays < 3
                ? 0x86fadd
                : 0xff5b82,
              shot.target ? 12 : 3,
            );
            shot.ttl = 0;
            break;
          }
        }
      }
      if (!shot.mine && p.y < terrainHeight(p.x, p.z)) shot.ttl = 0;
      if (shot.ttl <= 0) {
        this.scene.remove(shot.object);
        this.shots.splice(i, 1);
      }
    }
  }
  private damageEnemy(enemy: Enemy, damage: number) {
    if (enemy.hp <= 0) return;
    if (enemy.kind === "boss" && this.snapshot.relays < 3) {
      this.message("CORE SHIELDED. DESTROY THE RELAYS.", 2);
      return;
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (enemy.hp <= 0) {
      enemy.object.visible = false;
      this.explode(
        this.aimPoint(enemy),
        enemy.kind === "drone" ? 0xff5b82 : 0xffbc57,
        enemy.kind === "drone" ? 18 : 65,
      );
      this.audio.effect("explosion");
      this.shake = enemy.kind === "drone" ? 0.15 : 0.6;
      this.snapshot.score +=
        enemy.kind === "drone" ? 150 : enemy.kind === "relay" ? 1000 : 5000;
      if (enemy.kind === "relay") {
        this.snapshot.relays++;
        this.snapshot.health = Math.min(100, this.snapshot.health + 15);
        this.snapshot.missiles += 4;
        this.snapshot.mines += 2;
        this.message(
          this.snapshot.relays === 3
            ? "ALL RELAYS DOWN. CORE EXPOSED."
            : `RELAY ${this.snapshot.relays}/3 DESTROYED. AMMO REPLENISHED.`,
          4,
        );
        if (this.bossVisual)
          this.bossVisual.shield.visible = this.snapshot.relays < 3;
      }
      if (enemy.kind === "boss") {
        this.snapshot.score += Math.max(
          0,
          Math.round(3000 - this.snapshot.elapsed * 5),
        );
        this.setPhase("won");
        this.saveBest();
      }
    } else this.audio.effect("hit");
  }
  private damagePlayer(amount: number) {
    if (this.invulnerable > 0) return;
    this.snapshot.health = Math.max(0, this.snapshot.health - amount);
    this.invulnerable = 0.45;
    this.shake = 0.25;
    this.audio.effect("hit");
    if (this.snapshot.health <= 0) {
      this.explode(
        new THREE.Vector3(this.player.x, this.player.y, this.player.z),
        0xff5b82,
        60,
      );
      this.setPhase("lost");
      this.saveBest();
    }
  }
  private saveBest() {
    this.snapshot.best = Math.max(this.snapshot.best, this.snapshot.score);
    try {
      localStorage.setItem("vector-wars-best", String(this.snapshot.best));
    } catch {
      /* Optional persistence. */
    }
  }
  private setPhase(phase: Phase) {
    this.snapshot.phase = phase;
    this.keys.clear();
    this.mouseFire = false;
    this.audio.pause();
    this.emit();
  }
  private explode(position: THREE.Vector3, color: number, count: number) {
    const available = Math.max(0, 220 - this.particles.length);
    for (let i = 0; i < Math.min(count, available); i++) {
      const object = glow(color, 1 + Math.random() * 2, this.texture);
      object.position.copy(position);
      this.scene.add(object);
      const life = 0.25 + Math.random() * 0.75;
      this.particles.push({
        object,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 24,
          Math.random() * 18,
          (Math.random() - 0.5) * 24,
        ),
        ttl: life,
        life,
        scale: object.scale.x,
      });
    }
  }
  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.ttl -= dt;
      p.velocity.y -= 12 * dt;
      p.object.position.addScaledVector(p.velocity, dt);
      p.object.material.opacity = Math.max(0, p.ttl / p.life);
      p.object.scale.setScalar(p.scale * Math.max(0, p.ttl / p.life));
      if (p.ttl <= 0) {
        this.scene.remove(p.object);
        p.object.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
  private updatePickups(dt: number, position: THREE.Vector3) {
    for (const pickup of this.pickups) {
      pickup.object.rotation.y += dt;
      pickup.cooldown -= dt;
      if (!pickup.active && pickup.cooldown <= 0) {
        pickup.active = true;
        pickup.object.visible = true;
      }
      if (pickup.active && pickup.object.position.distanceTo(position) < 7) {
        this.snapshot.health = Math.min(100, this.snapshot.health + 35);
        this.snapshot.missiles = Math.min(24, this.snapshot.missiles + 6);
        this.snapshot.mines = Math.min(12, this.snapshot.mines + 3);
        this.player.boost = 100;
        pickup.active = false;
        pickup.object.visible = false;
        pickup.cooldown = 25;
        this.audio.effect("pickup");
        this.message("REPAIRED +35 / AMMO RESUPPLIED", 3);
      }
    }
  }
  private renderScene(dt: number) {
    const p = this.player,
      ready = this.snapshot.phase === "ready",
      playing = this.snapshot.phase === "playing";
    this.ship.root.position.set(
      ready ? 12 : p.x,
      (ready ? terrainHeight(12, 105) + 2 : p.y) +
        Math.sin(this.time * 4) * 0.08,
      ready ? 105 : p.z,
    );
    this.ship.root.scale.setScalar(ready ? 2.1 : 1.15);
    this.ship.root.rotation.y = ready ? -0.38 : p.heading;
    this.ship.body.rotation.z = THREE.MathUtils.lerp(
      this.ship.body.rotation.z,
      p.steer * 0.2,
      1 - Math.exp(-8 * dt),
    );
    this.ship.body.rotation.x = THREE.MathUtils.lerp(
      this.ship.body.rotation.x,
      -p.vy * 0.012,
      1 - Math.exp(-5 * dt),
    );
    this.ship.root.visible = this.snapshot.health > 0;
    this.ship.exhausts.forEach((e) => {
      const s =
        (this.keys.has("ShiftLeft") ? 3 : 1.7) + Math.sin(this.time * 40) * 0.2;
      e.scale.set(s, s, 1);
    });
    if (this.bossVisual && (playing || ready)) {
      this.bossVisual.core.rotation.y += dt * 0.17;
      this.bossVisual.cage.rotation.y -= dt * 0.035;
      this.bossVisual.group.children
        .slice(2, 5)
        .forEach((o, i) => (o.rotation.z += dt * (i % 2 ? -0.07 : 0.09)));
    }
    if (ready) {
      const desired = new THREE.Vector3(
        14 + Math.sin(this.time * 0.12) * 2,
        9.5,
        145,
      );
      this.cameraPosition.lerp(desired, 1 - Math.exp(-2 * dt));
      this.cameraLook.set(-11, 9, 65);
    } else {
      const speed = Math.hypot(p.vx, p.vz),
        forward = new THREE.Vector3(
          -Math.sin(p.heading),
          0,
          -Math.cos(p.heading),
        );
      const desired = new THREE.Vector3(p.x, p.y + 7, p.z).addScaledVector(
        forward,
        -18 - speed * 0.045,
      );
      desired.y = Math.max(
        desired.y,
        terrainHeight(desired.x, desired.z) + 3.5,
      );
      this.cameraPosition.lerp(desired, 1 - Math.exp(-5.5 * dt));
      const look = new THREE.Vector3(p.x, p.y + 0.5, p.z).addScaledVector(
        forward,
        11,
      );
      this.cameraLook.lerp(look, 1 - Math.exp(-8 * dt));
      this.camera.fov = THREE.MathUtils.lerp(
        this.camera.fov,
        62 + Math.min(12, speed * 0.09),
        1 - Math.exp(-3 * dt),
      );
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.copy(this.cameraPosition);
    if (this.settings.effects && playing) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
    }
    this.shake *= Math.exp(-8 * dt);
    this.camera.lookAt(this.cameraLook);
  }
  private refreshSnapshot() {
    const s = this.snapshot,
      p = this.player;
    s.x = p.x;
    s.z = p.z;
    s.heading = p.heading;
    s.altitude = Math.max(0, p.y - terrainHeight(p.x, p.z) - 1.7);
    s.speed = Math.round(Math.hypot(p.vx, p.vz) * 3.6);
    s.boost = p.boost;
    s.enemies = this.enemies.filter(
      (e) => e.kind === "drone" && e.hp > 0,
    ).length;
    const boss = this.enemies.find((e) => e.kind === "boss");
    s.bossHealth = boss?.hp ?? 0;
    s.bossShielded = s.relays < 3;
    s.blips = this.enemies.map((e) => ({
      x: e.object.position.x,
      z: e.object.position.z,
      kind: e.kind,
      alive: e.hp > 0,
    }));
    this.pickups.forEach((p) =>
      s.blips.push({
        x: p.object.position.x,
        z: p.object.position.z,
        kind: "repair",
        alive: p.active,
      }),
    );
    s.target = this.target?.hp
      ? this.target.kind === "boss"
        ? LEVELS[s.level].boss
        : this.target.kind === "relay"
          ? "SHIELD RELAY"
          : "INTERCEPTOR"
      : "";
    s.targetDistance = this.target
      ? Math.round(
          this.aimPoint(this.target).distanceTo(
            new THREE.Vector3(p.x, p.y, p.z),
          ),
        )
      : 0;
    s.targetHealth = this.target
      ? (this.target.hp / this.target.maxHp) * 100
      : 0;
    s.targetLocked = !!this.target && this.target.hp > 0;
  }
  dispose() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.audio.dispose();
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("pointerup", this.pointerUp);
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.pointerDown,
    );
    this.renderer.domElement.removeEventListener(
      "contextmenu",
      this.contextMenu,
    );
    disposeObject(this.scene);
    this.particlesGeo.dispose();
    this.mineGeo.dispose();
    this.laserGeo.dispose();
    this.hostileMaterial.dispose();
    this.laserMaterial.dispose();
    this.missileMaterial.dispose();
    this.texture.dispose();
    this.composer.passes.forEach((pass) => pass.dispose());
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
