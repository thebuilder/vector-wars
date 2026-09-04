export type Phase =
  "ready" | "playing" | "paused" | "won" | "lost" | "complete";
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
  kind: "relay" | "boss" | "drone" | "repair";
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
      "A dead frequency. A live target. Silence the Sentinel before it calls for reinforcements.",
  },
  {
    name: "GHOST CIRCUIT",
    location: "RELAY VALLEY / SECTOR 12",
    boss: "THE ARCHITECT",
    color: "#b890ff",
    drones: 12,
    bossHealth: 1000,
    description:
      "The signal leads deeper. Break the relays and bring the Architect down.",
  },
  {
    name: "LAST TRANSMISSION",
    location: "GROUND ZERO / SECTOR 00",
    boss: "THE OVERMIND",
    color: "#ffbc57",
    drones: 16,
    bossHealth: 1400,
    description:
      "One final signal. One way out. End the Overmind and take back the grid.",
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
};
