# Vector Wars: outpost combat pass

The user requests real collisions, coherent scenery, combat feedback, delayed victory, a correct compass, and a larger world with useful traversal.

1. Shared world and collision definitions. Replace ramp height teleportation with solid wedge side/rear contacts and top support. Add pillar and vehicle separation impulses. Verify low/high-speed and elevated contacts.
2. Expand the world to separated outposts with connected roads. A timed three-gate breach run ends with an airborne shield coupler; completing it opens that outpost's relay. Travel, evasion, boost and drift now serve progression. Keep supplies and visible navigation cues.
3. Combat feedback and aftermath. Hit confirmations, directional hull flashes, tracer/explosion effects, tumbling wreckage, and a multi-stage reactor collapse before victory. Pause must preserve the sequence.
4. Consistent presentation. Replace the checker sphere with an armored reactor, reduce the sun, derive compass ticks from heading, and update radar and mission UI for the larger map.
5. Regression and browser verification. Test geometry contacts, breach sequencing, combat shield gating and delayed victory. Inspect actual desktop gameplay and documented limits.

No dependency migration or publication is needed. Existing Afterglow components remain the UI foundation.

## Deployment and sector follow-up

Keep the vehicle at its actual driving pose and ease the camera into chase position on deployment. Add announced, paced patrol arrivals along travel routes. Give each sector its own terrain, road network, outposts, palette, and landmarks. Reduce the driving HUD to immediate controls and next action, move navigation details into a keyboard-accessible map, and read the compass heading each display frame. Verify all nine breach routes, each road layout, real-engine campaign progression, and desktop presentation.
