// Is progress tick-independent? Loads a sim DUMP save and runs it for N hours at several tick sizes with no bot input.
// node --experimental-strip-types scripts/nodefarm/dt-check.mjs save.json [hours]   (NF_EFF=0.5 runs Drones at the offline efficiency, NF_DTS=0.1,1,12 picks tick sizes)
// Compare life bytes and presses, NOT s.bytes: s.bytes is a sawtooth that every Reboot (the Watchdog does one every few seconds) resets, so its value at the end of a run depends on where in the cycle the run stops.
import * as E from "../../lib/nodefarm/engine.ts";
import { readFileSync } from "node:fs";
const file = process.argv[2], hours = Number(process.argv[3] || 2);
for (const dt of (process.env.NF_DTS || "0.1,0.5,1,4,12,30").split(",").map(Number)) {
    const s = JSON.parse(readFileSync(file, "utf8"));
    const t0 = Date.now();
    for (let t = 0; t < hours * 3600; t += dt) E.tick(s, dt, Number(process.env.NF_EFF || 1));
    console.log("dt", String(dt).padEnd(5), "life bytes", E.fmt(s.life.bytes), "peak b/s", E.fmt(s.life.peakBps), "reboots", s.life.reboots, "presses", s.life.presses, "bytes/s", E.fmt(E.derive(s).bytesPerSec), "prod cu", E.fmt(s.prod.copper), "ae", E.fmt(s.prod.aether), `${Date.now() - t0} ms`);
}
