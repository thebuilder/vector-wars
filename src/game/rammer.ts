export type RammerPhase = "approach" | "windup" | "charge" | "recovery";

export interface RammerInput {
  active: boolean;
  x: number;
  z: number;
  playerX: number;
  playerZ: number;
}

export interface RammerMotion {
  phase: RammerPhase;
  vx: number;
  vz: number;
  /** Same forward convention as the craft: (-sin(heading), -cos(heading)). */
  heading: number;
  warning: boolean;
}

/** Desired movement only: the engine retains integration, contact damage and visuals. */
export class RammerDirector {
  private phase: RammerPhase = "approach";
  private elapsed = 0;
  private directionX = 0;
  private directionZ = -1;

  reset() {
    this.phase = "approach";
    this.elapsed = 0;
    this.directionX = 0;
    this.directionZ = -1;
  }

  stagger() {
    this.transition("recovery");
  }

  update(dt: number, input: RammerInput): RammerMotion {
    if (!input.active || dt <= 0 || !Number.isFinite(dt)) return this.motion(0);
    this.elapsed += dt;
    let warning = false;
    const distance = Math.hypot(
      input.playerX - input.x,
      input.playerZ - input.z,
    );

    // One phase transition per update ensures a stall cannot skip the telegraph.
    if (this.phase === "approach") {
      if (distance > 0.001) {
        this.directionX = (input.playerX - input.x) / distance;
        this.directionZ = (input.playerZ - input.z) / distance;
      }
      if (this.elapsed >= 1.4 && distance <= 100) {
        this.transition("windup");
        warning = true;
      }
    } else if (this.phase === "windup" && this.elapsed >= 1) {
      this.transition("charge");
    } else if (this.phase === "charge" && this.elapsed >= 1.35) {
      this.transition("recovery");
    } else if (this.phase === "recovery" && this.elapsed >= 1.8) {
      this.transition("approach");
      return this.motion(0);
    }

    const speed =
      this.phase === "charge"
        ? 90
        : this.phase === "approach"
          ? Math.min(38, Math.max(0, distance - 48) * 1.6)
          : 0;
    return this.motion(speed, warning);
  }

  private transition(phase: RammerPhase) {
    this.phase = phase;
    this.elapsed = 0;
  }

  private motion(speed: number, warning = false): RammerMotion {
    return {
      phase: this.phase,
      vx: this.directionX * speed,
      vz: this.directionZ * speed,
      heading: Math.atan2(-this.directionX, -this.directionZ),
      warning,
    };
  }
}
