import { describe, expect, it } from "vitest";
import { Scene } from "three";
import { BossHazards } from "./boss-hazards";

describe("boss ground pulse", () => {
  it("hits a grounded craft only once as the ring crosses it", () => {
    const hazards = new BossHazards(new Scene(), () => 0);
    hazards.shockwave(0, 0);
    expect(hazards.update(0.5, { x: 0, y: 1.7, z: 100 })).toBe(false);
    expect(hazards.update(0.7, { x: 0, y: 1.7, z: 100 })).toBe(true);
    expect(hazards.update(0, { x: 0, y: 1.7, z: 100 })).toBe(false);
    hazards.clear();
  });
  it("lets an airborne craft clear the ring relative to its local ground", () => {
    const scene = new Scene(),
      hazards = new BossHazards(scene, () => 12);
    hazards.shockwave(0, 0);
    expect(hazards.update(1.3, { x: 0, y: 19, z: 100 })).toBe(false);
    expect(hazards.update(0.1, { x: 0, y: 13.7, z: 100 })).toBe(false);
    hazards.update(5, { x: 0, y: 13.7, z: 100 });
    expect(scene.children).toHaveLength(0);
  });
  it("removes warnings and waves on reset without damaging the player", () => {
    const scene = new Scene(),
      hazards = new BossHazards(scene, () => 0);
    hazards.warn({
      kind: "warning",
      attack: "fan",
      x: 0,
      z: 0,
      targetX: 0,
      targetZ: 100,
      duration: 1.1,
    });
    expect(hazards.update(1, { x: 0, y: 1.7, z: 100 })).toBe(false);
    hazards.shockwave(0, 0);
    hazards.clear();
    expect(scene.children).toHaveLength(0);
    expect(hazards.update(2, { x: 0, y: 1.7, z: 100 })).toBe(false);
  });
});
