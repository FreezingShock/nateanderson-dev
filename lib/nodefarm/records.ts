// Node Farm records and console commands. Pure: takes a State, returns data or printed lines. The Records window reads
// `recordSections`; the naOS console's `nf` command runs `nfCommand` against the live game (or the saved one when the game is
// not open). No React, no DOM.
import {
    GOALS, GOAL_TIERS, MATS, PERKS, SECRETS, TIER_NAMES, TREE, apOnAscend, derive, fmt, fmtTime, goalDone, statDef, tiersDone, unlock,
    type State,
} from "./engine";
import { LOGS, logNo } from "./story";

export const NF_PATH = "/creations/games/node-farm";
export const NF_SAVE_KEY = "nf-save-v1";

export interface RecordSection {
    id: string;
    title: string;
    blurb: string;
    rows: [string, string][];
}

const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const pct = (n: number) => `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}%`;

export function goalCounts(s: State) {
    const goals = GOALS.filter((g) => goalDone(s, g)).length;
    const secrets = SECRETS.filter((x) => s.ach.includes(x.id)).length;
    return { goals, goalTotal: GOALS.length, secrets, secretTotal: SECRETS.length };
}

export function recordSections(s: State): RecordSection[] {
    const d = derive(s);
    const c = goalCounts(s);
    const perkLv = PERKS.reduce((n, p) => n + s.perks[p.id], 0);
    const perkMax = PERKS.reduce((n, p) => n + p.max, 0);
    const run: [string, string][] = [
        ["Bytes", fmt(s.bytes)],
        ["Bytes per second", fmt(d.bytesPerSec)],
        ["Multipliers", fmt(s.mult)],
        ["Reboots", fmt(s.reboot)],
        ["Reboot power", `+${fmt(d.rebootStrength * 100)}% each`],
        ["Global bonus", `×${fmt(d.global)}`],
        ["Standby cap", fmtTime(d.offlineCap)],
        ["On Ascend", apOnAscend(s) > 0 ? `+${apOnAscend(s)} AP` : "not yet"],
    ];
    const life: [string, string][] = [
        ["First boot", date(s.started)],
        ["Time played", fmtTime(s.life.secs)],
        ["Buttons pressed", fmt(s.life.presses)],
        ["Bytes ever", fmt(s.life.bytes)],
        ["Peak Bytes/s", fmt(s.life.peakBps)],
        ["Reboots ever", fmt(s.life.reboots)],
        ["Ascensions", String(s.life.ascends)],
        ["AP earned", String(s.life.apTotal)],
        ["Intrusions won", String(s.life.intrusions)],
        ["Standby filled", `${s.life.capped} time${s.life.capped === 1 ? "" : "s"}`],
    ];
    const mats: [string, string][] = MATS.filter((m) => s[m] > 0 || s.prod[m] > 0).map((m) => [statDef(m).name, `${fmt(s[m])} · ${fmt(s.prod[m])} nodes · +${fmt(d.rates[m])}/s`]);
    const prog: [string, string][] = [
        ["Goals", `${c.goals} / ${c.goalTotal}`],
        ["Goal tiers", `${tiersDone(s)} / ${GOAL_TIERS}`],
        ["Secrets", `${c.secrets} / ${c.secretTotal}`],
        ["Goal bonus", `+${pct(((1 + s.ach.length * 0.02) * (1 + tiersDone(s) * 0.08) - 1) * 100)}`],
        ["Tree nodes", `${s.tree.length} / ${TREE.length}`],
        ["Perk levels", `${perkLv} / ${perkMax}`],
        ["AP unspent", String(s.ap)],
    ];
    const out: RecordSection[] = [
        { id: "run", title: "This run", blurb: "Wiped on Ascend.", rows: run },
        { id: "life", title: "Lifetime", blurb: "Survives every Ascend.", rows: life },
        { id: "prog", title: "Progress", blurb: "Goals, secrets, tree and perks.", rows: prog },
    ];
    if (mats.length) out.splice(1, 0, { id: "mats", title: "Materials", blurb: "Held, nodes and output per second.", rows: mats });
    return out;
}

// ---- console: `nf`

export interface NfLine {
    t?: string;
    a?: string;
    b?: string;
    k?: "dim" | "hi" | "err";
    go?: string;
}
const t = (text: string, k?: NfLine["k"]): NfLine => ({ t: text, k });
const row = (a: string, b: string, go?: string): NfLine => ({ a, b, go });

export const NF_SUBS = ["stats", "goals", "secrets", "logs", "open", "anim", "fs", "fullscreen"];

export interface NfResult {
    lines: NfLine[];
    /** goals or secrets this command unlocked */
    unlocked: { id: string; name: string }[];
}

/** Run one `nf` command. May change `s` (secrets only). */
export function nfCommand(s: State, args: string[]): NfResult {
    const sub = (args[0] ?? "").toLowerCase();
    const found: NfResult["unlocked"] = [];
    const secret = (id: string): NfLine[] => {
        const x = SECRETS.find((y) => y.id === id)!;
        if (!unlock(s, id)) return [t("already logged.", "dim")];
        found.push({ id, name: x.name });
        return [t(`secret found: ${x.name}`, "hi"), t("logged in Node Farm.", "dim")];
    };
    let lines: NfLine[];
    if (!sub) {
        const d = derive(s);
        const c = goalCounts(s);
        lines = [
            t("node.farm", "hi"),
            row("bytes", `${fmt(s.bytes)}  (+${fmt(d.bytesPerSec)}/s)`),
            row("reboots", fmt(s.reboot)),
            row("ascensions", `${s.life.ascends}  (${s.ap} AP)`),
            row("goals", `${c.goals}/${c.goalTotal}`),
            row("secrets", `${c.secrets}/${c.secretTotal}`),
            t("nf stats · nf goals · nf secrets · nf logs · nf open", "dim"),
        ];
    } else if (sub === "stats") {
        lines = recordSections(s).flatMap((sec) => [t(sec.title.toLowerCase(), "hi"), ...sec.rows.map(([a, b]) => row(a.toLowerCase(), b))]);
    } else if (sub === "goals") {
        lines = [];
        for (let k = 1; k <= GOAL_TIERS; k++) {
            const gs = GOALS.filter((g) => g.tier === k);
            const n = gs.filter((g) => goalDone(s, g)).length;
            lines.push(row(`${k} ${TIER_NAMES[k].toLowerCase()}`, `${n}/${gs.length}${n === gs.length ? "  done" : ""}`));
        }
        const next = GOALS.filter((g) => !goalDone(s, g)).sort((a, b) => a.tier - b.tier)[0];
        lines.push(next ? t(`next: ${next.name}. ${next.hint}`, "dim") : t("every goal done.", "dim"));
    } else if (sub === "secrets") {
        const c = goalCounts(s);
        lines = [t(`secrets ${c.secrets}/${c.secretTotal}`, "hi")];
        for (const x of SECRETS) lines.push(s.ach.includes(x.id) ? row(x.name.toLowerCase(), x.how) : row("????", x.clue));
    } else if (sub === "logs") {
        const n = Number(args[1]);
        if (args[1] && Number.isInteger(n) && n >= 1 && n <= LOGS.length) {
            const l = LOGS[n - 1];
            lines = s.logs.includes(l.id) ? [t(`LOG ${logNo(n - 1)} // ${l.title.toLowerCase()}`, "hi"), t(l.text)] : [t(`log ${logNo(n - 1)}: not recovered yet.`, "dim")];
        } else {
            lines = [t(`logs ${s.logs.length}/${LOGS.length}`, "hi")];
            LOGS.forEach((l, i) => lines.push(s.logs.includes(l.id) ? row(logNo(i), l.title.toLowerCase()) : row(logNo(i), "????")));
            lines.push(t("nf logs <number> to read one.", "dim"));
        }
    } else if (sub === "open") {
        lines = [t(`${NF_PATH}`, "dim")];
        lines[0].go = NF_PATH;
    } else if (sub === "ping") {
        const host = (args[1] ?? "").toLowerCase();
        if (host === "127.0.0.1" || host === "localhost") lines = [t("64 bytes from 127.0.0.1: time=0.001 ms"), t("that was you."), ...secret("x_loop")];
        else if (host) lines = [t(`ping: ${args[1]}: no route from the node. it only talks to itself.`, "err")];
        else lines = [t("ping what?", "err")];
    } else if (sub === "sudo") {
        lines = [t("node-01 is not in the sudoers file. this incident will be reported.", "err"), ...secret("x_sudo")];
    } else if (sub === "whoami") {
        lines = [t("node-01. one core, no clearance, and a growing farm."), ...secret("x_self")];
    } else {
        lines = [t(`nf: unknown: ${args[0]}`, "err"), t("nf stats · nf goals · nf secrets · nf logs · nf open", "dim")];
    }
    return { lines, unlocked: found };
}

/** What the game exposes to the console while it is open. */
export interface NfLive {
    s: State;
    /** call after a command changed the state, with what it unlocked */
    notify: (unlocked: { id: string; name: string }[]) => void;
}
