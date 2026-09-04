# Vector Wars

A desktop 3D hovercraft combat game. Drive the VXR-01 through a wireframe wasteland, destroy three shield relays, and take down the sector's orbital boss. Three sectors have different relay layouts, larger enemy patrols, and stronger bosses.

## Run

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. A current desktop browser with WebGL 2 is required. Sound starts when you deploy. No account, backend, remote fonts, or downloaded audio is required.

## Controls

| Key                | Action                                        |
| ------------------ | --------------------------------------------- |
| WASD / arrow keys  | Accelerate, reverse, steer                    |
| Shift              | Boost, using a rechargeable capacitor         |
| Space              | Drift brake                                   |
| Ctrl               | Jump                                          |
| J / F / left mouse | Fire                                          |
| 1 / 2 / 3          | Pulse laser / seeker missile / proximity mine |
| Q / E              | Cycle weapons                                 |
| R                  | Recover the vehicle at the starting position  |
| Escape             | Pause or resume                               |

Face an enemy to acquire a target. Lasers and missiles assist your aim within the forward targeting cone. Missiles track their target in flight. Mines arm behind the craft and detonate when an enemy approaches.

Destroy the three relays to remove the boss shield. Relays replenish ammunition and some hull integrity when destroyed. Green supply caches repair the craft and refill ammunition; they recharge after 25 seconds. Escorts are optional score targets. Complete the boss encounter to advance. Retrying a sector resets the points earned on that attempt.

The game pauses when its tab loses focus. Sound, music, effects, render quality, and best score persist locally when browser storage is available. Small screens show a desktop keyboard notice; touch driving is not implemented.

## Implementation

- React and TypeScript own the HUD, menus, and accessible native dialogs.
- Three.js renders the terrain, circuit, bosses, particles, and Blender hovercraft.
- The simulation runs at a fixed 120 Hz, independent of rendering. Spring suspension, lateral traction, drag, boost, gravity, launch ramps, and boundary response create the driving behavior.
- Swept segment collisions prevent fast projectiles from passing through targets between simulation steps.
- The Web Audio soundtrack, engine sound, and weapon effects are synthesized locally.
- Actual Afterglow registry Button, Badge, Progress, and theme tokens are included in `src/components/ui` and `src/afterglow.css`. Source: [Afterglow](https://afterglow.thebuilder.dk/).
- The visual reference is [thebuilder.dk](https://thebuilder.dk/) and the supplied screenshot. The VXR-01 was created in Blender for this game and exported as `public/models/vxr-01.glb`.

## Verification

```sh
pnpm test
pnpm build
pnpm preview
```

Physics tests cover suspension stability, boost and recharge, drift, ramp launches, jump impulses, boundaries, and swept collisions.

With the dev server running, open `/tests/combat.html` and click **Run deterministic combat verification**. This uses the actual WebGL engine with fixed simulation steps and controlled test positions. It checks native keyboard events, all weapons, shield gating, hostile damage, supply pickups, all three sector transitions, defeat, retry, and campaign completion. It restores the previous best score after running. The fixture is excluded from the production build. It verifies combat behavior, not human difficulty balancing.

The interface was checked in the browser at 1280×720, 1440×900, and 390×844, including menus, settings, and keyboard focus. The small-screen layout is informational; gameplay targets desktop.
