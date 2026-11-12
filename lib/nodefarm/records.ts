// Node Farm records and console commands. Pure: takes a State, returns data or printed lines. The Records window reads
// `recordSections`; the naOS console's `nf` command runs `nfCommand` against the live game (or the saved one when the game is
// not open). No React, no DOM.
import { SCRIPTS, auto, isOn, learnPart, scriptNext, scriptOpen } from "./scripts";
import { OPERATORS, archiveOf, loadSeen, pickNews } from "./news";
import {
    GOALS, GOAL_TIERS, LAB, MATS, PAYLOADS, PERKS, SECRETS, TIER_NAMES, TREE, TREE_FULL, apOnAscend, intelRate, derive, fmt, fmtTime, goalDone, statDef, tiersDone, unlock,
    FW, PROTOS, ROMAN, handSeen, keysOnHandover, protoDef, protoRank,
    type State,
} from "./engine";
import { LOGS, logNo } from "./story";
import { zeTitle, zoneLabel } from "./zoneevents";
import { ENTRIES, unlocked as unlockedEntries } from "./codex";

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
        ["Quick-time events won", String(s.life.intrusions)],
        ["Standby filled", `${s.life.capped} time${s.life.capped === 1 ? "" : "s"}`],
    ];
    const mats: [string, string][] = MATS.filter((m) => s[m] > 0 || s.prod[m] > 0).map((m) => [statDef(m).name, `${fmt(s[m])} · ${fmt(s.prod[m])} nodes · +${fmt(d.rates[m])}/s`]);
    const prog: [string, string][] = [
        ["Goals", `${c.goals} / ${c.goalTotal}`],
        ["Goal tiers", `${tiersDone(s)} / ${GOAL_TIERS}`],
        ["Secrets", `${c.secrets} / ${c.secretTotal}`],
        ["Goal bonus", `+${pct(((1 + s.ach.length * 0.02) * (1 + tiersDone(s) * 0.08) - 1) * 100)}`],
        ["Tree nodes", `${s.tree.length} / ${TREE_FULL}`],
        ["Perk levels", `${perkLv} / ${perkMax}`],
        ["AP unspent", String(s.ap)],
    ];
    const out: RecordSection[] = [
        { id: "run", title: "This run", blurb: "Wiped on Ascend.", rows: run },
        { id: "life", title: "Lifetime", blurb: "Survives every Ascend.", rows: life },
        { id: "prog", title: "Progress", blurb: "Goals, secrets, tree and perks.", rows: prog },
    ];
    if (s.ze?.seen) {
        const log = s.ze.log ?? [];
        const rows: [string, string][] = [["Seen", `${s.ze.seen}`], ...[...log].reverse().map((e): [string, string] => [zeTitle(e.kind, e.zone), `${zoneLabel(e.zone)}, ${fmtTime(Math.max(0, s.life.secs - e.at))} ago`])];
        out.push({ id: "zev", title: "Zone events", blurb: "The last dozen, newest first.", rows });
    }
    if (mats.length) out.splice(1, 0, { id: "mats", title: "Materials", blurb: "Held, nodes and output per second.", rows: mats });
    if (s.lab.seen) out.push({ id: "lab", title: "Exploit Lab", blurb: "Research and stock survive Ascend; Intel does not.", rows: [
        ["Intel", `${fmt(s.lab.intel)} · +${fmt(intelRate(s, d.bytesPerSec))}/s`],
        ["Research", `${s.lab.nodes.length} / ${LAB.length}`],
        ["Payloads", `${PAYLOADS.filter((p) => s.lab.nodes.includes(`rx_${p.id}`)).length} / ${PAYLOADS.length}`],
        ["Intel, lifetime", fmt(s.life.intel)],
        ["Payloads compiled", fmt(s.life.compiled)],
        ["Payloads deployed", fmt(s.life.deployed)],
    ] });
    if (handSeen(s)) out.push({ id: "hand", title: "Handover", blurb: "Keys and Firmware survive every Handover. Your notes for the next operator are kept here.", rows: [
        ["Handovers", fmt(s.hand.count)],
        ["Keys held", `${fmt(s.hand.keys)} · ${fmt(s.hand.keysTotal)} earned`],
        ["Firmware", `${s.hand.fw.length} / ${FW.length}`],
        ["Protocol", s.hand.proto ? `${protoDef(s.hand.proto).op}, ${protoDef(s.hand.proto).name}${s.hand.proto2 ? ` + ${protoDef(s.hand.proto2).op}` : ""}` : "none yet"],
        ["Protocol ranks", PROTOS.map((p) => `${p.op} ${ROMAN[protoRank(s, p.id)] || "-"}`).join(" · ")],
        ["Next Handover", keysOnHandover(s) ? `+${keysOnHandover(s)} Keys` : "reach node zero"],
        ...s.hand.notes.slice(-5).reverse().map((n) => [`Note, cycle ${n.n}`, n.text] as [string, string]),
    ] });
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

export const NF_SUBS = ["stats", "goals", "secrets", "logs", "archive", "news", "open", "codex", "anim", "fs", "fullscreen", "art", "core", "admin"];

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
            ...(handSeen(s) ? [row("handovers", `${s.hand.count}  (${s.hand.keys} keys)`)] : []),
            t("nf stats · nf goals · nf secrets · nf logs · nf news · nf lab · nf handover · nf cron · nf archive · nf codex · nf open", "dim"),
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
    } else if (sub === "codex") {
        const open = unlockedEntries(s);
        const q = args.slice(1).join(" ").toLowerCase();
        const e = q ? open.find((x) => x.id === q || x.title.toLowerCase() === q) : undefined;
        if (e) {
            lines = [t(e.title.toLowerCase(), "hi")];
            for (const b of e.body(s)) {
                if ("p" in b) lines.push(t(b.p));
                else if ("note" in b) lines.push(t(b.note, "dim"));
                else if ("rows" in b) b.rows.forEach(([k, v]) => lines.push(row(k.toLowerCase(), v)));
                else b.list.forEach(([k, v]) => lines.push(row(k.toLowerCase(), v)));
            }
        } else {
            lines = [t(`codex ${open.length}/${ENTRIES.length}`, "hi"), ...open.map((x) => row(x.id, x.title.toLowerCase()))];
            lines.push(t(q ? `no codex entry: ${q}. nf codex <name> reads one.` : "nf codex <name> reads one. press C in the game for the window.", q ? "err" : "dim"));
        }
    } else if (sub === "archive") {
        const seen = loadSeen();
        const who = OPERATORS.find((o) => o.id === (args[1] ?? "").toLowerCase());
        if (who) {
            const msgs = archiveOf(who.id, seen);
            lines = [t(`${who.id} // ${who.about.toLowerCase()}`, "hi")];
            msgs.forEach((m, i) => lines.push(m.seen ? row(String(i + 1).padStart(2, "0"), m.text) : row(String(i + 1).padStart(2, "0"), "????")));
            lines.push(t("messages show up in the feed as you progress. each one you see is kept here.", "dim"));
        } else {
            lines = [t("operators of node-01 (all gone)", "hi")];
            for (const o of OPERATORS) lines.push(row(o.id, `${archiveOf(o.id, seen).filter((m) => m.seen).length}/${archiveOf(o.id, seen).length}  ${o.about.toLowerCase()}`));
            lines.push(t("nf archive <name> to read what you have found of one.", "dim"));
        }
    } else if (sub === "news") {
        const p = pickNews(s, []);
        lines = p ? [t(p.k === "past" ? `${p.op}@node01 > ${p.text}` : p.text)] : [t("no news.", "dim")];
    } else if (sub === "open") {
        lines = [t(`${NF_PATH}`, "dim")];
        lines[0].go = NF_PATH;
    } else if (sub === "ping") {
        const host = (args[1] ?? "").toLowerCase();
        if (host === "127.0.0.1" || host === "localhost") lines = [t("64 bytes from 127.0.0.1: time=0.001 ms"), t("that was you."), ...secret("x_loop")];
        else if (host === "node-00") lines = [t("no reply from node-00. it answers last."), ...secret("x_zero")];
        else if (host) lines = [t(`ping: ${args[1]}: no route from the node. it only talks to itself.`, "err")];
        else lines = [t("ping what?", "err")];
    } else if (sub === "sudo") {
        lines = [t("node-01 is not in the sudoers file. this incident will be reported.", "err"), ...secret("x_sudo")];
    } else if (sub === "lab") {
        if (!s.lab.seen) lines = [t("~/lab: no such directory. it decrypts with Silicon.", "err")];
        else {
            const run = s.lab.run.filter((r) => r.left > 0);
            const stock = PAYLOADS.filter((p) => (s.lab.stock[p.id] ?? 0) > 0);
            lines = [
                t("exploit lab", "hi"),
                row("intel", `${fmt(s.lab.intel)}  (+${fmt(intelRate(s))}/s)`),
                row("research", `${s.lab.nodes.length}/${LAB.length}`),
                row("running", run.length ? run.map((r) => `${r.id} ${fmtTime(r.left)}`).join(", ") : "nothing"),
                row("queue", s.lab.queue.length ? s.lab.queue.map((q) => q.id).join(", ") : "idle"),
                row("stock", stock.length ? stock.map((p) => `${p.id} x${s.lab.stock[p.id]}`).join(", ") : "empty"),
                ...(s.lab.armed.length ? [row("armed", s.lab.armed.join(", "))] : []),
            ];
        }
    } else if (sub === "handover") {
        if (!handSeen(s)) lines = [t("handover: node zero is further down. keep going.", "err")];
        else {
            const k = keysOnHandover(s);
            lines = [
                t("handover", "hi"),
                row("handovers", fmt(s.hand.count)),
                row("keys", `${fmt(s.hand.keys)} held, ${fmt(s.hand.keysTotal)} earned`),
                row("firmware", `${s.hand.fw.length}/${FW.length}`),
                row("protocol", s.hand.proto ? `${protoDef(s.hand.proto).op.toLowerCase()} (${protoDef(s.hand.proto).name.toLowerCase()})` : "none"),
                row("ranks", PROTOS.map((p) => `${p.op.toLowerCase()} ${ROMAN[protoRank(s, p.id)] || "-"}`).join("  ")),
                row("next", k ? `+${k} keys, ready` : "start Origin production"),
                ...s.hand.notes.slice(-3).reverse().map((n) => row(`cycle ${n.n}`, n.text)),
            ];
        }
    } else if (sub === "cron" || sub === "crontab") {
        const a = auto(s);
        lines = [t(`crontab -l  // ${a.own.length}/${SCRIPTS.length} scripts learned`, "hi")];
        for (const x of SCRIPTS) {
            const state = a.own.includes(x.id) ? (isOn(s, x.id) ? "running" : "stopped") : scriptOpen(s, x.id) ? `recording ${Math.floor(learnPart(s, x.id) * 100)}%` : "encrypted";
            lines.push(row(x.file, `${state}${a.ran[x.id] ? `  · ${fmt(a.ran[x.id]!)} runs` : ""}`));
        }
        const nx = scriptNext(s);
        lines.push(t(nx ? `next: ${nx.text}` : "every script is learned and running.", "dim"));
    } else if (sub === "fork") {
        lines = [t(":(){ :|:& };:"), t("fork: retry: Resource temporarily unavailable", "err"), t("the node copied itself 4,096 times, then everyone calmed down."), ...secret("x_fork")];
    } else if (sub === "rm" && args.join(" ").toLowerCase().includes("-rf /")) {
        lines = [t("rm: cannot remove '/': it is not your node to delete.", "err"), t("the operators before you tried.", "dim"), ...secret("x_rm")];
    } else if (sub === "kill") {
        lines = [t("kill: the drone is not listening. it never was."), ...secret("x_kill")];
    } else if (sub === "whoami") {
        lines = [t("node-01. one core, no clearance, and a growing farm."), ...secret("x_self")];
    } else {
        lines = [t(`nf: unknown: ${args[0]}`, "err"), t("nf stats · nf goals · nf secrets · nf logs · nf news · nf lab · nf handover · nf cron · nf archive · nf codex · nf open", "dim")];
    }
    return { lines, unlocked: found };
}

/** What the game exposes to the console while it is open. */
export interface NfLive {
    s: State;
    /** call after a command changed the state, with what it unlocked */
    notify: (unlocked: { id: string; name: string }[]) => void;
    /** call after admin tools rewrote the state: redraws, saves and keeps the unlock banners quiet */
    changed?: () => void;
}
