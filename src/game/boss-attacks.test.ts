import { describe, expect, it } from "vitest";
import {
  BossAttackDirector,
  type BossAttackEvent,
  type BossAttackInput,
} from "./boss-attacks";

const input: BossAttackInput = {
  level: 0,
  active: true,
  shielded: false,
  x: 20,
  z: 40,
  playerX: 30,
  playerZ: -100,
};

function nextEvent(
  director: BossAttackDirector,
  state = input,
): BossAttackEvent {
  for (let frame = 0; frame < 1000; frame++) {
    const event = director.update(1 / 120, state)[0];
    if (event) return event;
  }
  throw new Error("Boss did not advance its attack within eight seconds");
}

describe("boss attack direction", () => {
  it.each([
    [0, "fan"],
    [1, "sweep"],
    [2, "shockwave"],
  ] as const)("sector %i warns before its %s attack", (level, attack) => {
    const director = new BossAttackDirector();
    const state = { ...input, level };
    const warning = nextEvent(director, state);
    expect(warning).toMatchObject({ kind: "warning", attack });
    if (warning.kind !== "warning") throw new Error("Missing warning");
    expect(warning.duration).toBeGreaterThanOrEqual(1);
    expect(director.update(warning.duration - 0.01, state)).toEqual([]);
    expect(director.update(0.02, state)[0]).toMatchObject({
      kind: "fire",
      attack,
    });
  });

  it("locks the fan's origin and aim when it starts charging", () => {
    const director = new BossAttackDirector();
    nextEvent(director);
    const fire = nextEvent(director, {
      ...input,
      x: 200,
      z: 300,
      playerX: -150,
      playerZ: 600,
    });
    expect(fire).toMatchObject({
      kind: "fire",
      x: input.x,
      z: input.z,
      targetX: input.playerX,
      targetZ: input.playerZ,
      angles: [-0.3, -0.15, 0, 0.15, 0.3],
    });
  });

  it("freezes a pending charge while inactive", () => {
    const director = new BossAttackDirector();
    nextEvent(director);
    expect(director.update(0.6, input)).toEqual([]);
    expect(director.update(60, { ...input, active: false })).toEqual([]);
    expect(director.update(0.49, input)).toEqual([]);
    expect(director.update(0.02, input)[0]?.kind).toBe("fire");
  });

  it("sweeps seven volleys, then reverses direction on the next attack", () => {
    const director = new BossAttackDirector();
    const state = { ...input, level: 1 };
    const sweeps: number[][] = [];
    for (let cycle = 0; cycle < 2; cycle++) {
      expect(nextEvent(director, state).kind).toBe("warning");
      const centers: number[] = [];
      for (let volley = 0; volley < 7; volley++) {
        const fire = nextEvent(director, state);
        expect(fire).toMatchObject({ kind: "fire", attack: "sweep" });
        if (fire.kind !== "fire") throw new Error("Sweep ended early");
        expect(fire.angles).toHaveLength(3);
        centers.push(fire.angles[1]);
      }
      sweeps.push(centers);
    }
    expect(sweeps[0][0]).toBeCloseTo(-0.6);
    expect(sweeps[0][6]).toBeCloseTo(0.6);
    sweeps[0].forEach((angle, index) => {
      expect(sweeps[1][index]).toBeCloseTo(-angle);
      if (index > 0) expect(angle).toBeGreaterThan(sweeps[0][index - 1]);
    });
  });

  it("alternates ground rings and aimed fans for the Overmind", () => {
    const director = new BossAttackDirector();
    const state = { ...input, level: 2 };
    for (const attack of ["shockwave", "fan", "shockwave"]) {
      expect(nextEvent(director, state)).toMatchObject({
        kind: "warning",
        attack,
      });
      const fire = nextEvent(director, state);
      expect(fire).toMatchObject({ kind: "fire", attack });
      if (fire.kind === "fire")
        expect(fire.angles).toHaveLength(attack === "shockwave" ? 0 : 5);
    }
  });

  it("restoring shields aborts pending volleys and resets the attack cycle", () => {
    const director = new BossAttackDirector();
    const state = { ...input, level: 1 };
    nextEvent(director, state);
    const firstVolley = nextEvent(director, state);
    expect(
      director.update(20, { ...state, shielded: true, active: false }),
    ).toEqual([]);
    expect(director.update(1.7, state)).toEqual([]);
    expect(nextEvent(director, state).kind).toBe("warning");
    expect(nextEvent(director, state)).toEqual(firstVolley);
  });

  it("resets pending attacks when changing sector or restarting", () => {
    const director = new BossAttackDirector();
    nextEvent(director);
    const canyon = { ...input, level: 1 };
    expect(director.update(1.7, canyon)).toEqual([]);
    expect(nextEvent(director, canyon)).toMatchObject({
      kind: "warning",
      attack: "sweep",
    });
    director.reset();
    expect(director.update(1.7, input)).toEqual([]);
    expect(nextEvent(director)).toMatchObject({
      kind: "warning",
      attack: "fan",
    });
  });

  it("does not collapse a warning and damage into one frame after a stall", () => {
    const director = new BossAttackDirector();
    expect(director.update(60, input)).toMatchObject([{ kind: "warning" }]);
    expect(director.update(0.01, input)).toEqual([]);
  });
});
