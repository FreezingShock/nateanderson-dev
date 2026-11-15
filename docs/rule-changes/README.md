# Rule changes

One file per change to a game's balance or rules, named `YYYY-MM-DD-<game>-<slug>.md`. New file per change, so nothing conflicts. The coordinator reads these to tell Nate what changed.

Template:
```
# <Game>: <what changed>
Date, PR, thread:
Where: file and constant or table
Old -> new:
Why:
Effect on pacing (if measured):
```
Keep it to a few lines. Nate can ask to revert any of them.
