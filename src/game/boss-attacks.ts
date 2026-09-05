export type BossAttack = "fan" | "sweep" | "shockwave";

export interface BossAttackInput {
  level: number;
  active: boolean;
  shielded: boolean;
  x: number;
  z: number;
  playerX: number;
  playerZ: number;
}

interface AttackPosition {
  attack: BossAttack;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
}

export type BossAttackEvent =
  | (AttackPosition & { kind: "warning"; duration: number })
  | (AttackPosition & {
      kind: "fire";
      /** Yaw offsets from the target bearing captured by the warning. Empty for rings. */
      angles: number[];
    });

/** Owns attack timing; the engine owns projectiles, ground rings and their collisions. */
export class BossAttackDirector {
  private level?: number;
  private remaining = 1.8;
  private cycle = 0;
  private volley = 0;
  private pending?: AttackPosition;

  reset() {
    this.level = undefined;
    this.remaining = 1.8;
    this.cycle = 0;
    this.volley = 0;
    this.pending = undefined;
  }

  update(dt: number, input: BossAttackInput): BossAttackEvent[] {
    if (input.level !== this.level) {
      this.reset();
      this.level = input.level;
    }
    if (input.shielded) {
      this.reset();
      return [];
    }
    if (!input.active || dt <= 0 || !Number.isFinite(dt)) return [];
    this.remaining -= dt;
    if (this.remaining > 0) return [];

    // Never catch up a warning and its damage in the same frame after a stall.
    if (!this.pending) {
      const attack: BossAttack =
        input.level === 1
          ? "sweep"
          : input.level === 2 && this.cycle % 2 === 0
            ? "shockwave"
            : "fan";
      this.pending = {
        attack,
        x: input.x,
        z: input.z,
        targetX: input.playerX,
        targetZ: input.playerZ,
      };
      this.volley = 0;
      this.remaining = attack === "fan" ? 1.1 : 1.4;
      return [{ ...this.pending, kind: "warning", duration: this.remaining }];
    }

    const pending = this.pending;
    let angles: number[];
    if (pending.attack === "sweep") {
      const direction = this.cycle % 2 === 0 ? 1 : -1;
      const center = direction * (-0.6 + this.volley * 0.2);
      angles = [-0.045, 0, 0.045].map((offset) => center + offset);
      this.volley++;
    } else {
      angles = pending.attack === "fan" ? [-0.3, -0.15, 0, 0.15, 0.3] : [];
    }

    if (pending.attack === "sweep" && this.volley < 7) {
      this.remaining = 0.18;
    } else {
      this.pending = undefined;
      this.cycle++;
      this.remaining = 2.4;
    }
    return [{ ...pending, kind: "fire", angles }];
  }
}
