import { describe, expect, it } from "vitest";
import { RammerDirector, type RammerInput, type RammerPhase } from "./rammer";

const input: RammerInput = {
  active: true,
  x: 0,
  z: 0,
  playerX: 80,
  playerZ: 0,
};

describe("rammer movement", () => {
  it("approaches at a bounded speed and holds its distance before charging", () => {
    const rammer = new RammerDirector();
    expect(rammer.update(0.1, { ...input, playerX: 500 })).toMatchObject({
      phase: "approach",
      vx: 38,
      vz: 0,
      warning: false,
    });
    expect(rammer.update(0.5, { ...input, playerX: 30 })).toMatchObject({
      phase: "approach",
      vx: 0,
      vz: 0,
      warning: false,
    });
    expect(rammer.update(0.7, input).phase).toBe("approach");
    expect(rammer.update(0.11, input)).toMatchObject({
      phase: "windup",
      warning: true,
      vx: 0,
      vz: 0,
    });
  });

  it("does not start a charge until the target is within reach", () => {
    const rammer = new RammerDirector();
    expect(rammer.update(10, { ...input, playerX: 200 })).toMatchObject({
      phase: "approach",
      warning: false,
    });
    expect(rammer.update(0.01, input)).toMatchObject({
      phase: "windup",
      warning: true,
    });
  });

  it("provides a full warning and locks direction before the player dodges", () => {
    const rammer = new RammerDirector();
    expect(rammer.update(1.4, input).warning).toBe(true);
    const dodged = { ...input, playerX: 0, playerZ: 100 };
    expect(rammer.update(0.9, dodged)).toMatchObject({
      phase: "windup",
      warning: false,
      vx: 0,
      vz: 0,
    });
    const charge = rammer.update(0.11, dodged);
    expect(charge).toMatchObject({
      phase: "charge",
      vx: 90,
      vz: 0,
      warning: false,
    });
    expect(charge.heading).toBeCloseTo(-Math.PI / 2);
    expect(rammer.update(0.5, { ...input, playerX: -100 })).toEqual(charge);
  });

  it("commits to an overshoot and stops for a recovery window", () => {
    const rammer = new RammerDirector();
    rammer.update(1.4, input);
    rammer.update(1, input);
    expect(rammer.update(1.34, input).phase).toBe("charge");
    expect(rammer.update(0.02, input)).toMatchObject({
      phase: "recovery",
      vx: 0,
      vz: 0,
    });
    expect(rammer.update(1.7, input).phase).toBe("recovery");
    expect(rammer.update(0.11, input).phase).toBe("approach");
    expect(rammer.update(0.1, { ...input, playerX: -100 }).vx).toBeLessThan(0);
  });

  it.each<RammerPhase>(["approach", "windup", "charge", "recovery"])(
    "freezes %s while inactive",
    (phase) => {
      const rammer = new RammerDirector();
      if (phase !== "approach") rammer.update(1.4, input);
      if (phase === "charge" || phase === "recovery") rammer.update(1, input);
      if (phase === "recovery") rammer.update(1.35, input);
      const frozen = rammer.update(60, { ...input, active: false });
      expect(frozen).toMatchObject({ phase, warning: false });
      expect(Math.hypot(frozen.vx, frozen.vz)).toBe(0);
      expect(rammer.update(0.01, input).phase).toBe(phase);
    },
  );

  it("threatens a stationary craft but misses a lateral dodge after the warning", () => {
    function run(dodge: boolean) {
      const rammer = new RammerDirector();
      const state = { ...input, playerX: 0, playerZ: -80 };
      let nearest = Infinity;
      for (let frame = 0; frame < 600; frame++) {
        const motion = rammer.update(1 / 120, state);
        if (motion.warning && dodge) state.playerX = 30;
        state.x += motion.vx / 120;
        state.z += motion.vz / 120;
        if (motion.phase === "charge")
          nearest = Math.min(
            nearest,
            Math.hypot(state.playerX - state.x, state.playerZ - state.z),
          );
        if (motion.phase === "recovery") return nearest;
      }
      throw new Error("Rammer never completed its charge");
    }
    expect(run(false)).toBeLessThan(1);
    expect(run(true)).toBeGreaterThanOrEqual(30);
  });

  it("starts a fresh approach after reset and never skips a warning after a stall", () => {
    const rammer = new RammerDirector();
    expect(rammer.update(60, input)).toMatchObject({
      phase: "windup",
      warning: true,
    });
    expect(rammer.update(0.01, input).phase).toBe("windup");
    rammer.reset();
    expect(rammer.update(0.1, input)).toMatchObject({
      phase: "approach",
      warning: false,
    });
  });
});
