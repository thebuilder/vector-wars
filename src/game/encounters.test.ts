import { describe, expect, it } from "vitest";
import { EncounterDirector } from "./encounters";
describe("route patrols", () => {
  it("announces a nearby patrol before spawning it and never repeats that region", () => {
    const director = new EncounterDirector([{ x: 300, z: 0, count: 2 }]);
    expect(director.update(0, 0, 0, 6)).toBeUndefined();
    expect(director.update(100, 0, 0, 0.1)?.kind).toBe("warning");
    expect(director.update(130, 0, 0, 0.6)).toBeUndefined();
    expect(director.update(150, 0, 0, 0.7)?.kind).toBe("spawn");
    expect(director.update(300, 0, 0, 60)).toBeUndefined();
  });
  it("paces different regions and avoids adding enemies to an already crowded fight", () => {
    const director = new EncounterDirector([
      { x: 100, z: 0, count: 2 },
      { x: 500, z: 0, count: 2 },
    ]);
    expect(director.update(100, 0, 8, 10)).toBeUndefined();
    expect(director.update(100, 0, 2, 0.1)?.kind).toBe("warning");
    director.update(100, 0, 2, 2);
    expect(director.update(500, 0, 0, 1)).toBeUndefined();
    expect(director.update(500, 0, 0, 12)?.kind).toBe("warning");
  });
});
