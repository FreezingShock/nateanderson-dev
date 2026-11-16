# Game kit

One shared kit for every game on the site, so a new idle game starts from working parts instead of copying them out of Brasswork, Starwright or Groundbreak. Two halves:

- `lib/game-kit/` is pure TypeScript: formatting, time and offline catch-up, idle math (generators, costs, milestones, prestige), settings store, toast queue, tab locks. No DOM (tabs.ts checks for the browser first), no React, and **relative imports only**, so an engine in `lib/<game>/` can import it and the node tests can run it.
- `components/game-kit/` is React: headless hooks (timing and state only, no markup) and a few styled pieces for new games, themed with CSS variables.

Tests: `tests/games/game-kit.test.mjs` (runs in `npm run test:nodefarm`). The formatter tests compare every style with the copy each game shipped, across a sweep of magnitudes, so a game that moves onto the kit prints exactly what it printed before.

The API below is stable: add to it freely, but change a signature only with every caller in the same PR.

## Imports

```ts
// React code (pages, components): everything in one import. This also loads app/camino/game-kit.css.
import { useToasts, GameWindow, formatNumber } from "@/components/game-kit";
// React code that must not load the kit CSS (the three older games): import the hook files directly.
import { usePresence, useAutosave } from "@/components/game-kit/hooks";
// Engines (lib/<game>/*.ts): relative paths, never "@/", or the node tests cannot load the engine.
import { numberFormatter, catchUp } from "../game-kit/format";
```

## Pure half: `lib/game-kit/`

### format.ts
- `formatNumber(n, style = "suffix", digits = 2)`. Styles: `suffix` (1.23K, 15.0M, up to Dc, then 1.00e40; new games), `kilo` (Groundbreak), `grouped` (1,234 then 1.50e7; Starwright), `compact` and `full` (Brasswork HUD and its Full numbers switch), `sci`, `eng`. The table at the top of the file shows each one.
- `numberFormatter(style)` returns `(n, digits?) => string`, for a game's `fmt`.
- `formatRate(n, style)` "+1.2K/s"; `formatAge(sec)` "45 s / 12 min / 3.5 h"; `formatClock(sec)` "0:07"; `formatDuration(sec)` "3m 20s"; `plural(n, one, many?)`.

### time.ts (tick gaps and time away)
- `catchUp(away, { capS, stepCap, minS = 2, stepS = 2 }, step)` plays an absence forward in equal steps, capped, and returns the seconds that counted. The engine passes its own step: `catchUp(gap, { capS: offlineCapS(f), stepCap: TUNE.offlineStepCap }, (dt) => step(s, dt, f))`.
- `stepPlan(secs, opts)`, `classifyGap(gap, stepMax, awayMin)` ("none" | "step" | "catchup" | "away"), `capAway(gap, capS)`, `gapSeconds(fromMs, toMs)`.

### idle.ts (idle and incremental math)
- Costs: `costAt(base, growth, owned)`, `costOfMany(base, growth, owned, n)`, `affordable(base, growth, owned, money)`, `timeTo(need, have, rate)`. (Nate does not want x1/x10/max buy buttons; use `costOfMany` for tiered buys like Starwright's I/II/III.)
- Multipliers: `milestoneMult(owned, thresholds, factor = 2, every = 0)`, `nextMilestone(owned, thresholds, every)`, `upgradeMult(upgrades, owned, target)` with `Upgrade = { id, target, mult }` (target "all" hits everything).
- Generators: `Generator = { id, rate, baseCost, growth }`; `stepChain(gens, counts, mults, dt)` (tier i makes tier i-1, tier 0 makes the resource; returns the resource gained), `rates(gens, counts, mults)`.
- Prestige: `prestigeGain(earned, scale, power = 0.5, claimed = 0)`, `prestigeNeed(total, scale, power)`, `prestigeProgress(earned, scale, power)`, `resetKeeping(state, fresh, keepKeys)`.

### settings.ts (per-device preferences)
- `createSettingsStore({ key, parse, storage? })` gives `{ get, set(patch), reset, subscribe, key }`. Settings live under their own key (`<game>-settings-v1`), never inside the save. `parse` must turn anything (null, old, damaged) into full valid settings.
- `pick.bool(v, d)`, `pick.oneOf(v, list, d)`, `pick.num(v, d, min, max)` for writing `parse`; `cycle(list, cur)`.

### toasts.ts
- `pushToast(list, toast, { keep, dedupe })` and `dropToast(list, id)`. Sticky toasts (warnings) are never pushed out; of the ordinary ones the newest `keep` stay. Groundbreak uses keep 1 with dedupe, Starwright keep 3.

### tabs.ts (more than one browser tab)
- `claimTab(channel, onSuperseded)` gives `{ claim, close }`: one tab plays at a time (BroadcastChannel).
- `watchNewerSave(key, mySavedAt, onNewer)`: another tab wrote a newer save, so stop saving here.

Saves themselves (format, versions, migrations, backups, export and import) are the save system's: `lib/games/save.ts` and `lib/games/save-slot.ts`. The kit only runs the save loop (`useAutosave`).

## React half: `components/game-kit/`

### hooks.ts
- `usePresence(active, ms = 120)` gives `{ mounted, leaving }`: keep a panel mounted while its exit plays.
- `useLeaving(value, ms = 260)` gives `{ shown, leaving }`: one-of-many menus, the old one leaves before the new one arrives.
- `useReducedMotion()`: the OS setting, live.
- `useCountUp(to, { ms = 650, still })`: counts 0 up to `to` for a payout. `useTween(value, { ms = 400, still })`: a live number that rolls to each new value.
- `useFlash<T>()` gives `[flash, fire(detail)]`: keyed one-shot effects (rings, washes) that restart rather than stack. `useGain(n)` gives `{ key, gained }` when `n` changes, for "+N" floats and buy bursts.
- `useInterval(fn, ms, enabled)`, `useRerender(ms = 250)` (the UI refresh over a mutable state), `useGameClock(onTick(gap, now), { ms = 100, enabled, paused })` (real-time gaps, so a throttled tab loses nothing; a pause does not pay out).
- `useAutosave(save, { everyMs = 8000, enabled, afterSave })`: saves on an interval, on tab hide and page leave, and on unmount.
- `useSettings(store, fallback)`: reads a settings store and re-renders on change.

### use-toasts.ts
- `useToasts({ keep, dedupe, ttlMs, stickyTtlMs })` gives `{ toasts, push(text, tone?, sticky?), dismiss(id) }`.

### use-window.ts
- `useWindowClose(onClose, { exitMs = 160, escape = true })` gives `{ closing, requestClose }`: play the exit, then close; Escape closes.
- `useFocusTrap(ref, enabled)`: modal focus in, Tab stays inside, focus returns on close.
- `useTabs(ids, value, onChange, prefix)` gives `{ listProps, tabProps(id), panelProps(id) }`: arrow keys, Home/End, ARIA.

### ui.tsx (styled pieces for new games)
Put class `gk` on the game root and set the palette there (CSS in `app/camino/game-kit.css`): `--gk-bg`, `--gk-ink`, `--gk-dim`, `--gk-line`, `--gk-accent`, `--gk-shade`, `--gk-font`, `--gk-mono`. Timings come from the site motion tokens, so reduced motion is handled.
- `<GameWindow open title hint? icon? onClose motion="rise|drop|iris|unroll|stamp" size="sm|md|lg" modal? footer?>`: floating window, no scrim, closes on Close, Escape or blank ground; a bottom sheet under 640px. Give each menu its own `motion`.
- `<ToastStack toasts onDismiss? placement="top-right|top|bottom">`.
- `<Tabs items={[{ id, label, icon?, badge? }]} value onChange label>{panel}</Tabs>`: square tabs, no pills.
- `<Counter value style digits mode="tween|count" prefix suffix>`: rolling number that lifts once when it rises.
- `<PressButton onPress ready hotkey tip pulse>`: lift on hover, press scale, a burst each time `pulse` rises.
- `<Burst trigger size="s|m|l">` and `<Corners />`.

## Which game uses what
- Starwright: being moved onto the kit (formatting, catch-up, settings store, toasts, presence, autosave, tab lock).
- Groundbreak: next (formatting, catch-up, toasts, presence, autosave, newer-save watch).
- Brasswork: after that (number formatting, settings, MenuWindow on useWindowClose and useFocusTrap, count-up).
- Node Farm: not moved; it is finished and deployed.
This list is updated as each game moves.
