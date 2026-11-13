// Frame-budget governor. It watches real frame intervals and steps the quality level down when
// the average runs over budget, and back up when there is clear headroom. Hysteresis and a cooldown
// keep it from oscillating.
export class FrameGovernor {
  private readonly window = 60;
  private readonly samples: number[] = [];
  private cooldownMs = 0;
  private sinceChange = 0;

  constructor(
    private budgetMs: number,
    public level: number,
    private readonly minLevel: number,
    private readonly maxLevel: number,
  ) {}

  setBudget(ms: number): void {
    this.budgetMs = ms;
  }

  /** Feed one frame interval. Returns the new level when it changes, otherwise null. */
  observe(frameMs: number): number | null {
    this.samples.push(frameMs);
    if (this.samples.length > this.window) this.samples.shift();
    this.sinceChange += frameMs;
    if (this.samples.length < this.window || this.sinceChange < this.cooldownMs) return null;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    if (avg > this.budgetMs * 1.12 && this.level > this.minLevel) return this.change(this.level - 1);
    if (avg < this.budgetMs * 0.7 && this.level < this.maxLevel) return this.change(this.level + 1);
    return null;
  }

  private change(next: number): number {
    this.level = next;
    this.samples.length = 0;
    this.sinceChange = 0;
    this.cooldownMs = 4000;
    return next;
  }
}
