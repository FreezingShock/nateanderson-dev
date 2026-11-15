# Starwright: a long absence pays up to three supernovas (auto supernova on)
Date: 2026-11-15. Chosen by Nate on a decision card ("Cap a few per absence"). PR: the one that adds this file.
Where: `lib/starwright/session.ts` `advanceAuto`, constants `AWAY_NOVA_CAP` (3) and `AWAY_NOVA_MIN_S` (300).
Old -> new: with auto supernova on, a 24 h absence paid one supernova, then the restarted star idled (away time buys nothing). Now, after the first supernova, each further star that the rest of the absence has room for pays the same stardust as the last one, one per max(5 min, your fastest star), up to 3 supernovas in all. With auto supernova off nothing changed: the star waits at the collapse line.
Why: the automation unlock barely paid; a few supernovas per absence rewards leaving the game without coming back to a reset one.
Effect on pacing: a day away is worth at most 3 supernovas of stardust; the stars themselves are not rebuilt (no levels are bought), so the player still starts the next star by hand. Tests in `tests/starwright/session.test.mjs`.
Nate can ask to revert it.
