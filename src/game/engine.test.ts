import { EncounterDirector } from "./encounters";
import { WORLDS } from "./worlds";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GameEngine } from "./engine";
import { createVehicle, terrainHeight } from "./physics";
import { createBoss, createDrone, createRelay, disposeObject } from "./world";
import { CombatEffects } from "./effects";
import { createBreaches } from "./mission";
import { OUTPOSTS, BOSS_POSITION } from "./layout";
import { initialSnapshot } from "./types";

// Exercise real simulation methods and Three objects without a GPU/DOM constructor.
// Rendering, audio output, and DOM input are covered by the separate browser fixture.
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
});
function simulation() {
  const scene = new THREE.Scene(),
    texture = new THREE.Texture();
  const game = Object.create(GameEngine.prototype) as any;
  const boss = createBoss(texture, 0xff5b82);
  boss.group.position.set(BOSS_POSITION.x, 22, BOSS_POSITION.z);
  scene.add(boss.group);
  const enemies = OUTPOSTS.map((site, i) => {
    const object = createRelay(i, texture);
    object.position.set(site.x, terrainHeight(site.x, site.z), site.z);
    scene.add(object);
    return {
      kind: "relay",
      object,
      hp: 200,
      maxHp: 200,
      radius: 6,
      cooldown: 100,
      home: object.position.clone(),
      phase: i,
    };
  });
  enemies.push({
    kind: "boss",
    object: boss.group,
    hp: 100,
    maxHp: 100,
    radius: 14,
    cooldown: 100,
    home: boss.group.position.clone(),
    phase: 0,
  });
  Object.assign(game, {
    scene,
    layout: WORLDS[0],
    encounterDirector: new EncounterDirector([]),
    texture,
    enemies,
    bossVisual: boss,
    effects: new CombatEffects(scene),
    breaches: createBreaches(),
    gates: [],
    player: createVehicle(),
    keys: new Set(),
    audio: { effect: vi.fn(), update: vi.fn(), pause: vi.fn(), start: vi.fn() },
    snapshot: { ...initialSnapshot, phase: "playing" },
    onUpdate: vi.fn(),
    shots: [],
    particles: [],
    pickups: [],
    time: 0,
    fireCooldown: 0,
    jumpCooldown: 0,
    invulnerable: 0,
    messageUntil: 0,
    shake: 0,
    killUntil: 0,
    confirmSoundAt: 0,
    mouseFire: false,
    accumulator: 0,
    particlesGeo: new THREE.SphereGeometry(0.22, 6, 4),
    mineGeo: new THREE.OctahedronGeometry(0.8),
    laserGeo: new THREE.BoxGeometry(0.13, 0.13, 2.3),
    hostileMaterial: new THREE.MeshBasicMaterial(),
    laserMaterial: new THREE.MeshBasicMaterial(),
    missileMaterial: new THREE.MeshBasicMaterial(),
    resumePhase: "playing",
    aftermathOutcome: "won",
    meltdownBurst: false,
  });
  vi.stubGlobal("localStorage", { setItem: vi.fn() });
  cleanups.push(() => {
    game.effects.dispose();
    disposeObject(scene);
    game.particlesGeo.dispose();
    game.mineGeo.dispose();
    game.laserGeo.dispose();
    game.hostileMaterial.dispose();
    game.laserMaterial.dispose();
    game.missileMaterial.dispose();
    texture.dispose();
  });
  return game;
}
function advance(game: any, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 120); i++)
    game.advanceSimulation(1 / 120);
}

describe("combat and aftermath simulation", () => {
  it("deploys without moving or resizing the craft, then eases the camera behind it", () => {
    const game = simulation();
    game.snapshot.phase = "ready";
    Object.assign(game, {
      ship: { root: new THREE.Group(), body: new THREE.Group(), exhausts: [] },
      camera: new THREE.PerspectiveCamera(62, 1, 0.1, 4700),
      cameraPosition: new THREE.Vector3(),
      cameraLook: new THREE.Vector3(),
      deploymentPosition: new THREE.Vector3(),
      deploymentLook: new THREE.Vector3(),
      deployment: 1.6,
      settings: { effects: true },
    });
    game.renderScene(1 / 60);
    const position = game.ship.root.position.clone(),
      scale = game.ship.root.scale.clone(),
      camera = game.cameraPosition.clone();
    game.start();
    game.renderScene(0);
    expect(game.ship.root.position.distanceTo(position)).toBe(0);
    expect(game.ship.root.scale.equals(scale)).toBe(true);
    expect(game.cameraPosition.distanceTo(camera)).toBe(0);
    game.renderScene(1 / 60);
    expect(game.cameraPosition.distanceTo(camera)).toBeLessThan(0.1);
    for (let i = 0; i < 120; i++) game.renderScene(1 / 60);
    expect(Math.abs(game.cameraPosition.x - game.player.x)).toBeLessThan(0.1);
    expect(game.cameraPosition.z - game.player.z).toBeGreaterThan(17);
    game.pause();
    const paused = game.cameraPosition.clone();
    game.renderScene(0.5);
    expect(game.cameraPosition.equals(paused)).toBe(true);
  });
  it("provides live heading independently of the throttled HUD snapshot", () => {
    const game = simulation();
    game.player.heading = 1.234;
    expect(game.getHeading()).toBe(1.234);
    expect(game.snapshot.heading).toBe(0);
  });
  it.each(WORLDS)(
    "uses $name gates when advancing the real engine",
    (world) => {
      const game = simulation();
      game.layout = world;
      const gate = world.outposts[0].gates[0];
      Object.assign(game.player, {
        x: gate.x,
        z: gate.z,
        y: terrainHeight(gate.x, gate.z, world) + 1.7,
      });
      advance(game, 0.01);
      expect(game.breaches[0].gate).toBe(1);
    },
  );
  it("blocks relay damage until its own route is breached", () => {
    const game = simulation(),
      relay = game.enemies[0];
    game.damageEnemy(relay, 500);
    expect(relay.hp).toBe(200);
    game.breaches[1].breached = true;
    game.damageEnemy(relay, 500);
    expect(relay.hp).toBe(200);
    game.breaches[0].breached = true;
    game.damageEnemy(relay, 500);
    expect(relay.hp).toBe(0);
    expect(game.snapshot.relays).toBe(1);
    expect(game.snapshot.killText).toContain("RELAY DESTROYED");
    expect(relay.object.visible).toBe(true);
    advance(game, 1.6);
    expect(relay.object.visible).toBe(false);
  });
  it("keeps wreckage alive after a drone is destroyed and eventually clears it", () => {
    const game = simulation(),
      object = createDrone(game.texture);
    object.position.set(0, 8, 80);
    game.scene.add(object);
    const drone = {
      kind: "drone",
      object,
      hp: 45,
      maxHp: 45,
      radius: 3.3,
      cooldown: 100,
      home: object.position.clone(),
      phase: 0,
    };
    game.enemies.push(drone);
    game.damageEnemy(drone, 50);
    expect(drone.object.visible).toBe(true);
    expect(game.snapshot.hitConfirm).toBe(1);
    advance(game, 0.5);
    expect(drone.object.rotation.z).not.toBe(0);
    expect(game.effects.fragments.length).toBeGreaterThan(0);
    advance(game, 8);
    expect(game.effects.fragments).toHaveLength(0);
  });
  it("resolves projectile destruction of a boss without an immediate result or array mutation crash", () => {
    const game = simulation(),
      boss = game.enemies[3];
    game.snapshot.relays = 3;
    game.player.x = boss.object.position.x;
    game.player.z = boss.object.position.z + 70;
    game.player.y = 22;
    game.snapshot.weapon = "missile";
    game.target = boss;
    game.fire(new THREE.Vector3(game.player.x, game.player.y, game.player.z));
    // A second live projectile is present when the killing shot changes phase.
    game.snapshot.weapon = "laser";
    game.fire(new THREE.Vector3(game.player.x, game.player.y, game.player.z));
    advance(game, 1);
    expect(boss.hp).toBe(0);
    expect(game.snapshot.phase).toBe("aftermath");
    expect(boss.object.visible).toBe(true);
    advance(game, 3.5);
    expect(boss.object.visible).toBe(false);
    expect(game.snapshot.phase).toBe("aftermath");
    advance(game, 3.6);
    expect(game.snapshot.phase).toBe("won");
  });
  it("pauses and resumes the meltdown timer and clears throttle on pause", () => {
    const game = simulation();
    game.snapshot.relays = 3;
    game.damageEnemy(game.enemies[3], 1000);
    advance(game, 1);
    game.keys.add("KeyW");
    game.pause();
    const elapsed = game.snapshot.aftermathTime;
    advance(game, 20);
    expect(game.snapshot.aftermathTime).toBe(elapsed);
    expect(game.keys.size).toBe(0);
    game.resume();
    expect(game.snapshot.phase).toBe("aftermath");
    advance(game, 6.1);
    expect(game.snapshot.phase).toBe("won");
  });
  it("shows directional damage feedback and delays defeat long enough for wreckage", () => {
    const game = simulation();
    game.damagePlayer(25, new THREE.Vector3(10, 2, 125));
    expect(game.snapshot.hitDirection).toBeCloseTo(Math.PI / 2);
    expect(game.snapshot.hitPulse).toBe(1);
    expect(game.snapshot.health).toBe(75);
    advance(game, 0.5);
    game.damagePlayer(100);
    expect(game.snapshot.phase).toBe("aftermath");
    advance(game, 2);
    expect(game.snapshot.phase).toBe("aftermath");
    advance(game, 1.1);
    expect(game.snapshot.phase).toBe("lost");
  });
});
