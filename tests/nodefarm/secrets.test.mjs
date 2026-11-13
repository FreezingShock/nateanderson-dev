// Every hidden console secret is reachable from `nf`, unlocks exactly once, and reveals its operator log.
import test from "node:test";
import assert from "node:assert/strict";
import { E, LOGS } from "./helpers.mjs";

// after helpers.mjs has registered the .ts resolver
const { nfCommand } = await import("../../lib/nodefarm/records.ts");

const CONSOLE = [
    ["x_help", ["man"]],
    ["x_strict", ["set", "-e"]],
    ["x_sysctl", ["sysctl"]],
    ["x_su", ["su"]],
    ["x_dmesg", ["dmesg"]],
    ["x_tree", ["tree"]],
    ["x_urandom", ["cat", "/dev/urandom"]],
    ["x_epoch", ["date"]],
    ["x_dig", ["dig"]],
    ["x_pid", ["ps"]],
    ["x_top", ["top"]],
    ["x_flash", ["flash"]],
    ["x_sun", ["sun"]],
    ["x_nohup", ["nohup"]],
];

test("console secrets: each command unlocks its secret once, and the matching log comes back", () => {
    for (const [id, args] of CONSOLE) {
        const s = E.fresh(0);
        const first = nfCommand(s, args);
        assert.deepEqual(first.unlocked.map((x) => x.id), [id], `${args.join(" ")} unlocks ${id}`);
        assert.ok(s.ach.includes(id), `${id} is stored on the save`);
        const again = nfCommand(s, args);
        assert.equal(again.unlocked.length, 0, `${id} only unlocks once`);
        assert.ok(LOGS.some((l) => l.test.toString().includes(id)), `${id} has an operator log`);
    }
});

test("secret names are unique (no duplicate Night shift or Long haul)", () => {
    const names = E.SECRETS.map((x) => x.name.toLowerCase());
    assert.equal(new Set(names).size, names.length, names.join(", "));
});

test("the 14 new stage secrets are one per tier, and every tier has a log that waits on them", () => {
    const newIds = E.SECRETS.filter((x) => /^x_(help|strict|sysctl|su|dmesg|tree|urandom|epoch|dig|pid|top|flash|sun|nohup)$/.test(x.id)).map((x) => x.id);
    assert.equal(newIds.length, 14);
    for (const id of newIds) {
        const s = E.fresh(0);
        s.ach.push(id);
        assert.ok(LOGS.some((l) => l.test(s) && !l.test(E.fresh(0))), `${id} reveals a log`);
    }
});

test("bonus weight: a stage secret counts half a goal, every other goal or secret counts whole", async () => {
    const { achPoints } = E;
    const s = E.fresh(0);
    assert.equal(achPoints(s), 0);
    s.ach.push("tap10", "x_loop");
    assert.equal(achPoints(s), 2);
    s.ach.push("x_help", "x_flash");
    assert.equal(achPoints(s), 3, "two stage secrets add 1 between them");
});
