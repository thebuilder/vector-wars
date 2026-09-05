import { CatmullRomCurve3, Vector3 } from "three";
import {
  OUTPOSTS,
  RAMPS,
  PILLARS,
  ROAD_NODES,
  SUPPLIES,
  BOSS_POSITION,
  type Outpost,
  type Ramp,
  type Pillar,
} from "./layout";
export interface WorldLayout {
  id: number;
  name: string;
  outposts: Outpost[];
  ramps: Ramp[];
  pillars: Pillar[];
  roadNodes: number[][];
  supplies: number[][];
  boss: { x: number; z: number };
  spawn: { x: number; z: number };
  palette: {
    sky: number;
    horizon: number;
    ground: number;
    grid: number;
    road: number;
    rock: number;
  };
  encounters: { x: number; z: number; count: number }[];
}
function outpost(name: string, x: number, z: number): Outpost {
  return {
    name,
    x,
    z,
    gates: [
      { x: x - 75, z: z + 320, altitude: 3, airborne: false },
      { x: x + 32, z: z + 225, altitude: 3, airborne: false },
      { x, z: z + 90, altitude: 11, airborne: true },
    ],
  };
}
function approach(site: Outpost) {
  return [
    ...site.gates.slice(0, 2).map((g) => [g.x, g.z]),
    [site.x, site.z + 175],
    [site.x, site.z + 140],
    [site.x, site.z + 102],
    [site.x, site.z + 90],
    [site.x, site.z + 50],
    [site.x - 75, site.z - 20],
  ];
}
export function worldRoadCurve(world: Pick<WorldLayout, "roadNodes">) {
  const curve = new CatmullRomCurve3(
    world.roadNodes.map(([x, z]) => new Vector3(x, 0, z)),
    true,
    "centripetal",
  );
  curve.arcLengthDivisions = world.roadNodes.length * 40;
  return curve;
}
function makeWorld(
  id: number,
  name: string,
  sites: Outpost[],
  roadNodes: number[][],
  boss: WorldLayout["boss"],
  spawn: WorldLayout["spawn"],
  palette: WorldLayout["palette"],
): WorldLayout {
  const points = worldRoadCurve({ roadNodes }).getSpacedPoints(1200);
  const pillars = Array.from({ length: id === 1 ? 105 : 70 }, (_, i) => {
    const a = i * 2.39996,
      r = 420 + (Math.sin(i * 13) + 1) * 230;
    return {
      x: Math.cos(a) * r,
      z: Math.sin(a) * r - 250,
      radius: id === 1 ? 7 + (i % 5) : 5 + (i % 4),
      height:
        (id === 1 ? 28 : 12) + (Math.sin(i * 17) + 1) * (id === 1 ? 35 : 22),
    };
  }).filter((p) =>
    points.every(
      (point) => Math.hypot(point.x - p.x, point.z - p.z) > p.radius + 18,
    ),
  );
  const ramps = [
    { x: spawn.x, z: spawn.z - 60, width: 18, length: 30, height: 8 },
    ...sites.map((site) => ({
      x: site.x,
      z: site.z + 121,
      width: 42,
      length: 38,
      height: 9,
    })),
  ];
  const supplies = sites.map((site) => [site.x - 65, site.z + 50]);
  const encounters = [0.025, 0.21, 0.45, 0.68, 0.87].map((t, index) => {
    const p = worldRoadCurve({ roadNodes }).getPointAt(t);
    return { x: p.x, z: p.z, count: 2 + ((index + id) % 2) };
  });
  return {
    id,
    name,
    outposts: sites,
    ramps,
    pillars,
    roadNodes,
    supplies,
    boss,
    spawn,
    palette,
    encounters,
  };
}
const canyonSites = [
  outpost("ECHO PASS", -520, -180),
  outpost("GLASS SPINE", 100, -650),
  outpost("NIGHT LOCK", 500, 5),
];
const ashSites = [
  outpost("CINDER GATE", -360, 130),
  outpost("BLACK FURNACE", 20, -390),
  outpost("ASHEN REACH", 550, -570),
];
export const WORLDS: WorldLayout[] = [
  {
    id: 0,
    name: "THE NEON WASTES",
    outposts: OUTPOSTS,
    ramps: RAMPS,
    pillars: PILLARS,
    roadNodes: ROAD_NODES,
    supplies: SUPPLIES,
    boss: BOSS_POSITION,
    spawn: { x: 0, z: 125 },
    palette: {
      sky: 0x030609,
      horizon: 0x170916,
      ground: 0x080e17,
      grid: 0x388c82,
      road: 0xff527d,
      rock: 0x326b6b,
    },
    encounters: [
      { x: -110, z: 190, count: 2 },
      { x: -530, z: -200, count: 2 },
      { x: 50, z: -990, count: 3 },
      { x: 700, z: -540, count: 2 },
      { x: 200, z: -300, count: 2 },
    ],
  },
  makeWorld(
    1,
    "GLASS CANYON",
    canyonSites,
    [
      [0, 350],
      [-180, 440],
      [-550, 250],
      ...approach(canyonSites[0]),
      [-640, -430],
      [-350, -600],
      [-150, -280],
      ...approach(canyonSites[1]),
      [-100, -840],
      [280, -930],
      [500, -880],
      [690, -670],
      [790, -350],
      [750, 340],
      [460, 420],
      ...approach(canyonSites[2]),
      [280, 30],
      [130, 190],
    ],
    { x: 500, z: -800 },
    { x: 0, z: 350 },
    {
      sky: 0x020b15,
      horizon: 0x193b53,
      ground: 0x102337,
      grid: 0x4d9ac2,
      road: 0x90e9ff,
      rock: 0x558cb2,
    },
  ),
  makeWorld(
    2,
    "THE ASH SEA",
    ashSites,
    [
      [-20, 450],
      [-180, 540],
      [-490, 550],
      ...approach(ashSites[0]),
      [-470, 10],
      [-320, -50],
      [-200, 20],
      ...approach(ashSites[1]),
      [-80, -670],
      [40, -850],
      [250, -840],
      [700, -870],
      [800, -580],
      [780, -260],
      [600, -120],
      ...approach(ashSites[2]),
      [330, -570],
      [300, -350],
      [220, -80],
      [200, 250],
    ],
    { x: 190, z: -750 },
    { x: -20, z: 450 },
    {
      sky: 0x110407,
      horizon: 0x542012,
      ground: 0x231718,
      grid: 0xa45039,
      road: 0xffad4d,
      rock: 0x9e5646,
    },
  ),
];
