// The pacing model walks every request and milestone through the recipe tree (scripts/automation/pacing-model.mjs).
// These checks are the soft-lock guard: if a balance edit leaves a milestone impossible to reach, this fails.
import test from "node:test";
import assert from "node:assert/strict";
import { analyse } from "../../scripts/automation/pacing-model.mjs";

test("every hub request and milestone can be reached: machines open in time, research is paid for by earlier blueprints", () => {
    const r = analyse({ drills: 1, machines: 1 });
    assert.deepEqual(r.problems, []);
    assert.equal(r.rows.length, 5, "all five milestones are modelled");
});

test("idealised time never drops as milestones pile up, and more machines never slow it", () => {
    const slow = analyse({ drills: 1, machines: 1 }).rows;
    const fast = analyse({ drills: 2, machines: 4 }).rows;
    for (let i = 1; i < slow.length; i++) assert.ok(slow[i].minutes >= slow[i - 1].minutes, `${slow[i].milestone} is not faster than the one before`);
    slow.forEach((row, i) => assert.ok(fast[i].minutes <= row.minutes + 1e-9, `${row.milestone}: more machines is not slower`));
    for (const row of slow) assert.ok(Number.isFinite(row.minutes) && row.minutes > 0, row.milestone);
});
