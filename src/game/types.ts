export type Phase =
  | "ready"
  | "aftermath"
  | "playing"
  | "paused"
  | "won"
  | "lost"
  | "complete";
export type Weapon = "laser" | "missile" | "mine";
export interface Settings {
  sound: boolean;
  music: boolean;
  effects: boolean;
  quality: "high" | "balanced";
}
export interface Blip {
  x: number;
  z: number;
  kind: "relay" | "boss" | "drone" | "transport" | "cargo" | "repair" | "gate";
  alive: boolean;
}
export interface Snapshot {
  phase: Phase;
  level: number;
  health: number;
  boost: number;
  speed: number;
  weapon: Weapon;
  missiles: number;
  mines: number;
  score: number;
  best: number;
  elapsed: number;
  relays: number;
  bossHealth: number;
  bossMaxHealth: number;
  bossShielded: boolean;
  enemies: number;
  convoys: number;
  convoyDistance: number;
  x: number;
  z: number;
  heading: number;
  altitude: number;
  blips: Blip[];
  message: string;
  target: string;
  targetDistance: number;
  targetHealth: number;
  targetLocked: boolean;
  fps: number;
  hitPulse: number;
  hitDirection: number;
  hitConfirm: number;
  killText: string;
  waypoint: {
    name: string;
    detail: string;
    x: number;
    y: number;
    z: number;
    distance: number;
  };
  breachTime: number;
  breachGate: number;
  breached: number;
  aftermathTime: number;
}
export const LEVELS = [
  {
    name: "THE NEON WASTES",
    location: "SALT FLATS / SECTOR 07",
    boss: "THE SENTINEL",
    color: "#ff5b82",
    drones: 8,
    bossHealth: 700,
    description:
      "Three outposts. One reactor. Follow the amber breach gates, jump the coupler, then destroy each exposed relay.",
  },
  {
    name: "GLASS CANYON",
    location: "CRYSTAL RIDGE / SECTOR 12",
    boss: "THE ARCHITECT",
    color: "#b890ff",
    drones: 12,
    bossHealth: 1000,
    description:
      "Climb the crystal ridges. Breach Echo Pass, Glass Spine and Night Lock to uncover the Architect.",
  },
  {
    name: "THE ASH SEA",
    location: "CALDERA / SECTOR 00",
    boss: "THE OVERMIND",
    color: "#ffbc57",
    drones: 16,
    bossHealth: 1400,
    description:
      "Cross the ash valleys. Silence the three furnaces and end the Overmind beneath the caldera.",
  },
];
export const WEAPONS: {
  id: Weapon;
  name: string;
  short: string;
  key: string;
  description: string;
}[] = [
  {
    id: "laser",
    name: "PULSE LASER",
    short: "PLS",
    key: "1",
    description: "Twin barrels. Unlimited fire.",
  },
  {
    id: "missile",
    name: "SEEKER MISSILE",
    short: "MSL",
    key: "2",
    description: "Locks onto targets ahead.",
  },
  {
    id: "mine",
    name: "PROXIMITY MINE",
    short: "MIN",
    key: "3",
    description: "Drop a surprise for your tail.",
  },
];
export const initialSnapshot: Snapshot = {
  phase: "ready",
  level: 0,
  health: 100,
  boost: 100,
  speed: 0,
  weapon: "laser",
  missiles: 12,
  mines: 8,
  score: 0,
  best: 0,
  elapsed: 0,
  relays: 0,
  bossHealth: 700,
  bossMaxHealth: 700,
  bossShielded: true,
  enemies: 8,
  convoys: 2,
  convoyDistance: 0,
  x: 0,
  z: 125,
  heading: 0,
  altitude: 0,
  blips: [],
  message: "ALL SYSTEMS NOMINAL",
  target: "",
  targetDistance: 0,
  targetHealth: 0,
  targetLocked: false,
  fps: 60,
  hitPulse: 0,
  hitDirection: 0,
  hitConfirm: 0,
  killText: "",
  waypoint: {
    name: "DUSTWORKS",
    detail: "BREACH APPROACH",
    x: -515,
    y: 3,
    z: 285,
    distance: 539,
  },
  breachTime: 0,
  breachGate: 0,
  breached: 0,
  aftermathTime: 0,
};
