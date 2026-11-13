# Brasswork machine models

Voxel models for every building, in the shared format (`../format.ts`). Built from code on first use.

- `getMachineModel(id)`: drill, kiln, furnace, press, lathe, drawer, assembler, fabricator, hub, windmill, spring_winder, spring_store, orrery_4.
- `getOrreryModel(stage)`: the Sky orrery at stage 0 (foundation) to 4 (complete). `ORRERY_STAGES` has the names. Stages under way show a timber scaffold.
- `poseAt` and `wave` are re-exported from the shared `../anim.ts`.

Conventions: authored at rot 0, origin at the footprint's min corner, 10 voxels per cell. Inputs on the back (-z) with patina-rimmed hoppers; outputs on the front (+z) as brass chutes with a cream arrow on top. Every machine has a status lamp part (`lamp`) that pulses while working. Turning parts need whole-voxel pivots across their axis (the builder throws otherwise).

Contact sheets: /mnt/project-files/portfolio/automation-game/art/machines/ (renderer in `tools/`).
Tests: `tests/automation/machine-models.test.mjs`.
