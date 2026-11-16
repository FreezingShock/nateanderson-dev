# Outline and Flag Guesser: Unlimited unlocks after a daily
Date, PR, thread: 2026-11-16, PR #PENDING, "Merge daily and unlimited guesser modes"
Where: components/games/outline-guesser.tsx and flag-guesser.tsx (`unlock` key, `finish`, first-load effect); lib/creations-data.ts (hub cards)
Old -> new: Unlimited was always open. Now it opens after one finished daily (won or lost) per game, stored in localStorage (`outline-unlimited-unlocked-v1`, `flag-unlimited-unlocked-v1`). Players with daily results already on the device keep it open.
Why: Nate asked for Daily first, then Unlimited, on both guessers.
Effect on pacing: none measured; a new player's first minute is the daily.
