import { CatmullRomCurve3, Vector3 } from "three";
/** World-space definitions shared by rendering, collision and mission logic. */
export const WORLD_CENTER_Z = -250;
export const WORLD_RADIUS = 1050;
export interface Ramp {
  x: number;
  z: number;
  width: number;
  length: number;
  height: number;
}
export interface Pillar {
  x: number;
  z: number;
  radius: number;
  height: number;
}
export interface Gate {
  x: number;
  z: number;
  altitude: number;
  airborne: boolean;
}
export interface Outpost {
  name: string;
  x: number;
  z: number;
  gates: Gate[];
}
export const OUTPOSTS: Outpost[] = [
  { name: "DUSTWORKS", x: -440, z: 35 },
  { name: "SWITCHBACK", x: 450, z: -255 },
  { name: "DEAD CHANNEL", x: -190, z: -790 },
].map((site) => ({
  ...site,
  gates: [
    { x: site.x - 75, z: site.z + 320, altitude: 3, airborne: false },
    { x: site.x + 32, z: site.z + 225, altitude: 3, airborne: false },
    { x: site.x, z: site.z + 90, altitude: 11, airborne: true },
  ],
}));
export const BOSS_POSITION = { x: 330, z: -825 };
export const RAMPS: Ramp[] = [
  { x: 0, z: 65, width: 18, length: 30, height: 8 },
  ...OUTPOSTS.map((site) => ({
    x: site.x,
    z: site.z + 121,
    width: 42,
    length: 38,
    height: 9,
  })),
  { x: 175, z: -390, width: 22, length: 38, height: 12 },
];
const PILLAR_CANDIDATES: Pillar[] = [
  ...Array.from({ length: 54 }, (_, i) => {
    const angle = i * 2.39996,
      radius = 740 + Math.sin(i * 13) * 95;
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius + WORLD_CENTER_Z,
      radius: 5 + (i % 4),
      height: 8 + (Math.sin(i * 17) + 1) * 18,
    };
  }),
  ...OUTPOSTS.flatMap((site) =>
    [-1, 1].map((side) => ({
      x: site.x + side * 36,
      z: site.z + 30,
      radius: 4,
      height: 26,
    })),
  ),
  { x: -38, z: 82, radius: 5, height: 24 },
  { x: 50, z: 10, radius: 5, height: 35 },
  { x: -240, z: -230, radius: 5, height: 70 },
  { x: 245, z: -230, radius: 5, height: 70 },
];
/** Every breach section is generated from the same gates and ramp used by gameplay.
 * The outer connector reaches SWITCHBACK from the south, never doubling back. */
function breachRoad(site: Outpost): number[][] {
  const ramp = RAMPS[OUTPOSTS.indexOf(site) + 1];
  return [
    ...site.gates.slice(0, 2).map((g) => [g.x, g.z]),
    [ramp.x, ramp.z + ramp.length / 2 + 35],
    [ramp.x, ramp.z + ramp.length / 2],
    [ramp.x, ramp.z - ramp.length / 2],
    [site.gates[2].x, site.gates[2].z],
    [site.x, site.z + 50],
    [site.x - 75, site.z - 20],
  ];
}
export const ROAD_NODES = [
  [0, 125],
  [-110, 190],
  [-320, 390],
  [-530, 420],
  ...breachRoad(OUTPOSTS[0]),
  [-560, -180],
  [-430, -360],
  ...breachRoad(OUTPOSTS[2]),
  [-230, -920],
  [80, -1000],
  [260, -920],
  [330, -890],
  [410, -850],
  [620, -790],
  [700, -540],
  [700, -160],
  [600, 170],
  [425, 160],
  ...breachRoad(OUTPOSTS[1]),
  [270, -340],
  [100, -200],
];
export function createRoadCurve() {
  const curve = new CatmullRomCurve3(
    ROAD_NODES.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    "centripetal",
  );
  curve.arcLengthDivisions = ROAD_NODES.length * 40;
  return curve;
}
const roadClearancePoints = createRoadCurve().getSpacedPoints(1200);
export const PILLARS = PILLAR_CANDIDATES.filter((pillar) =>
  roadClearancePoints.every(
    (point) =>
      Math.hypot(point.x - pillar.x, point.z - pillar.z) > pillar.radius + 16,
  ),
);
export const SUPPLIES = [
  [-130, 180],
  [-450, -40],
  [285, -100],
  [460, -340],
  [-230, -650],
  [235, -720],
];
export function compassHeading(radians: number) {
  return ((((-radians * 180) / Math.PI) % 360) + 360) % 360;
}
export function compassTicks(radians: number) {
  const heading = compassHeading(radians),
    base = Math.floor(heading / 15) * 15;
  return Array.from({ length: 9 }, (_, i) => {
    const degrees = base + (i - 4) * 15;
    return {
      degrees: ((degrees % 360) + 360) % 360,
      offset: (degrees - heading) * 3.1,
    };
  });
}
