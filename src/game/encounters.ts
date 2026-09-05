import type { WorldLayout } from "./worlds";
/** One signaled patrol per route region. No spawning on top of the pilot or endless farming. */
export class EncounterDirector {
  private triggered = new Set<number>();
  private pending?: { index: number; remaining: number };
  private cooldown = 5;
  constructor(private regions: WorldLayout["encounters"]) {}
  update(
    x: number,
    z: number,
    nearbyEnemies: number,
    dt: number,
  ): { kind: "warning" | "spawn"; index: number } | undefined {
    this.cooldown -= dt;
    if (this.pending) {
      this.pending.remaining -= dt;
      if (this.pending.remaining <= 0) {
        const index = this.pending.index;
        this.pending = undefined;
        this.cooldown = 12;
        return { kind: "spawn", index };
      }
      return;
    }
    if (this.cooldown > 0 || nearbyEnemies >= 8) return;
    const index = this.regions.findIndex(
      (r, i) => !this.triggered.has(i) && Math.hypot(r.x - x, r.z - z) < 225,
    );
    if (index < 0) return;
    this.triggered.add(index);
    this.pending = { index, remaining: 1.2 };
    return { kind: "warning", index };
  }
}
