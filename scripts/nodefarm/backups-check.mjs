// Checks the rolling backup rules (lib/nodefarm/backups.ts) against a fake storage: spacing, one daily per day, per-kind limits,
// the old single slot moving in, a full browser dropping the oldest first, and a restore round trip.
//   node --experimental-strip-types scripts/nodefarm/backups-check.mjs
import { readFileSync } from "node:fs";
const { registerHooks } = await import("node:module");
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const B = await import("../../lib/nodefarm/backups.ts");
const E = await import("../../lib/nodefarm/engine.ts");
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("  FAIL", m); } };
const mem = (limit = Infinity) => { const m = new Map(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { if ([...m].reduce((n, [a, b]) => n + (a === k ? 0 : b.length), 0) + v.length > limit) throw new Error("quota"); m.set(k, v); }, removeItem: (k) => m.delete(k) }; };
const code = (n) => JSON.stringify({ ...E.fresh(0), at: n, bytes: n, life: { ...E.fresh(0).life, secs: n } });
const MIN = 60e3, DAY = 864e5, t0 = new Date(2026, 10, 12, 8, 0).getTime();

{ // spacing and unchanged saves
    const st = mem();
    B.addBackup("auto", "a", code(1), { now: t0, st });
    ok(B.readBackups(st).length === 1, "first auto is taken");
    B.addBackup("auto", "b", code(2), { now: t0 + 10 * MIN, st });
    ok(B.readBackups(st).length === 1, "an auto under 30 min after the last is skipped");
    B.addBackup("auto", "c", code(3), { now: t0 + 31 * MIN, st });
    ok(B.readBackups(st).length === 2, "an auto after 30 min is taken");
    B.addBackup("auto", "d", code(3), { now: t0 + 90 * MIN, st });
    ok(B.readBackups(st).length === 2, "an auto of an unchanged save is skipped");
    B.addBackup("auto", "e", code(4), { now: t0 + 91 * MIN, st, force: true });
    ok(B.readBackups(st).length === 3, "force takes one anyway");
}
{ // limits: 4 autos, 3 dailies, 3 events
    const st = mem();
    for (let i = 0; i < 150; i++) B.addBackup("auto", "x", code(i + 1), { now: t0 + i * 35 * MIN, st }); // about 3.6 days
    for (let i = 0; i < 6; i++) B.addBackup("event", "ev", code(100 + i), { now: t0 + i, st });
    const l = B.readBackups(st);
    ok(l.filter((b) => b.kind === "auto" && !b.daily).length === 4, `4 plain autos kept (${l.filter((b) => b.kind === "auto" && !b.daily).length})`);
    ok(l.filter((b) => b.daily).length === 3, `3 dailies kept (${l.filter((b) => b.daily).length})`);
    ok(l.filter((b) => b.kind === "event").length === 3, "3 events kept");
    ok(l.every((b, i) => i === 0 || l[i - 1].at >= b.at), "newest first");
}
{ // a daily per calendar day
    const st = mem();
    for (let d = 0; d < 5; d++) B.addBackup("auto", "x", code(d + 1), { now: t0 + d * DAY, st });
    ok(B.readBackups(st).filter((b) => b.daily).length === 3, "one daily per day, newest 3");
}
{ // the old slot moves in once
    const st = mem();
    st.setItem(B.LEGACY_BACKUP_KEY, JSON.stringify({ at: 5, why: "before wipe", code: Buffer.from(code(7)).toString("base64") }));
    const l = B.readBackups(st);
    ok(l.length === 1 && l[0].kind === "event" && l[0].why === "before wipe", "legacy slot is read as an event backup");
    ok(st.getItem(B.LEGACY_BACKUP_KEY) === null && B.readBackups(st).length === 1, "and removed afterwards, not doubled");
    ok(E.parseSave(l[0].code)?.bytes === 7, "its code still restores");
}
{ // a full browser: the oldest plain entries go, events stay, nothing throws
    const st = mem(6000);
    for (let i = 0; i < 30; i++) B.addBackup("auto", "x", code(i + 1) + " ".repeat(900), { now: t0 + i * 35 * MIN, st });
    B.addBackup("event", "ev", code(999), { now: t0 + 99 * MIN, st });
    const l = B.readBackups(st);
    ok(l.length > 0 && l.some((b) => b.kind === "event"), "an event backup survives a full store");
}
{ // broken storage and junk in the list
    ok(B.addBackup("auto", "x", code(1), { st: null }).length === 0, "no storage: nothing, no throw");
    const st = mem();
    st.setItem(B.BACKUPS_KEY, "{not json");
    ok(B.readBackups(st).length === 0, "junk list reads as empty");
    st.setItem(B.BACKUPS_KEY, JSON.stringify([{ code: 1 }, null, { at: 1, kind: "auto", why: "ok", code: code(2) }]));
    ok(B.readBackups(st).length === 1, "bad rows are dropped");
}
{ // an unreadable save is kept once, and cannot be restored
    const st = mem();
    B.addBackup("lost", "could not be read", "{broken", { st });
    B.addBackup("lost", "could not be read", "{broken", { st });
    const l = B.readBackups(st);
    ok(l.length === 1 && l[0].kind === "lost", "lost save kept once");
    ok(B.backupLine(l[0]).how === "cannot be read", "and described as unreadable");
}
console.log(bad ? `${bad} problem${bad === 1 ? "" : "s"}` : "backup rules ok");
process.exit(bad ? 1 : 0);
