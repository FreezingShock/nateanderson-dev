// Pacing sim for Groundbreak. Run: node --experimental-strip-types --no-warnings scripts/groundbreak/sim.mjs [hours]
// A greedy bot (the game has no tapping): buys what it can afford every 3 s, bids the best open job, incorporates
// when the gain is worth it. Prints when each milestone lands (play time, no offline).
// GB_TUNE='{"fwd":0.3}' deep-merges over TUNE so numbers can be tried without editing the engine.
import { registerHooks } from "node:module";
registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const E = await import("../../lib/groundbreak/engine.ts");
const D = await import("../../lib/groundbreak/data.ts");
if (process.env.GB_TUNE) Object.assign(D.TUNE, JSON.parse(process.env.GB_TUNE));
// GB_ARR='{"BASE_RATE":[...]}' replaces a data array; GB_MUL='{"BASE_RATE":5}' scales one
if (process.env.GB_ARR) for (const [k, v] of Object.entries(JSON.parse(process.env.GB_ARR))) D[k].splice(0, D[k].length, ...v);
if (process.env.GB_MUL) for (const [k, v] of Object.entries(JSON.parse(process.env.GB_MUL))) for (let i = 0; i < D[k].length; i++) D[k][i] *= v;
// GB_GEO='{"unlock":[150,4],"crew":[8,2.4],"equip":[25,4.2],"rate":[1,0.9],"method":[300,5]}' rebuilds a ladder as first value x ratio^i
if (process.env.GB_GEO) {
    const g = JSON.parse(process.env.GB_GEO);
    const put = (arr, v, skip = 0) => { for (let i = skip; i < arr.length; i++) arr[i] = v[0] * Math.pow(v[1], i - skip); };
    if (g.unlock) put(D.UNLOCK_COST, g.unlock, 1);
    if (g.crew) put(D.CREW_COST, g.crew);
    if (g.equip) put(D.EQUIP_COST, g.equip);
    if (g.rate) put(D.BASE_RATE, g.rate);
    if (g.method) put(D.METHOD_COST, g.method);
}
D.rebuildJobs();
const PROBE = process.env.GB_PROBE ? JSON.parse(process.env.GB_PROBE) : []; // seconds at which to record stock of material n-1 (to calibrate UNLOCK_COST)
const probed = {};
const hours = Number(process.argv[2] || 6);
const s = E.fresh(0);
const marks = {};
const mark = (k, t) => { if (!(k in marks)) marks[k] = t; };
const INC = Number(process.env.GB_INC || 0); // incorporate when gain >= this (0 = never; firm 1 runs to the end)
let t = 0, lastBuilt = 0;
// keep the next unlock's price in the bank, as a player would
const reserve = (n) => (n === s.open - 1 && s.open < D.N ? D.UNLOCK_COST[s.open] : 0) + (s.job && s.job.step === 'build' ? 0 : 0);
const f0 = () => E.effects(s);
const T = (x) => (x / 60).toFixed(1) + "m";
while (t < hours * 3600 && !(s.ending && !INC)) {
    const f = f0();
    if (Math.floor(t) % 3 === 0 && t % 1 === 0) {
        for (let n = s.open - 1; n >= 0; n--) {
            if (E.methodReady(s, n) && E.buy(s, n, 2, f)) mark(`method ${D.MATS[n].name}`, t);
            for (let k = 0; k < 40 && E.canBuy(s, n, 1, f) && E.equipCost(s, n) < (s.amt[E.crewSrc(n)] - reserve(E.crewSrc(n))) * 0.6; k++) E.buy(s, n, 1, f);
            for (let k = 0; k < 60 && E.canBuy(s, n, 0, f) && E.crewCost(s, n, f) < Math.max(0, s.amt[E.crewSrc(n)] - reserve(E.crewSrc(n))); k++) E.buy(s, n, 0, f);
        }
        while (E.canUnlock(s, s.open)) { E.unlock(s, s.open); mark(`open ${D.MATS[s.open - 1].name}`, t); }
        if (E.overtimeCost(s) && E.overtimeCost(s) < s.cash * 0.05) E.overtime(s);
        if (s.change) E.acceptChange(s);
        if (INC && s.ending && E.charterGain(s, f) >= INC) { mark(`firm ${s.firm + 1} done`, t); E.incorporate(s); for (const p of D.PERKS.slice().sort((a, b) => a.cost - b.cost)) E.buyPerk(s, p.id); }
        if (s.built >= 1) mark("first job", t);
        mark(`stage ${E.stageOf(s)}`, t);
        if (s.built !== lastBuilt) { lastBuilt = s.built; mark(`job ${s.built} ${D.jobAt(s.built - 1).name}`, t); }
        if (s.ending) mark("ENDING", t);
    }
    if (process.env.GB_TRACE && t % (Number(process.env.GB_TRACE) * 60) === 0) console.log(T(t).padStart(7), s.amt.slice(0, s.open).map(E.fmt).join(' '), '|', s.crews.slice(0, s.open).join(','), '|', s.equip.slice(0, s.open).join(','), '| $' + E.fmt(s.cash), s.job ? s.job.id + ':' + s.job.step + ':' + E.fmt(s.job.phase) : 'idle');
    for (let n = 1; n < PROBE.length; n++) if (t === PROBE[n] * 60) probed[n] = s.amt[n - 1];
    E.step(s, 1, f);
    t += 1;
}
if (process.env.GB_PROBE) console.log('PROBE ' + JSON.stringify(probed));
if (process.env.GB_BRIEF) console.log(Object.entries(marks).filter(([k]) => /^(open|ENDING|job 13|method)/.test(k)).map(([k, v]) => `${k.replace('open ', '')} ${Math.round(v / 60)}`).join(' | '));
else for (const [k, v] of Object.entries(marks)) console.log(T(v).padStart(8), k);
if (process.env.GB_JOB && s.job) console.log(JSON.stringify(s.job), E.rawRate(s, 11, E.effects(s), E.chain(s)), s.flow?.map((v)=>v.toExponential(1)).join(' '));
if (process.env.GB_DUMP) console.log(s.amt.map(E.fmt).join(' '), s.crews.join(','), s.equip.join(','));
console.log(`t=${T(t)} firm=${s.firm + 1} open=${s.open} built=${s.built} rep=${E.fmt(s.rep)} cash=${E.fmt(s.cash)} charter=${s.charter}/${s.charterAll} ending=${s.ending}`);
