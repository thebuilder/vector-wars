import { EncounterDirector } from "./encounters";
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
  separateVehicles,
  type VehicleState,
} from "./physics";
import {
  createWorld,
  createBreachGates,
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

import { WORLDS, type WorldLayout } from "./worlds";
import { createBreaches, advanceBreaches } from "./mission";
import { CombatEffects } from "./effects";

type Enemy = {
  kind: "relay" | "boss" | "drone";
  object: THREE.Group;
  hp: number;
  maxHp: number;
  radius: number;
  cooldown: number;
  home: THREE.Vector3;
  phase: number;
  velocity?: THREE.Vector3;
  arrival?: number;
  deathAge?: number;
  hitUntil?: number;
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
  private layout: WorldLayout = WORLDS[0];
  private environment?: THREE.Group;
  private effects = new CombatEffects(this.scene, (x, z) =>
    this.terrainHeight(x, z),
  );
  private encounterDirector = new EncounterDirector(WORLDS[0].encounters);
  private deployment = 1.6;
  private deploymentPosition = new THREE.Vector3();
  private deploymentLook = new THREE.Vector3();
  private terrainHeight(x: number, z: number) {
    return terrainHeight(x, z, this.layout);
  }
  private breaches = createBreaches();
  private gates: THREE.Group[][] = [];
  private resumePhase: "playing" | "aftermath" = "playing";
  private aftermathOutcome: "won" | "lost" = "won";
  private meltdownBurst = false;
  private killUntil = 0;
  private confirmSoundAt = 0;
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 4700);
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
  private player: VehicleState = createVehicle(this.layout);
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
    if (!this.environment || this.layout.id !== level) {
      if (this.environment) {
        this.scene.remove(this.environment);
        disposeObject(this.environment);
      }
      this.layout = WORLDS[level];
      this.environment = createWorld(this.scene, this.layout);
    }
    this.encounterDirector = new EncounterDirector(this.layout.encounters);
    this.sectorStartScore = this.snapshot.score;
    this.effects.clear();
    this.breaches = createBreaches();
    this.meltdownBurst = false;
    this.resumePhase = "playing";
    this.shake = 0;
    this.killUntil = 0;
    this.messageUntil = 0;
    this.confirmSoundAt = 0;
    this.shots.forEach((s) => this.scene.remove(s.object));
    this.shots = [];
    this.particles.forEach((p) => {
      this.scene.remove(p.object);
      p.object.material.dispose();
    });
    this.particles = [];
    // Dynamic enemy materials share the global glow map, so keep that texture alive.
    this.dynamic.traverse((o) => {
      if (o instanceof THREE.Sprite && o.material.map === this.texture)
        o.material.map = null;
    });
    disposeObject(this.dynamic);
    this.dynamic.clear();
    this.enemies = [];
    this.pickups = [];
    this.player = createVehicle(this.layout);
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
    this.gates = createBreachGates(this.layout);
    this.gates.flat().forEach((g) => this.dynamic.add(g));
    this.layout.outposts.forEach(({ x, z }, i) => {
      const object = createRelay(i, this.texture);
      object.position.set(x, this.terrainHeight(x, z), z);
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
    boss.group.position.set(
      this.layout.boss.x,
      this.terrainHeight(this.layout.boss.x, this.layout.boss.z) + 22,
      this.layout.boss.z,
    );
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
      this.spawnDrone(home, i * 2.4, false);
    }
    for (const [x, z] of this.layout.supplies) {
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
      object.position.set(x, this.terrainHeight(x, z) + 3, z);
      this.dynamic.add(object);
      this.pickups.push({ object, active: true, cooldown: 0 });
    }
    this.updateGates();
    this.ship.root.position.set(this.player.x, this.player.y, this.player.z);
    this.ship.root.rotation.set(0, 0, 0);
    const p = this.player;
    this.cameraPosition.set(p.x + 9, p.y + 4, p.z + 13);
    this.cameraLook.set(p.x - 5, p.y + 1, p.z - 3);
    this.deployment = 1.6;
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraLook);
    this.emit();
  }
  private spawnDrone(home: THREE.Vector3, angle: number, arriving: boolean) {
    const object = createDrone(this.texture);
    object.position.set(
      home.x + Math.cos(angle) * 35,
      0,
      home.z + Math.sin(angle) * 35,
    );
    // Patrols arrive beside the route, outside the craft's collision envelope.
    if (
      Math.hypot(
        object.position.x - this.player.x,
        object.position.z - this.player.z,
      ) < 32
    )
      object.position.x = this.player.x + 45;
    object.position.y =
      this.terrainHeight(object.position.x, object.position.z) +
      4 +
      (arriving ? 24 : 0);
    this.dynamic.add(object);
    this.enemies.push({
      kind: "drone",
      object,
      hp: 45,
      maxHp: 45,
      radius: 3.3,
      cooldown: 2,
      home: home.clone(),
      phase: angle,
      arrival: arriving ? 1.2 : 0,
    });
    if (arriving) this.explode(object.position, 0x9bddff, 8);
  }
  private updateEncounters(dt: number, player: THREE.Vector3) {
    const nearby = this.enemies.filter(
      (e) =>
        e.kind === "drone" &&
        e.hp > 0 &&
        e.object.position.distanceTo(player) < 180,
    ).length;
    const event = this.encounterDirector.update(player.x, player.z, nearby, dt);
    if (!event) return;
    if (event.kind === "warning") {
      this.message("PATROL INBOUND · KEEP MOVING", 2.5);
      this.audio.effect("alarm");
      return;
    }
    const region = this.layout.encounters[event.index],
      home = new THREE.Vector3(
        region.x,
        this.terrainHeight(region.x, region.z),
        region.z,
      );
    for (let i = 0; i < region.count; i++)
      this.spawnDrone(
        home,
        (i * Math.PI * 2) / region.count + event.index,
        true,
      );
  }
  start() {
    if (this.snapshot.phase === "paused") {
      this.resume();
      return;
    }
    this.deployment = 0;
    this.deploymentPosition.copy(this.cameraPosition);
    this.deploymentLook.copy(this.cameraLook);
    this.keys.clear();
    this.snapshot.phase = "playing";
    this.audio.start();
    this.message("WASD DRIVE · SHIFT BOOST · SPACE DRIFT · J FIRE · M MAP", 8);
    this.emit();
  }
  pause() {
    if (
      this.snapshot.phase !== "playing" &&
      this.snapshot.phase !== "aftermath"
    )
      return;
    this.resumePhase = this.snapshot.phase;
    this.snapshot.phase = "paused";
    this.keys.clear();
    this.mouseFire = false;
    this.audio.pause();
    this.emit();
  }
  resume() {
    if (this.snapshot.phase !== "paused") return;
    this.snapshot.phase = this.resumePhase;
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
  getHeading() {
    return this.player.heading;
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
      if (
        this.snapshot.phase === "playing" ||
        this.snapshot.phase === "aftermath"
      )
        this.pause();
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
    if (
      this.snapshot.phase !== "playing" &&
      this.snapshot.phase !== "aftermath"
    )
      return;
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
        this.player = createVehicle(this.layout);
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
    this.advanceSimulation(dt);
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
  private advanceSimulation(dt: number) {
    if (
      this.snapshot.phase === "playing" ||
      this.snapshot.phase === "aftermath"
    ) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) {
        this.step(1 / 120);
        this.accumulator -= 1 / 120;
        if (
          this.snapshot.phase !== "playing" &&
          this.snapshot.phase !== "aftermath"
        ) {
          this.accumulator = 0;
          break;
        }
      }
    } else this.accumulator = 0;
  }
  private step(dt: number) {
    this.time += dt;
    if (this.snapshot.phase === "playing") this.snapshot.elapsed += dt;
    this.snapshot.hitPulse = Math.max(0, this.snapshot.hitPulse - dt * 1.8);
    this.snapshot.hitConfirm = Math.max(0, this.snapshot.hitConfirm - dt * 3);
    if (this.time > this.killUntil) this.snapshot.killText = "";
    const previousPosition = {
      x: this.player.x,
      y: this.player.y,
      z: this.player.z,
    };
    const wasAirborne = this.player.airborne;
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
      this.layout,
    );
    if (jump && !wasAirborne) {
      this.jumpCooldown = 1.1;
      this.audio.effect("jump");
    }
    if (result.landed) {
      this.shake = 0.18;
      this.audio.effect("hit");
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
    this.effects.update(dt);
    this.updateWrecks(dt);
    if (this.snapshot.phase === "aftermath") {
      this.updateAftermath(dt);
      this.updateParticles(dt);
      return;
    }
    for (const event of advanceBreaches(
      this.breaches,
      previousPosition,
      this.player,
      dt,
      this.layout,
    )) {
      const name = this.layout.outposts[event.site].name;
      if (event.kind === "breached") {
        this.snapshot.score += 500;
        this.player.boost = 100;
        this.audio.effect("breach");
        this.message(`${name} SHIELD BREACHED +500. DESTROY THE RELAY.`, 5);
        this.effects.burst(playerPos, 1);
      } else if (event.kind === "expired")
        this.message(`${name}: LINK EXPIRED. RETURN TO GATE 01.`, 4);
      else {
        this.audio.effect("pickup");
        this.message(
          event.kind === "started"
            ? `${name}: 14 SECONDS. FOLLOW 02, THEN JUMP THE COUPLER.`
            : "FINAL GATE: TAKE THE RAMP. KEEP YOUR SPEED ABOVE 90 KM/H.",
          4,
        );
      }
    }
    this.updateGates();
    this.findTarget(playerPos);
    if (
      (keys.has("KeyJ") || keys.has("KeyF") || this.mouseFire) &&
      this.fireCooldown <= 0
    )
      this.fire(playerPos);
    this.updateEncounters(dt, playerPos);
    this.updateEnemies(dt, playerPos);
    this.updateShots(dt, playerPos);
    this.updateParticles(dt);
    this.updatePickups(dt, playerPos);
    if (this.time > this.messageUntil) this.snapshot.message = "";
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
      if (this.isShielded(enemy)) continue;
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
    if (enemy.kind === "relay") p.y += 14;
    return p;
  }
  private fire(position: THREE.Vector3) {
    if (this.snapshot.phase !== "playing") return;
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
      mine.position.y =
        this.terrainHeight(mine.position.x, mine.position.z) + 0.6;
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
      if ((enemy.arrival ?? 0) > 0) {
        enemy.arrival = Math.max(0, enemy.arrival! - dt);
        enemy.object.position.y =
          this.terrainHeight(enemy.object.position.x, enemy.object.position.z) +
          4 +
          enemy.arrival * 20;
        continue;
      }
      enemy.cooldown -= dt;
      const p = enemy.object.position;
      const distance = p.distanceTo(player);
      if (enemy.kind === "drone") {
        const engaged = distance < 165 && enemy.home.distanceTo(player) < 240;
        const a = this.time * 0.42 + enemy.phase;
        const center = engaged ? player : enemy.home;
        const destination = new THREE.Vector3(
          center.x + Math.cos(a) * (engaged ? 27 : 36),
          0,
          center.z + Math.sin(a) * (engaged ? 27 : 36),
        );
        destination.y =
          this.terrainHeight(destination.x, destination.z) +
          3.4 +
          Math.sin(a) * 0.6;
        const velocity = (enemy.velocity ??= new THREE.Vector3());
        const desired = destination.sub(p);
        const remaining = desired.length();
        desired
          .normalize()
          .multiplyScalar(
            Math.min(
              remaining * 2,
              engaged ? 35 + this.snapshot.level * 3 : 15,
            ),
          );
        velocity.lerp(desired, 1 - Math.exp(-2.4 * dt));
        p.addScaledVector(velocity, dt);
        const body = { x: p.x, y: p.y, z: p.z, vx: velocity.x, vz: velocity.z };
        const contact = separateVehicles(this.player, body, 6);
        p.x = body.x;
        p.z = body.z;
        velocity.x = body.vx;
        velocity.z = body.vz;
        if (contact > 8) {
          this.damagePlayer(Math.min(18, contact * 0.25), p);
          this.explode(p, 0xffbd87, 8);
        }
        enemy.object.lookAt(player);
        enemy.object.rotation.z = Math.sin(this.time * 2 + enemy.phase) * 0.15;
      }
      if (enemy.kind === "boss")
        p.y = enemy.home.y + Math.sin(this.time * 0.7) * 0.6;
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
      if (enemy.kind !== "drone") {
        const radius = enemy.kind === "relay" ? 8 : 29;
        const dx = this.player.x - p.x,
          dz = this.player.z - p.z,
          d = Math.hypot(dx, dz);
        if (
          d < radius &&
          this.player.y < p.y + (enemy.kind === "relay" ? 20 : 8)
        ) {
          const nx = d > 0.001 ? dx / d : 1,
            nz = d > 0.001 ? dz / d : 0;
          this.player.x = p.x + nx * radius;
          this.player.z = p.z + nz * radius;
          const closing = this.player.vx * nx + this.player.vz * nz;
          if (closing < 0) {
            this.player.vx -= nx * closing * 1.3;
            this.player.vz -= nz * closing * 1.3;
            this.damagePlayer(Math.max(2, -closing * 0.25), p);
          }
        }
      }
    }
  }
  private updateShots(dt: number, player: THREE.Vector3) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      if (this.snapshot.phase !== "playing") break;
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
      if (
        !shot.mine &&
        (shot.target || shot.hostile) &&
        Math.floor(shot.age * 20) !== Math.floor((shot.age - dt) * 20)
      )
        this.explode(p, shot.hostile ? 0xff5b82 : 0xffbc57, 1);
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
          this.damagePlayer(shot.damage, prev);
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
      if (!shot.mine && p.y < this.terrainHeight(p.x, p.z)) shot.ttl = 0;
      if (shot.ttl <= 0) {
        this.scene.remove(shot.object);
        this.shots.splice(i, 1);
      }
    }
  }
  private isShielded(enemy: Enemy) {
    return enemy.kind === "boss"
      ? this.snapshot.relays < 3
      : enemy.kind === "relay"
        ? !this.breaches[enemy.phase].breached
        : false;
  }
  private damageEnemy(enemy: Enemy, damage: number) {
    if (enemy.hp <= 0) return;
    if (this.isShielded(enemy)) {
      this.message(
        enemy.kind === "boss"
          ? "CORE SHIELDED. DESTROY THE THREE RELAYS."
          : `${this.layout.outposts[enemy.phase].name}: RUN THE AMBER GATES TO BREAK THIS SHIELD.`,
        2,
      );
      this.explode(this.aimPoint(enemy), 0x86fadd, 5);
      return;
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitUntil = this.time + 0.14;
    this.snapshot.hitConfirm = 1;
    if (this.time > this.confirmSoundAt) {
      this.audio.effect("confirm");
      this.confirmSoundAt = this.time + 0.1;
    }
    if (enemy.hp > 0) return;
    enemy.deathAge = 0;
    this.snapshot.score +=
      enemy.kind === "drone" ? 150 : enemy.kind === "relay" ? 1000 : 5000;
    this.snapshot.killText =
      enemy.kind === "drone"
        ? "INTERCEPTOR DESTROYED +150"
        : enemy.kind === "relay"
          ? "RELAY DESTROYED +1000"
          : "REACTOR CRITICAL +5000";
    this.killUntil = this.time + 2.5;
    this.audio.effect("explosion");
    this.shake = enemy.kind === "drone" ? 0.25 : 0.65;
    this.explode(
      this.aimPoint(enemy),
      0xffbd87,
      enemy.kind === "drone" ? 24 : 60,
    );
    this.effects.burst(this.aimPoint(enemy), enemy.kind === "drone" ? 1 : 3);
    if (enemy.kind === "relay") {
      this.snapshot.relays++;
      this.snapshot.health = Math.min(100, this.snapshot.health + 15);
      this.snapshot.missiles += 4;
      this.snapshot.mines += 2;
      this.message(
        this.snapshot.relays === 3
          ? "ALL OUTPOSTS SILENCED. REACTOR EXPOSED."
          : `${this.layout.outposts[enemy.phase].name} CLEARED. REPAIRED AND RESUPPLIED.`,
        5,
      );
      if (this.bossVisual)
        this.bossVisual.shield.visible = this.snapshot.relays < 3;
    }
    if (enemy.kind === "boss") {
      this.snapshot.score += Math.max(
        0,
        Math.round(3000 - this.snapshot.elapsed * 5),
      );
      this.beginAftermath("won");
      this.message("REACTOR CRITICAL. KEEP MOVING — MELTDOWN IN PROGRESS.", 8);
    }
  }
  private damagePlayer(amount: number, source?: THREE.Vector3) {
    if (this.invulnerable > 0 || this.snapshot.phase !== "playing") return;
    this.snapshot.health = Math.max(0, this.snapshot.health - amount);
    this.invulnerable = 0.45;
    this.snapshot.hitPulse = 1;
    if (source)
      this.snapshot.hitDirection =
        Math.atan2(source.x - this.player.x, -(source.z - this.player.z)) +
        this.player.heading;
    this.shake = 0.5;
    this.audio.effect("hit");
    this.explode(
      new THREE.Vector3(this.player.x, this.player.y, this.player.z),
      0xffa97f,
      9,
    );
    if (this.snapshot.health <= 0) {
      this.effects.burst(
        new THREE.Vector3(this.player.x, this.player.y, this.player.z),
        2,
      );
      this.beginAftermath("lost");
      this.message("HULL BREACH. SIGNAL LOST.", 4);
    }
  }
  private beginAftermath(outcome: "won" | "lost") {
    this.aftermathOutcome = outcome;
    this.snapshot.aftermathTime = 0;
    this.snapshot.phase = "aftermath";
    this.mouseFire = false;
    this.emit();
  }
  private updateAftermath(dt: number) {
    this.shots.forEach((s) => this.scene.remove(s.object));
    this.shots = [];
    const before = this.snapshot.aftermathTime;
    this.snapshot.aftermathTime += dt;
    const time = this.snapshot.aftermathTime;
    const boss = this.enemies.find((e) => e.kind === "boss");
    if (this.aftermathOutcome === "won" && boss) {
      if (time < 3.5 && Math.floor(time * 4) !== Math.floor(before * 4)) {
        const p = boss.object.position
          .clone()
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 30,
              Math.random() * 16,
              (Math.random() - 0.5) * 24,
            ),
          );
        this.explode(p, 0xffcf8a, 20);
        this.effects.burst(p, 0.6);
        this.shake = 0.35;
        this.audio.effect("alarm");
      }
      if (time >= 3.5 && !this.meltdownBurst) {
        this.meltdownBurst = true;
        boss.object.visible = false;
        this.effects.burst(boss.object.position, 7);
        this.explode(boss.object.position, 0xfff1bf, 110);
        this.shake = 1.4;
        this.audio.effect("explosion");
        this.message("SIGNAL TERMINATED. SECTOR SECURED.", 4);
      }
    }
    if (time >= (this.aftermathOutcome === "won" ? 7 : 3)) {
      this.setPhase(this.aftermathOutcome);
      this.saveBest();
    }
  }
  private updateWrecks(dt: number) {
    for (const enemy of this.enemies) {
      if (enemy.hitUntil !== undefined) {
        const flashing = enemy.hitUntil > this.time;
        enemy.object.traverse((o) => {
          if (
            o instanceof THREE.Mesh &&
            o.material instanceof THREE.MeshStandardMaterial
          ) {
            const m = o.material;
            if (m.userData.originalEmission === undefined) {
              m.userData.originalEmission = m.emissiveIntensity;
              m.userData.originalColor = m.emissive.getHex();
            }
            m.emissiveIntensity = flashing ? 2 : m.userData.originalEmission;
            m.emissive.setHex(flashing ? 0xffa377 : m.userData.originalColor);
          }
        });
        if (!flashing) enemy.hitUntil = undefined;
      }
      if (enemy.deathAge === undefined || !enemy.object.visible) continue;
      enemy.deathAge += dt;
      if (enemy.kind === "boss") {
        enemy.object.rotation.z =
          Math.sin(enemy.deathAge * 14) * 0.018 * enemy.deathAge;
        continue;
      }
      enemy.object.position.y -= enemy.deathAge * 12 * dt;
      enemy.object.rotation.z += dt * (enemy.kind === "drone" ? 3 : 0.6);
      enemy.object.rotation.x += dt * 0.6;
      if (
        Math.floor(enemy.deathAge * 15) !==
        Math.floor((enemy.deathAge - dt) * 15)
      )
        this.explode(enemy.object.position, 0xff9055, 2);
      if (
        enemy.deathAge > 1.5 ||
        enemy.object.position.y <
          this.terrainHeight(enemy.object.position.x, enemy.object.position.z)
      ) {
        this.effects.burst(
          enemy.object.position,
          enemy.kind === "drone" ? 1 : 2,
        );
        enemy.object.visible = false;
      }
    }
  }
  private updateGates() {
    this.gates.forEach((gates, index) =>
      gates.forEach((g, i) => {
        const state = this.breaches[index];
        g.visible = !state.breached && i >= state.gate;
        const material = (
          g.children[0] as THREE.Mesh<
            THREE.TorusGeometry,
            THREE.MeshBasicMaterial
          >
        ).material;
        material.color.setHex(i === state.gate ? 0xffbc57 : 0x5c6767);
        g.scale.setScalar(
          i === state.gate ? 1 + Math.sin(this.time * 3) * 0.025 : 1,
        );
      }),
    );
    this.enemies
      .filter((e) => e.kind === "relay")
      .forEach((e) => {
        const shield = e.object.getObjectByName("relay-shield");
        if (shield)
          shield.visible = !this.breaches[e.phase].breached && e.hp > 0;
      });
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
      playing =
        this.snapshot.phase === "playing" ||
        this.snapshot.phase === "aftermath";
    this.ship.root.position.set(p.x, p.y + Math.sin(this.time * 4) * 0.08, p.z);
    this.ship.root.scale.setScalar(1.15);
    this.ship.root.rotation.y = p.heading;
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
    }
    if (ready) {
      this.cameraPosition.set(p.x + 9, p.y + 4, p.z + 13);
      this.cameraLook.set(p.x - 5, p.y + 1, p.z - 3);
    } else if (playing) {
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
        this.terrainHeight(desired.x, desired.z) + 3.5,
      );

      const look = new THREE.Vector3(p.x, p.y + 0.5, p.z).addScaledVector(
        forward,
        11,
      );
      const duration = this.settings.effects ? 1.6 : 0.2;
      this.deployment = Math.min(duration, this.deployment + dt);
      if (this.deployment < duration) {
        const t = this.deployment / duration,
          ease = t * t * (3 - 2 * t);
        this.cameraPosition.lerpVectors(this.deploymentPosition, desired, ease);
        this.cameraLook.lerpVectors(this.deploymentLook, look, ease);
      } else {
        this.cameraPosition.lerp(desired, 1 - Math.exp(-5.5 * dt));
        this.cameraLook.lerp(look, 1 - Math.exp(-8 * dt));
      }
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
    s.altitude = Math.max(0, p.y - this.terrainHeight(p.x, p.z) - 1.7);
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
    s.breached = this.breaches.filter((b) => b.breached).length;
    const active = this.breaches.findIndex((b) => b.gate > 0 && !b.breached);
    const candidates = this.layout.outposts
      .map((site, index) => ({
        site,
        index,
        distance: Math.hypot(site.x - p.x, site.z - p.z),
      }))
      .filter(({ index }) => this.enemies[index].hp > 0)
      .sort((a, b) => a.distance - b.distance);
    const chosen = active >= 0 ? active : candidates[0]?.index;
    let waypoint;
    s.breachTime = active >= 0 ? this.breaches[active].remaining : 0;
    s.breachGate = active >= 0 ? this.breaches[active].gate : 0;
    if (chosen !== undefined) {
      const site = this.layout.outposts[chosen],
        breach = this.breaches[chosen];
      const goal = breach.breached
        ? { x: site.x, z: site.z, altitude: 17 }
        : site.gates[breach.gate];
      waypoint = {
        name: site.name,
        detail: breach.breached
          ? "DESTROY EXPOSED RELAY"
          : breach.gate === 2
            ? "JUMP THE COUPLER · 90+ KM/H"
            : `PASS GATE 0${breach.gate + 1}`,
        x: goal.x,
        y: this.terrainHeight(goal.x, goal.z) + goal.altitude,
        z: goal.z,
        distance: 0,
      };
      if (!breach.breached)
        s.blips.push({ x: goal.x, z: goal.z, kind: "gate", alive: true });
    } else
      waypoint = {
        name: LEVELS[s.level].boss,
        detail: "REACTOR EXPOSED",
        x: this.layout.boss.x,
        y: 22,
        z: this.layout.boss.z,
        distance: 0,
      };
    waypoint.distance = Math.round(
      Math.hypot(waypoint.x - p.x, waypoint.z - p.z),
    );
    s.waypoint = waypoint;
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
    this.effects.dispose();
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
