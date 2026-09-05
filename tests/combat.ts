import { EncounterDirector } from "../src/game/encounters";
/** Browser integration fixture, excluded from the production build.
 * Exercises the actual WebGL engine with fixed simulation steps and controlled spawn poses.
 * Private access is confined to this fixture; the game exposes no cheats or debug globals.
 */
import { GameEngine } from "../src/game/engine";
import { BOSS_POSITION } from "../src/game/layout";
import { terrainHeight } from "../src/game/physics";
import * as THREE from "three";
const output = document.querySelector("#results")!;
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  output.textContent += "\nPASS " + message;
};
let engine: GameEngine | undefined;
const originalBest = localStorage.getItem("vector-wars-best");
document.querySelector("#run")!.addEventListener("click", () => {
  engine?.dispose();
  output.textContent = "Running actual engine with deterministic steps…";
  try {
    engine = new GameEngine(document.querySelector("#stage")!, () => {}, {
      sound: false,
      music: false,
      effects: false,
      quality: "balanced",
    });
    // Read/write internal simulation state only in this standalone test fixture.
    const game = engine as any;
    cancelAnimationFrame(game.frame);
    const tick = (seconds: number) => {
      for (let i = 0; i < seconds * 120; i++) game.advanceSimulation(1 / 120);
      game.refreshSnapshot();
    };
    const pose = (x: number, z: number, y?: number) => {
      Object.assign(game.player, {
        x,
        z,
        y: y ?? terrainHeight(x, z, game.layout) + 1.7,
        vx: 0,
        vy: 0,
        vz: 0,
        heading: 0,
        steer: 0,
        airborne: false,
      });
      game.invulnerable = 0;
    };
    const fireAt = (enemy: any, weapon = "laser") => {
      const target = game.aimPoint(enemy);
      pose(target.x, target.z + 70);
      game.player.heading = 0;
      game.snapshot.weapon = weapon;
      game.keys.add("KeyJ");
      let attempts = 0;
      while (enemy.hp > 0 && attempts++ < 2400) {
        game.snapshot.health = 100;
        game.invulnerable = 1;
        game.step(1 / 120);
      }
      game.keys.clear();
      game.refreshSnapshot();
      assert(
        enemy.hp === 0,
        `${weapon} destroys ${enemy.kind} through projectile collision`,
      );
    };
    engine.start();
    const press = (code: string) =>
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { code, bubbles: true }),
      );
    const release = (code: string) =>
      document.body.dispatchEvent(
        new KeyboardEvent("keyup", { code, bubbles: true }),
      );
    press("KeyW");
    tick(1);
    release("KeyW");
    assert(game.player.z < 115, "Native W key accelerates the vehicle");
    press("KeyA");
    tick(0.4);
    release("KeyA");
    assert(game.player.heading > 0.1, "Native A key steers the vehicle");
    const capacitor = game.player.boost;
    press("KeyW");
    press("ShiftLeft");
    tick(0.4);
    release("KeyW");
    release("ShiftLeft");
    assert(game.player.boost < capacitor, "Native Shift + W activates boost");
    press("Digit2");
    assert(
      game.snapshot.weapon === "missile",
      "Number key selects the missile launcher",
    );
    const keyboardAmmo = game.snapshot.missiles;
    press("KeyJ");
    release("KeyJ");
    assert(
      game.snapshot.missiles === keyboardAmmo - 1,
      "A brief J keypress fires immediately",
    );
    press("Escape");
    assert(
      game.snapshot.phase === "paused" && game.keys.size === 0,
      "Escape pauses and clears held keys",
    );
    press("Escape");
    assert(
      game.snapshot.phase === "playing",
      "Escape resumes without a stuck throttle",
    );
    engine.restart();
    cancelAnimationFrame(game.frame);
    const region = game.layout.encounters[0],
      beforePatrol = game.enemies.length;
    pose(region.x, region.z);
    game.invulnerable = 999;
    tick(6.5);
    assert(
      game.enemies.length > beforePatrol,
      "A signaled patrol arrives along the route",
    );
    engine.restart();
    cancelAnimationFrame(game.frame);
    game.encounterDirector = new EncounterDirector([]);
    const transport = game.enemies.find((e: any) => e.kind === "transport");
    const convoyStart = transport.object.position.clone();
    tick(1);
    assert(
      transport.object.position.distanceTo(convoyStart) > 20,
      "An armored convoy travels along the sector road",
    );
    game.snapshot.missiles = 24;
    for (let i = 0; i < 8 && transport.hp > 0; i++) {
      const target = game.aimPoint(transport);
      pose(target.x, target.z + 55);
      game.invulnerable = 999;
      game.target = transport;
      game.snapshot.weapon = "missile";
      game.fire(new THREE.Vector3(game.player.x, game.player.y, game.player.z));
      tick(1);
    }
    assert(
      transport.hp === 0 && game.snapshot.phase === "playing",
      "Missiles destroy a moving transport without ending the mission",
    );
    const salvage = game.pickups.find((p: any) => p.salvage);
    assert(!!salvage && salvage.active, "The convoy leaves recoverable cargo");
    game.snapshot.health = 40;
    game.updatePickups(1 / 120, salvage.object.position);
    assert(
      game.snapshot.health === 75 && !salvage.active,
      "Recovering cargo repairs the craft",
    );
    engine.restart();
    cancelAnimationFrame(game.frame);
    game.encounterDirector = new EncounterDirector([]);
    const firstBoss = game.enemies.find((e: any) => e.kind === "boss");
    const originalBossHealth = firstBoss.hp;
    pose(BOSS_POSITION.x, BOSS_POSITION.z + 70);
    game.snapshot.weapon = "laser";
    game.target = firstBoss;
    for (let i = 0; i < 20; i++) {
      game.fireCooldown = 0;
      game.fire(new THREE.Vector3(game.player.x, game.player.y, game.player.z));
      tick(0.13);
    }
    assert(
      firstBoss.hp === originalBossHealth,
      "Boss shield blocks direct projectile damage before relays are down",
    );
    engine.restart();
    cancelAnimationFrame(game.frame);
    const sentry = game.enemies.find((e: any) => e.kind === "relay");
    pose(sentry.object.position.x, sentry.object.position.z + 45);
    sentry.cooldown = 0;
    tick(2);
    assert(
      game.snapshot.health < 100,
      "Enemy projectiles damage the player through collision",
    );
    engine.restart();
    cancelAnimationFrame(game.frame);
    const ammo = game.snapshot.missiles;
    game.snapshot.weapon = "missile";
    game.fireCooldown = 0;
    game.fire(new THREE.Vector3(0, 2, 125));
    assert(
      game.snapshot.missiles === ammo - 1,
      "Missile fire consumes exactly one round",
    );
    game.snapshot.missiles = 0;
    const shotCount = game.shots.length;
    game.fireCooldown = 0;
    game.fire(new THREE.Vector3(0, 2, 125));
    assert(
      game.shots.length === shotCount,
      "Empty missile magazine cannot fire",
    );
    engine.restart();
    cancelAnimationFrame(game.frame);
    const drone = game.enemies.find((e: any) => e.kind === "drone");
    pose(0, 100);
    drone.object.position.set(0, 4, 104);
    drone.home.copy(drone.object.position);
    game.snapshot.weapon = "mine";
    game.fire(new THREE.Vector3(0, 2, 100));
    tick(1.3);
    assert(drone.hp === 0, "Proximity mine arms and destroys a pursuing drone");
    const pickup = game.pickups[0];
    game.snapshot.health = 20;
    game.snapshot.missiles = 0;
    pose(
      pickup.object.position.x,
      pickup.object.position.z,
      pickup.object.position.y,
    );
    game.updatePickups(
      1 / 120,
      new THREE.Vector3(game.player.x, game.player.y, game.player.z),
    );
    assert(
      game.snapshot.health === 55 &&
        game.snapshot.missiles === 6 &&
        !pickup.active,
      "Supply cache repairs hull, replenishes ammo, and enters cooldown",
    );
    engine.pause();
    assert(game.snapshot.phase === "paused", "Pause enters the paused state");
    engine.resume();
    assert(
      game.snapshot.phase === "playing",
      "Resume restores the playing state",
    );
    engine.restart();
    cancelAnimationFrame(game.frame);
    for (let level = 0; level < 3; level++) {
      game.encounterDirector = new EncounterDirector([]);
      assert(
        game.layout.id === level && game.environment.name === `world-${level}`,
        "The sector loads its own environment and simulation layout",
      );
      // Remove only the nondeterministic patrol interference for relay/boss projectile assertions.
      // Drone damage and mines are independently exercised above and below.
      const escort = game.enemies.find((e: any) => e.kind === "drone");
      fireAt(escort, "missile");
      game.enemies
        .filter((e: any) => e.kind === "drone")
        .forEach((e: any) => {
          e.hp = 0;
          e.object.visible = false;
        });
      for (const relay of game.enemies.filter((e: any) => e.kind === "relay")) {
        game.damageEnemy(relay, 500);
        assert(
          relay.hp === relay.maxHp,
          "Outpost shield blocks damage before breach",
        );
        const site = game.layout.outposts[relay.phase];
        for (const [index, gate] of site.gates.entries()) {
          pose(
            gate.x,
            gate.z,
            terrainHeight(gate.x, gate.z, game.layout) + gate.altitude,
          );
          game.player.airborne = gate.airborne;
          game.player.vz = gate.airborne ? -65 : 0;
          game.step(1 / 120);
          assert(
            game.breaches[relay.phase].gate === index + 1,
            `Breach gate ${index + 1} registers in order`,
          );
        }
        assert(
          game.breaches[relay.phase].breached,
          "Airborne coupler exposes relay",
        );
        fireAt(relay);
      }
      assert(
        game.snapshot.relays === 3 && !game.bossVisual.shield.visible,
        `Sector ${level + 1}: all relays disable the boss shield`,
      );
      const boss = game.enemies.find((e: any) => e.kind === "boss");
      fireAt(boss);
      assert(
        game.snapshot.phase === "aftermath" && boss.object.visible,
        "Boss remains visible during the meltdown",
      );
      tick(1);
      engine.pause();
      const elapsed = game.snapshot.aftermathTime;
      tick(10);
      assert(
        game.snapshot.aftermathTime === elapsed,
        "Pause freezes the meltdown timer",
      );
      engine.resume();
      tick(6.1);
      assert(
        game.snapshot.phase === "won",
        `Sector ${level + 1}: victory follows the visible meltdown`,
      );
      assert(game.snapshot.score > 0, "Victory awards a score");
      engine.nextLevel();
      if (level < 2)
        assert(
          game.snapshot.level === level + 1 && game.snapshot.health === 100,
          `Next sector loads with restored hull`,
        );
    }
    assert(
      game.snapshot.phase === "complete",
      "All three sectors lead to campaign completion",
    );
    engine.newCampaign();
    cancelAnimationFrame(game.frame);
    assert(
      game.snapshot.level === 0 && game.snapshot.score === 0,
      "New campaign resets sector and score",
    );
    game.invulnerable = 0;
    game.damagePlayer(100);
    assert(
      game.snapshot.phase === "aftermath",
      "Lethal damage first shows the wreckage",
    );
    tick(3.1);
    assert(game.snapshot.phase === "lost", "Defeat appears after the wreckage");
    engine.restart();
    cancelAnimationFrame(game.frame);
    assert(
      game.snapshot.phase === "playing" && game.snapshot.health === 100,
      "Retry restores a playable vehicle",
    );
    game.snapshot.score = 500;
    engine.restart();
    cancelAnimationFrame(game.frame);
    assert(
      game.snapshot.score === 0,
      "Retry resets points earned during the failed attempt",
    );
    game.refreshSnapshot();
    game.renderScene(1 / 60);
    game.composer.render();
    output.textContent += "\n\nALL COMBAT CHECKS PASSED";
    engine.pause();
  } catch (error) {
    output.textContent +=
      "\n\nFAIL " + (error instanceof Error ? error.stack : String(error));
    engine?.pause();
  } finally {
    if (originalBest === null) localStorage.removeItem("vector-wars-best");
    else localStorage.setItem("vector-wars-best", originalBest);
  }
});

// Repeatable visual checkpoints. This fixture is not shipped in the production build.
for (const checkpoint of [
  "outpost",
  "switchback",
  "canyon",
  "ash",
  "convoy",
  "reactor",
  "meltdown",
  "debris",
]) {
  document.querySelector(`#${checkpoint}`)!.addEventListener("click", () => {
    engine?.dispose();
    engine = new GameEngine(document.querySelector("#stage")!, () => {}, {
      sound: false,
      music: false,
      effects: true,
      quality: "high",
    });
    const game = engine as any;
    cancelAnimationFrame(game.frame);
    if (checkpoint === "canyon" || checkpoint === "ash")
      game.loadLevel(checkpoint === "canyon" ? 1 : 2);
    engine.start();
    game.deployment = 1.6;
    const isOutpost = ["outpost", "switchback", "canyon", "ash"].includes(
      checkpoint,
    );
    const site = isOutpost
      ? game.layout.outposts[checkpoint === "switchback" ? 1 : 0]
      : game.layout.boss;
    const viewX = isOutpost ? site.gates[0].x : site.x;
    const viewZ = isOutpost ? site.gates[0].z + 35 : site.z + 125;
    const ground = terrainHeight(viewX, viewZ, game.layout);
    Object.assign(game.player, {
      x: viewX,
      z: viewZ,
      y: ground + 1.7,
      heading: 0,
    });
    game.cameraPosition.set(viewX, ground + 28, viewZ + 10);
    game.cameraLook.set(viewX, ground + 5, viewZ - 80);
    if (checkpoint === "meltdown" || checkpoint === "debris") {
      game.snapshot.relays = 3;
      game.bossVisual.shield.visible = false;
      game.damageEnemy(
        game.enemies.find((e: any) => e.kind === "boss"),
        10000,
      );
      const seconds = checkpoint === "meltdown" ? 2.2 : 3.8;
      for (let i = 0; i < seconds * 120; i++) game.advanceSimulation(1 / 120);
    }
    if (checkpoint === "convoy") {
      const transport = game.enemies.find((e: any) => e.kind === "transport");
      const forward = new THREE.Vector3(
        -Math.sin(transport.object.rotation.y),
        0,
        -Math.cos(transport.object.rotation.y),
      );
      const player = transport.object.position
        .clone()
        .addScaledVector(forward, -35);
      Object.assign(game.player, {
        x: player.x,
        z: player.z,
        y: terrainHeight(player.x, player.z, game.layout) + 1.7,
        heading: transport.object.rotation.y,
      });
      game.cameraPosition.copy(player).addScaledVector(forward, -18);
      game.cameraPosition.y += 12;
      game.cameraLook.copy(transport.object.position);
    }
    game.renderScene(1 / 60);
    game.composer.render();
    output.textContent = `Visual checkpoint: ${checkpoint}. Phase: ${game.snapshot.phase}. Meltdown: ${game.snapshot.aftermathTime.toFixed(1)}s. Use the main game for interactive play.`;
    engine.pause();
  });
}
