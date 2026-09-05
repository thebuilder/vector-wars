# Vector Wars

A desktop 3D hovercraft combat game. Drive the VXR-01 through three distinct 2.1 km sectors, breach defended outposts, and destroy armored reactors. The Neon Wastes, Glass Canyon, and Ash Sea have different road networks, terrain, outpost locations, landmarks, and colors.

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
| M                  | Open the sector map and pause                 |

Face an enemy to acquire a target. Lasers and missiles assist your aim within the forward targeting cone. Missiles track their target in flight. Mines arm behind the craft and detonate when an enemy approaches.

Follow the amber gates at each outpost. Passing 01 starts a 14-second breach window: pass 02, then take the ramp through the airborne JUMP coupler at 90 km/h or faster. The navigation arrow and countdown track the next gate. Press M for the full sector map. The breach permanently exposes that relay. Boost on the approaches, use drift to tighten the turn, and leave mines when breaking away from pursuers. Destroy the three relays to remove the reactor shield. Relays replenish ammunition and some hull integrity when destroyed. Green supply caches repair the craft and refill ammunition; they recharge after 25 seconds. Escorts are optional score targets. Traveling into new areas triggers announced patrol arrivals, with a delay before enemies engage. Each area sends one wave; a cooldown and nearby-enemy limit keep arrivals spaced apart. The reactor destabilizes for 3.5 seconds, explodes, and leaves another 3.5 seconds of aftermath before the result. You can keep driving or pause during the sequence. Complete the boss encounter to advance. Retrying a sector resets the points earned on that attempt.

Deployment keeps the vehicle in place while the camera eases into the chase view. The driving HUD prioritizes the next gate, hull, boost, speed, and selected weapon; detailed navigation is in the map. The compass reads the live heading at display frame rate.

The game pauses when its tab loses focus. Sound, music, effects, render quality, and best score persist locally when browser storage is available. Small screens show a desktop keyboard notice; touch driving is not implemented.

## Implementation

- React and TypeScript own the HUD, menus, and accessible native dialogs.
- Three.js renders the terrain, circuit, bosses, particles, and Blender hovercraft.
- The simulation runs at a fixed 120 Hz, independent of rendering. Spring suspension, lateral traction, drag, boost, gravity, solid ramp side/rear contacts, launch momentum, pillar collisions, vehicle contact impulses, and boundary response create the driving behavior.
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

Automated tests cover deployment camera continuity, patrol timing and crowd limits, all nine breach routes and all three road layouts, suspension, boost, drift, ramp side/rear impacts at several speeds, pillar impacts, vehicle momentum transfer, launch trajectories, complete breach routes with continuous driving inputs, gate ordering and expiry, compass wrapping, projectile kills, physical wreckage lifetime, and pause/resume during the delayed result sequence. Engine tests use real Three objects without a GPU constructor; they do not verify rendering or sound output.

With the dev server running, open `/tests/combat.html` and click **Run deterministic combat verification**. This uses the actual WebGL engine with fixed simulation steps and controlled test positions. It checks native keyboard events, patrol arrivals, environment switching, all weapons, shield gating, hostile damage, supply pickups, all three sector transitions, defeat, retry, and campaign completion. It restores the previous best score after running. The fixture is excluded from the production build. It verifies combat behavior, not human difficulty balancing.

The original interface was checked at 1280×720, 1440×900, and 390×844. The simplified driving HUD, keyboard map flow, deployment transition, distinct canyon and ash environments, outpost roads, armored reactor, and meltdown were inspected in the desktop browser. The full browser combat fixture passed. Road checks verify checkpoint alignment, launch alignment, clear scenery, and intersections of the centerline and road edges. Roads and the radar share the checkpoint-derived route. Automated driving checks prove the breach routes are physically reachable; difficulty and how satisfying they feel still benefit from human play-testing.
