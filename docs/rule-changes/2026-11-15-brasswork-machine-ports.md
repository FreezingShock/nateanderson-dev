# Brasswork: machines have real ports (in at the back, out at the front)

Nate chose this on 2026-11-15 ("Make ports real: in back, out front") in the thread "Make Brasswork build mode obvious".

**Old:** drills, kilns, furnaces, presses and every other crafter took items from belts on any side and pushed items into any belt, crate or machine around them.

**New:** a crafter takes items only through its back edge (the side opposite its facing) and pushes only through its front edge (the side it faces). A drill pushes only through its front edge. The hub, docks, crates and logistics pieces are unchanged. Rotation 0 faces +z, 1 faces +x, 2 faces -z, 3 faces -x, so the models' back hoppers and front chutes now match the rule.

**Where:** `edgeCells`, `accept` (crafter case), `allowedPort` and `hasOutputNeighbour` in `lib/automation/sim/world.ts`; `autoRoute` in `lib/automation/sim/grid.ts` starts routes on a machine's front edge and ends them on the back edge of the machine they feed.

**Why:** arrows beside a machine can only tell the truth if the rule has sides. It also makes layouts read like a factory.

**Effect on saves:** factories built before this change keep their machines' rotations. A machine whose belts touch its sides will stop moving items until it is turned (R, or Rotate in its pop-up) or re-routed. Tests that placed machines with rotation 0 were turned east, and the hand-built stage 2 layout (`scripts/automation/stage2-hand-layout.mjs`) was rebuilt around the ports; it still clears milestones 1 and 2 well inside fifteen minutes.
