// Game kit: idle-game time. How a gap between two ticks is counted, and how time away is caught up in fixed steps.
// Pure and DOM-free (clocks and step functions are passed in), so the engine tests can run it.

/** Seconds between two Date.now() readings, never negative. */
export const gapSeconds = (fromMs: number, toMs: number) => Math.max(0, (toMs - fromMs) / 1000);

export type CatchUpOptions = {
    /** Most seconds one absence can pay (the game's offline cap). */
    capS: number;
    /** Most steps one catch-up may run, so a week away never freezes the page. */
    stepCap: number;
    /** Gaps shorter than this pay nothing (default 2 s). */
    minS?: number;
    /** Target step length; the real one is secs / steps (default 2 s). */
    stepS?: number;
};

/**
 * Plays `away` seconds forward in equal steps, capped at `capS`. Calls `step(dt)` for each step and returns the
 * seconds that counted (0 when the gap was too short). The same rule every idle game here uses for time away.
 */
export function catchUp(away: number, opts: CatchUpOptions, step: (dt: number, i: number, steps: number) => void): number {
    const secs = Math.max(0, Math.min(away, opts.capS));
    if (secs < (opts.minS ?? 2)) return 0;
    const steps = stepPlan(secs, opts).steps;
    const dt = secs / steps;
    for (let i = 0; i < steps; i++) step(dt, i, steps);
    return secs;
}

/** The step count and length catchUp would use for `secs`. */
export function stepPlan(secs: number, opts: Pick<CatchUpOptions, "stepCap" | "stepS">): { steps: number; dt: number } {
    const steps = Math.min(opts.stepCap, Math.max(1, Math.ceil(secs / (opts.stepS ?? 2))));
    return { steps, dt: secs / steps };
}

export type GapKind = "none" | "step" | "catchup" | "away";

/**
 * Sorts a tick gap: "step" for an ordinary frame (up to `stepMax`), "catchup" for a stall (a throttled tab), "away" when it is
 * long enough to deserve a welcome-back report (at least `awayMin`). Games pick their own thresholds.
 */
export function classifyGap(gap: number, stepMax: number, awayMin: number): GapKind {
    if (!(gap > 0)) return "none";
    if (gap <= stepMax) return "step";
    return gap >= awayMin ? "away" : "catchup";
}

/** How much of an absence counted and whether the cap cut it short. */
export function capAway(gap: number, capS: number): { secs: number; capped: boolean } {
    return { secs: Math.max(0, Math.min(gap, capS)), capped: gap > capS };
}
