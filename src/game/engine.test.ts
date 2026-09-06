import { BossAttackDirector } from "./boss-attacks";
import { BossHazards } from "./boss-hazards";
import { ConvoyRoute } from "./convoys";
import { EncounterDirector } from "./encounters";
import { WORLDS } from "./worlds";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GameEngine } from "./engine";
import { createVehicle, terrainHeight, surfaceHeight } from "./physics";
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
    selectedOutpost: 0,
    rammerWarningUntil: 0,
    bossAttacks: new BossAttackDirector(),
    bossHazards: new BossHazards(scene, terrainHeight),
    bossWarningUntil: 0,
    convoyRoute: new ConvoyRoute(WORLDS[0]),
    dynamic: new THREE.Group(),
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
    snapshot: { ...initialSnapshot, phase: "playing", awaitingLaunch: false },
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
    game.bossHazards.clear();
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
  function rammerEncounter() {
    const game = simulation();
    const rammer = game.spawnDrone(new THREE.Vector3(0, 0, 65), 0, false, true);
    rammer.object.position.set(0, terrainHeight(0, 65) + 2.6, 65);
    game.enemies = [rammer];
    return { game, rammer };
  }
  it("telegraphs rammers, pauses their windup, and causes physical contact damage without gunfire", () => {
    const { game, rammer } = rammerEncounter();
    advance(game, 1.6);
    expect(rammer.rammerVisual.lane.visible).toBe(true);
    expect(game.snapshot.message).toContain("RAMMER LOCKED");
    const before = rammer.object.position.clone();
    game.pause();
    advance(game, 4);
    expect(rammer.object.position.equals(before)).toBe(true);
    game.resume();
    advance(game, 2);
    expect(game.snapshot.health).toBeLessThan(100);
    expect(game.shots).toHaveLength(0);
    expect(rammer.rammerVisual.lane.visible).toBe(false);
  });
  it("lets a deployed mine stop a committed rammer before impact", () => {
    const { game, rammer } = rammerEncounter();
    advance(game, 1.6);
    game.snapshot.weapon = "mine";
    game.fire(new THREE.Vector3(game.player.x, game.player.y, game.player.z));
    advance(game, 2);
    expect(rammer.hp).toBe(0);
    expect(game.snapshot.health).toBe(100);
    expect(game.snapshot.killText).toContain("RAMMER DESTROYED");
    expect(rammer.rammerVisual.lane.visible).toBe(false);
  });
  it("removes rammer warnings immediately when the sector ends", () => {
    const { game, rammer } = rammerEncounter();
    advance(game, 1.6);
    expect(rammer.rammerVisual.lane.visible).toBe(true);
    game.beginAftermath("won");
    expect(rammer.rammerVisual.lane.visible).toBe(false);
  });
  it("lets a pillar stop and stagger a charging rammer", () => {
    const { game, rammer } = rammerEncounter();
    game.layout = {
      ...WORLDS[0],
      ramps: [],
      pillars: [{ x: 0, z: 100, radius: 5, height: 20 }],
    };
    advance(game, 3.3);
    expect(rammer.object.position.z).toBeLessThanOrEqual(92.8);
    expect(game.snapshot.health).toBe(100);
    const stopped = rammer.object.position.clone();
    advance(game, 0.4);
    expect(Math.abs(rammer.object.position.z - stopped.z)).toBeLessThan(0.01);
  });
  it("carries a rammer over a ramp from its toe without snapping sideways", () => {
    const { game, rammer } = rammerEncounter();
    game.layout = {
      ...WORLDS[0],
      pillars: [],
      ramps: [{ x: 0, z: 0, width: 42, length: 38, height: 9 }],
    };
    rammer.object.position.set(0, terrainHeight(0, 35) + 2.6, 35);
    rammer.home.set(0, 0, 35);
    Object.assign(game.player, {
      x: 0,
      z: -60,
      y: terrainHeight(0, -60) + 1.7,
    });
    const input = { active: true, x: 0, z: 35, playerX: 0, playerZ: -60 };
    rammer.rammer.update(1.4, input);
    rammer.rammer.update(1, input);
    let deckSamples = 0;
    for (let frame = 0; frame < 80; frame++) {
      game.updateEnemies(1 / 120, new THREE.Vector3(0, game.player.y, -60));
      const p = rammer.object.position;
      expect(Math.abs(p.x)).toBeLessThan(0.01);
      if (p.z < 18 && p.z > -18) {
        expect(p.y).toBeCloseTo(surfaceHeight(p.x, p.z, game.layout) + 2.6);
        deckSamples++;
      }
    }
    expect(deckSamples).toBeGreaterThan(30);
    expect(rammer.object.position.z).toBeLessThan(-19);
  });
  it("does not restore a later rammer's warning after lethal contact", () => {
    const { game, rammer } = rammerEncounter();
    const later = game.spawnDrone(new THREE.Vector3(20, 0, 65), 0, false, true);
    advance(game, 1.6);
    expect(later.rammerVisual.lane.visible).toBe(true);
    const p = rammer.object.position;
    Object.assign(game.player, { x: p.x + 1, y: p.y, z: p.z, vx: -100, vz: 0 });
    game.snapshot.health = 1;
    game.updateEnemies(
      1 / 120,
      new THREE.Vector3(game.player.x, game.player.y, game.player.z),
    );
    expect(game.snapshot.phase).toBe("aftermath");
    expect(later.rammerVisual.lane.visible).toBe(false);
  });
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
    expect(game.cameraPosition.z - game.player.z).toBeGreaterThan(12);
    expect(game.cameraPosition.z - game.player.z).toBeLessThan(13);
    game.player.vz = -100;
    for (let i = 0; i < 120; i++) game.renderScene(1 / 60);
    expect(game.cameraPosition.z - game.player.z).toBeLessThan(14.1);
    game.pause();
    const paused = game.cameraPosition.clone();
    game.renderScene(0.5);
    expect(game.cameraPosition.equals(paused)).toBe(true);
  });
  it("moves escorted transports along the road and freezes them on pause", () => {
    const game = simulation();
    game.spawnConvoy(0.12);
    const transport = game.enemies.find((e: any) => e.kind === "transport");
    const escorts = game.enemies.filter((e: any) => e.escort === transport);
    expect(escorts).toHaveLength(2);
    const before = transport.object.position.clone();
    advance(game, 1);
    expect(transport.object.position.distanceTo(before)).toBeGreaterThan(20);
    expect(escorts[0].home.distanceTo(transport.object.position)).toBeLessThan(
      0.1,
    );
    game.pause();
    const paused = transport.object.position.clone();
    advance(game, 3);
    expect(transport.object.position.equals(paused)).toBe(true);
    game.resume();
    advance(game, 1);
    expect(transport.object.position.distanceTo(paused)).toBeGreaterThan(20);
  });
  it("drops salvage on transport destruction without ending the mission or respawning its cargo", () => {
    const game = simulation();
    game.spawnConvoy(0.12);
    const transport = game.enemies.find((e: any) => e.kind === "transport");
    game.damageEnemy(transport, 1000);
    expect(transport.hp).toBe(0);
    expect(game.snapshot.phase).toBe("playing");
    expect(game.snapshot.relays).toBe(0);
    expect(game.snapshot.score).toBe(750);
    expect(transport.object.visible).toBe(true);
    const cargo = game.pickups[0];
    expect(cargo.salvage).toBe(true);
    game.snapshot.health = 40;
    game.snapshot.missiles = 0;
    game.player.boost = 0;
    game.updatePickups(1 / 120, cargo.object.position);
    expect(game.snapshot.health).toBe(75);
    expect(game.snapshot.missiles).toBe(6);
    expect(game.player.boost).toBe(100);
    expect(game.snapshot.score).toBe(1250);
    expect(game.snapshot.overdrive).toBe(30);
    game.updatePickups(60, cargo.object.position);
    expect(cargo.active).toBe(false);
    expect(game.snapshot.score).toBe(1250);
    game.damageEnemy(transport, 1000);
    expect(game.pickups).toHaveLength(1);
  });
  it("makes convoy overdrive free while boosting, freezes on pause, and expires back to normal drain", () => {
    const game = simulation();
    game.dropSalvage(
      new THREE.Vector3(game.player.x, game.player.y, game.player.z),
    );
    game.updatePickups(0, game.pickups[0].object.position);
    game.enemies = [];
    game.keys.add("KeyW");
    game.keys.add("ShiftLeft");
    advance(game, 2);
    expect(game.player.boost).toBe(100);
    expect(Math.hypot(game.player.vx, game.player.vz)).toBeGreaterThan(35);
    expect(game.snapshot.overdrive).toBeCloseTo(28);
    game.pause();
    advance(game, 10);
    expect(game.snapshot.overdrive).toBeCloseTo(28);
    game.resume();
    game.keys.add("KeyW");
    game.keys.add("ShiftLeft");
    game.snapshot.overdrive = 0.5;
    advance(game, 1);
    expect(game.snapshot.overdrive).toBe(0);
    expect(game.player.boost).toBeLessThan(90);
  });
  it("keeps ordinary supply caches distinct from convoy overdrive", () => {
    const game = simulation();
    game.pickups.push({ object: new THREE.Group(), active: true, cooldown: 0 });
    game.updatePickups(0, new THREE.Vector3());
    expect(game.player.boost).toBe(100);
    expect(game.snapshot.overdrive).toBe(0);
  });
  it("pushes the player out of a heavy transport instead of letting it overlap", () => {
    const game = simulation();
    game.spawnConvoy(0.12);
    const transport = game.enemies.find((e: any) => e.kind === "transport");
    const p = transport.object.position;
    Object.assign(game.player, { x: p.x + 3, z: p.z, y: p.y, vx: -30, vz: 0 });
    game.updateEnemies(0, p.clone());
    expect(
      Math.hypot(game.player.x - p.x, game.player.z - p.z),
    ).toBeGreaterThanOrEqual(10.99);
    expect(game.snapshot.health).toBeLessThan(100);
  });
  it("protects a stationary launch until the pilot deliberately accelerates", () => {
    const game = simulation();
    game.snapshot.awaitingLaunch = true;
    const before = { ...game.player };
    advance(game, 60);
    game.damagePlayer(50);
    expect(game.snapshot.health).toBe(100);
    expect(game.snapshot.elapsed).toBe(0);
    expect(game.player).toEqual(before);
    game.keys.add("KeyW");
    advance(game, 1);
    expect(game.snapshot.awaitingLaunch).toBe(false);
    expect(game.player.z).toBeLessThan(before.z - 10);
  });
  it("holds the selected outpost until an explicit switch, and locks switching during a breach", () => {
    const game = simulation();
    game.refreshSnapshot();
    const selected = game.snapshot.waypoint.name;
    game.player.z = -200;
    game.refreshSnapshot();
    expect(game.snapshot.waypoint.name).toBe(selected);
    game.selectNextOutpost();
    expect(game.snapshot.waypoint.name).not.toBe(selected);
    const next = game.selectedOutpost;
    game.breaches[next].gate = 1;
    game.breaches[next].remaining = 14;
    game.selectNextOutpost();
    expect(game.selectedOutpost).toBe(next);
  });
  it.each(WORLDS)(
    "points the $name launch along the outgoing road",
    (world) => {
      const game = simulation();
      game.layout = world;
      game.player = createVehicle(world);
      game.alignLaunchHeading();
      const forward = new THREE.Vector3(
        -Math.sin(game.player.heading),
        0,
        -Math.cos(game.player.heading),
      );
      const destination = new THREE.Vector3(
        world.roadNodes[1][0] - game.player.x,
        0,
        world.roadNodes[1][1] - game.player.z,
      ).normalize();
      expect(forward.dot(destination)).toBeGreaterThan(0.7);
    },
  );
  it("warns before boss fire, pauses its charge, and clears hazards on victory", () => {
    const game = simulation();
    game.snapshot.relays = 3;
    const boss = game.enemies[3];
    const player = boss.object.position
      .clone()
      .add(new THREE.Vector3(0, -20, 100));
    game.updateBossAttacks(1.8, player);
    expect(game.snapshot.bossAttack).toContain("AIM LOCKED");
    expect(game.shots).toHaveLength(0);
    game.pause();
    advance(game, 10);
    expect(game.shots).toHaveLength(0);
    game.resume();
    game.updateBossAttacks(1.2, player);
    expect(game.shots).toHaveLength(5);
    game.damageEnemy(boss, 1000);
    expect(game.snapshot.bossAttack).toBe("");
    expect(game.snapshot.phase).toBe("aftermath");
  });
  it("keeps missiles effective against armor while pulse lasers deal reduced damage", () => {
    const game = simulation(),
      boss = game.enemies[3];
    game.snapshot.relays = 3;
    boss.hp = boss.maxHp = 700;
    game.damageEnemy(boss, 100, "laser");
    expect(boss.hp).toBe(650);
    game.damageEnemy(boss, 100, "missile");
    expect(boss.hp).toBe(550);
  });
  it("pressures a stationary laser-firing pilot before the full-health Sentinel dies", () => {
    const game = simulation(),
      boss = game.enemies[3];
    game.snapshot.relays = 3;
    boss.hp = boss.maxHp = 700;
    game.enemies.slice(0, 3).forEach((e: any) => {
      e.hp = 0;
    });
    Object.assign(game.player, {
      x: boss.object.position.x,
      z: boss.object.position.z + 180,
      y:
        terrainHeight(boss.object.position.x, boss.object.position.z + 180) +
        1.7,
      heading: 0,
    });
    game.keys.add("KeyJ");
    for (
      let i = 0;
      i < 1200 && game.snapshot.health === 100 && boss.hp > 0;
      i++
    )
      game.advanceSimulation(1 / 120);
    expect(game.snapshot.health).toBeLessThan(100);
    expect(boss.hp).toBeGreaterThan(0);
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
