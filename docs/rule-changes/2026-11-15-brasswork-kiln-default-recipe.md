# Brasswork: a new kiln starts on Iron ingot
Date: 2026-11-15. Chosen by Nate on a decision card (thread "Polish Brasswork rewards and first minutes").
- A newly placed kiln has the Iron ingot recipe already set (`place` in `lib/automation/sim/world.ts`). It used to start with no recipe and do nothing until picked in the inspector.
- Why: the first minutes. A newcomer had to find the inspector before the kiln worked. The recipe can still be changed.
- Balance numbers are unchanged. The NEXT banner's "pick the kiln recipe" step now only shows for a kiln whose recipe was cleared.
