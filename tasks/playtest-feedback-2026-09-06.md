# Vector Wars: simulated playtest feedback

Date: 2026-09-06

## Method and evidence

Three independent subagents reviewed driving/navigation, cockpit usability, and combat/progression. They inspected the current implementation and existing tests; browser observations used separate local-game tabs. This is a simulated expert playtest, not research with recruited players. No real-user interviews, participant sample, or usability statistics were collected.

Evidence below distinguishes live browser observations from code-derived behavior and design hypotheses. The two stationary-run observations are individual sessions, not representative survival or damage measurements. Existing deterministic tests establish mechanical reachability and correctness; they do not establish that unfamiliar players understand the routes or find the game enjoyable.

User preferences remain constraints: segmented meters, stable telemetry width, a closer chase camera, and an always-visible minimap. Preserve these while improving comprehension and expanding combat.

## Findings

### 1. Initial driving direction conflicts with the first objective — high priority

**Observed:** After deployment, the craft faces north toward a prominent ramp and a road bending forward/right. The Dustworks Gate 01 indicator points behind-left, 564 m away.

**Code evidence:** The initial route leaves `(0, 125)` toward `(-110, 190)`, while vehicle heading starts at zero. The visual invitation to drive ahead therefore disagrees with the intended approach.

**Improvement:** Derive the starting heading from the outgoing road tangent and retain a seamless deployment camera transition. Verify each world's initial direction, not just the wasteland.

### 2. The selected mission can change without player intent — high priority

**Code evidence:** Before a timed breach is active, navigation selects the nearest living relay on each snapshot refresh and then points at that relay's current gate. Travelling north along `x = 0` changes the nearest relay from Dustworks to Switchback around `z = -125`, without a completed objective or explicit selection. This switch was inferred from the positions and selection logic, not reproduced through a sustained browser drive.

**Improvement:** Keep the selected mission until completion or an explicit change. Add a visible keyboard affordance, `T`, for selecting the next objective. An active timed breach should retain navigation priority.

### 3. The minimap and breach instructions do not sufficiently explain the next manoeuvre — high priority

**Observed:** The compact and expanded maps show the full thin road network without a highlighted travel direction. The active gate and boss use similar amber diamonds, and the legend does not explain those markers. In one expanded-map screenshot, the active gate overlapped a moving convoy icon. Expanding with `M` correctly retained live gameplay.

**Code/UI review:** Guidance changes to the next individual gate, but does not provide a compact, anticipatory `01 → 02 → JUMP` sequence. A missed airborne coupler does not clearly distinguish insufficient speed, insufficient height, or missing the gate; the eventual timeout is less useful for correcting the attempt.

**Improvement:** Show a compact breach sequence with the current stage and jump requirements. Give specific, timely failure feedback so the player knows what to change. A highlighted approach and distinct active-gate marker remain useful navigation follow-ups.

### 4. Launch-area pressure interrupts learning — high priority

**Observed:** The driving reviewer deployed, remained stationary while inspecting the interface, and lost the craft at `00:49`. The UI reviewer separately reported hull at 85% after 37 seconds without movement input, including an unplanned 19 km/h speed reading. The precise cause of that movement was not isolated in the browser session.

**Code evidence:** The first patrol region is approximately 128 m from spawn, within its 225 m activation radius, and can activate after five seconds. This creates combat pressure before the player has chosen to set off.

**Improvement:** Protect the launch state until the player applies throttle or fires. Once the player engages, normal encounter pacing should resume. This should protect the initial reading period without turning the minimap into a pause screen.

### 5. World differences do not yet extend far enough into combat — high priority

**Code review:** Bosses share the same five-shot fan pattern. Drone behaviour largely uses the same orbiting role. These are implementation findings; reviewers did not complete controlled live comparisons of every boss.

**Improvement:** Give each boss a distinct attack pattern with a readable warning and a corresponding driving response. This is the accepted combat expansion for this pass. More enemy roles can follow after the boss patterns are verified.

### 6. Weapon and convoy choices need stronger incentives — balancing follow-up

**Code-derived comparison:** The combat reviewer estimated raw laser damage at approximately 217 damage/second and missile damage at approximately 192 damage/second. These figures omit practical hit rates, homing, target movement, ammunition limits, and other encounter conditions; they are not measured combat effectiveness.

**Code/UI review:** Optional convoy cargo mainly restores resources also available from free caches. Its reward is not sufficiently clear before interception. The chase may therefore feel less worthwhile than bypassing it.

**Hypotheses to test:** Missiles could have an explicit anti-armour role. Cargo could offer a distinct reward rather than duplicating ordinary supply caches. The anti-armour role was implemented after a stationary-fire regression confirmed bosses could die before their opening attacks arrived. Exclusive cargo rewards remain deferred.

### 7. Meltdown instructions imply a hazard that is not present — clarity follow-up

**Code review:** The instruction to keep moving during reactor meltdown implies an escape requirement, but the reviewed aftermath sequence does not implement a corresponding damaging hazard.

**Improvement options:** Align the instruction with the cinematic sequence, or later add a clearly telegraphed escape mechanic. Do not imply that an unimplemented hazard has been added.

## Accepted implementation scope for this pass

- Protect launch until throttle or firing input.
- Align spawn heading with the outgoing route while preserving the closer camera and smooth deployment.
- Keep mission selection stable and provide `T` to select the next objective.
- Add compact breach-stage guidance and specific coupler-miss feedback.
- Differentiate bosses through telegraphed attacks that require different driving responses.

These priorities are implemented. The active gate now has a numbered marker, convoy rewards are labeled, and meltdown copy no longer suggests a damaging escape phase. Follow-up combat review led to pulse-resistant boss/transport armor and faster boss shots, with the charge warnings retained. Visual checks led to clearing pillars within 150 m of each boss.

## Deferred balancing and expansion

- Further weapon damage/ammunition balance after human playtesting.
- A distinct convoy cargo reward; the current repair/ammo benefit is now labeled.
- A ramming enemy role to complement orbiting drones.
- Further route highlighting and a possible escape mechanic during meltdown.

## Validation plan

1. Verify that a fresh deployment remains protected without throttle or firing, that those inputs activate normal combat, and that restart and sector changes restore the expected launch state.
2. Check the outgoing route heading in all three worlds. Inspect deployment and settled chase views in the browser for continuity and useful visibility.
3. Verify that crossing nearest-relay boundaries does not change the selected objective; test `T`, completion, active-breach priority, and destroyed-objective handling.
4. Exercise the complete `01 → 02 → JUMP` sequence, low-speed and low-height misses, and timeout/reset behaviour. Confirm that messages explain the failure without obscuring the current task or repeating every frame.
5. Verify each boss's warning, attack timing, damage windows, and intended escape response. Check pause/resume, defeat, and victory so attacks cannot continue incorrectly across phase changes.
6. Re-run existing physics, road geometry, mission, convoy, and combat regressions, then production build. Inspect the real desktop HUD and retain fixed telemetry dimensions, segmented bars, the closer camera, and the permanent minimap.

## Limitations

Browser sessions were brief and did not provide a complete human-driven campaign or controlled weapon comparison. Source analysis can identify contradictory rules and missing feedback, but cannot establish comfort, difficulty, or replay value. A subsequent session with actual players should focus on finding the first gate without explanation, understanding a failed coupler attempt, choosing whether to chase cargo, and recognizing how to evade each boss.

## Verification outcome

All 100 automated tests and the production build pass. The automated suite covers launch protection for 60 simulated seconds, route headings for all worlds, stable and explicit mission selection, coupler retry reasons, all three attack directors, shockwave jump clearance, pause/aftermath cleanup, and a full-health Sentinel that threatens a stationary laser-firing craft before dying. The real browser campaign fixture passed through all sectors. Main-agent browser checks verified the protected launch, T selection, persistent minimap, breach guide, and rendered sweep/pulse effects. This is correctness and visual evidence, not a claim that difficulty or enjoyment has been validated with people.
