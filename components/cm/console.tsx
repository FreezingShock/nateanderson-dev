"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { allGames, GAME_STATUS, PROJECT_LINKS } from "@/lib/creations-data";
import { skills, SKILL_CATEGORIES, type SkillCategory } from "@/lib/about-data";
import { NOW_FEED, PATH, PROFILE_LEAD } from "@/lib/identity";
import { launcherLinks, navItems } from "@/lib/nav";
import { navigateWithCurtain } from "@/lib/motion/navigate";
import { setPrefs } from "@/lib/sound/engine";
import { sfx } from "@/lib/sound/sounds";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import "./console.css";

// The naOS command console. Everything it prints comes from data the site already ships: lib/nav.ts, lib/identity.ts,
// lib/about-data.ts, lib/creations-data.ts. Nothing is written here that is not already on a page.

/** One printed line. `a`/`b` make a two-column row; `go` makes the row a link to a page. */
interface Line {
    t?: string;
    a?: string;
    b?: string;
    k?: "dim" | "hi" | "err";
    go?: string;
}
interface Entry {
    id: number;
    cmd?: string;
    lines: Line[];
}

const t = (text: string, k?: Line["k"]): Line => ({ t: text, k });
const row = (a: string, b: string, go?: string): Line => ({ a, b, go });

const slug = (s: string) =>
    s
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

// ---- Places ---------------------------------------------------------------------------------------------------------

interface Target {
    id: string;
    label: string;
    href: string;
    group: "pages" | "projects" | "games" | "sections";
    hint: string;
    keys: string[];
}

const PROJECT_NAMES: [string, string][] = [
    ["nexus", "Nexus"],
    ["deepstack", "Deepstack"],
    ["sfvos", "sfvOS"],
];

const bare = (url: string) => url.replace(/^https?:\/\//, "");

function buildTargets(): Target[] {
    const out: Target[] = [];
    const seen = new Set<string>();
    const add = (label: string, href: string, group: Target["group"], hint: string, extra: string[] = []) => {
        if (seen.has(href)) return;
        seen.add(href);
        out.push({ id: slug(label), label, href, group, hint, keys: [slug(label), slug(href), ...extra.map(slug)] });
    };
    for (const n of navItems) add(n.label, n.href, "pages", n.blurb, [n.title]);
    for (const [s, name] of PROJECT_NAMES) {
        const link = PROJECT_LINKS[s];
        add(name, `/creations/${s}`, "projects", link ? bare(link.href) : "");
    }
    for (const g of allGames()) {
        if (g.href) add(g.title, g.href, "games", GAME_STATUS[g.status].label);
    }
    for (const l of launcherLinks) add(l.label, l.href, "sections", l.group);
    for (const n of navItems) for (const c of n.children ?? []) add(c.label, c.href, "sections", n.title);
    return out;
}

type Found = { hit: Target } | { many: Target[] } | null;

function resolve(targets: Target[], q: string): Found {
    const s = slug(q);
    if (!s) return null;
    const exact = targets.filter((x) => x.keys.includes(s));
    if (exact.length) return { hit: exact[0] };
    const starts = targets.filter((x) => x.keys.some((k) => k.startsWith(s)));
    if (starts.length === 1) return { hit: starts[0] };
    if (starts.length > 1) return { many: starts };
    const has = targets.filter((x) => x.keys.some((k) => k.includes(s)));
    if (has.length === 1) return { hit: has[0] };
    if (has.length > 1) return { many: has };
    return null;
}

// ---- Commands -------------------------------------------------------------------------------------------------------

interface Ctx {
    path: string;
    targets: Target[];
    soundOn: boolean;
    history: string[];
    go: (href: string, label: string) => Line[];
}

interface Cmd {
    name: string;
    usage: string;
    desc: string;
    long?: string[];
    hidden?: boolean;
    run: (args: string[], ctx: Ctx) => Line[];
}

const levenshtein = (a: string, b: string) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
        for (let j = 1; j <= b.length; j++)
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
};

const listGroup = (targets: Target[], g: Target["group"]): Line[] =>
    targets.filter((x) => x.group === g).map((x) => row(x.id, x.hint, x.href));

const COMMANDS: Cmd[] = [
    {
        name: "help",
        usage: "help [command]",
        desc: "this list, or details on one command",
        run: (args) => {
            if (args[0]) {
                const c = COMMANDS.find((x) => x.name === args[0].toLowerCase());
                if (!c) return [t(`no help for “${args[0]}”.`, "err")];
                return [row(c.usage, c.desc), ...(c.long ?? []).map((l) => t(l, "dim"))];
            }
            return [
                t("commands", "hi"),
                ...COMMANDS.filter((c) => !c.hidden).map((c) => row(c.usage, c.desc)),
                t("tab completes. ↑ ↓ recall earlier commands.", "dim"),
            ];
        },
    },
    {
        name: "ls",
        usage: "ls [where]",
        desc: "list pages, projects, games or skills",
        long: ["ls pages · ls projects · ls games · ls sections · ls <page> for its subpages"],
        run: (args, ctx) => {
            const w = slug(args[0] ?? "");
            if (!w || w === "pages")
                return [t("pages", "hi"), ...listGroup(ctx.targets, "pages"), t("ls projects · ls games · ls sections", "dim")];
            if (w === "projects") return [t("projects", "hi"), ...listGroup(ctx.targets, "projects")];
            if (w === "games") return [t("games", "hi"), ...listGroup(ctx.targets, "games")];
            if (w === "sections") return [t("sections", "hi"), ...listGroup(ctx.targets, "sections")];
            const page = navItems.find((n) => slug(n.label) === w || slug(n.title) === w);
            if (page) {
                if (!page.children?.length) return [t(`${page.label.toLowerCase()} has no subpages.`, "dim")];
                return [t(page.label.toLowerCase(), "hi"), ...page.children.map((c) => row(slug(c.label), "", c.href))];
            }
            return [t(`ls: no such place “${args[0]}”.`, "err"), t("try: pages, projects, games, sections", "dim")];
        },
    },
    {
        name: "open",
        usage: "open <place>",
        desc: "go to a page, project or game",
        long: ["open about · open nexus · open flag-guesser. Partial names work."],
        run: (args, ctx) => {
            if (!args.length) return [t("open what? try: open about", "err")];
            const f = resolve(ctx.targets, args.join(" "));
            if (!f) return [t(`open: nothing called “${args.join(" ")}”.`, "err"), t("ls shows everything you can open.", "dim")];
            if ("many" in f)
                return [t(`“${args.join(" ")}” matches more than one:`, "err"), ...f.many.slice(0, 6).map((x) => row(x.id, x.hint, x.href))];
            return ctx.go(f.hit.href, f.hit.label);
        },
    },
    {
        name: "whoami",
        usage: "whoami",
        desc: "the short version",
        run: () => [t(PROFILE_LEAD)],
    },
    {
        name: "now",
        usage: "now",
        desc: "what is happening right now",
        run: () => NOW_FEED.map((n) => row(n.tag.toLowerCase(), n.text)),
    },
    {
        name: "skills",
        usage: "skills",
        desc: "skills, grouped by area",
        run: () => {
            const by = new Map<SkillCategory, string[]>();
            for (const s of skills) by.set(s.category, [...(by.get(s.category) ?? []), s.name]);
            return [...by.entries()].map(([c, names]) => row(SKILL_CATEGORIES[c].label.toLowerCase(), names.join(", "), "/about#skills"));
        },
    },
    {
        name: "status",
        usage: "status",
        desc: "a readout of this site",
        run: (_a, ctx) => {
            const studies = navItems.find((n) => n.href === "/studies")?.children?.length ?? 0;
            const now = PATH.find((p) => p.current) ?? PATH[0];
            const next = PATH.find((p) => !p.current);
            const playable = allGames().filter((g) => g.status === "playable").length;
            return [
                t("naOS status", "hi"),
                row("here", ctx.path),
                row("pages", String(navItems.length)),
                row("games", `${playable} playable`),
                row("courses", String(studies)),
                row("skills", String(skills.length)),
                row("sound", ctx.soundOn ? "on" : "off"),
                row("now", now.title),
                ...(next ? [row("next", next.title)] : []),
            ];
        },
    },
    {
        name: "sound",
        usage: "sound [on|off]",
        desc: "interface sound",
        run: (args, ctx) => {
            const a = (args[0] ?? "").toLowerCase();
            if (a === "on" || a === "off") {
                setPrefs({ on: a === "on" });
                if (a === "on") window.setTimeout(() => sfx("on"), 40);
                return [t(`sound ${a}.`)];
            }
            if (a) return [t("sound: use on or off.", "err")];
            return [t(`sound is ${ctx.soundOn ? "on" : "off"}. sound on · sound off`)];
        },
    },
    {
        name: "history",
        usage: "history",
        desc: "commands you ran this visit",
        run: (_a, ctx) => (ctx.history.length ? ctx.history.map((h, i) => row(String(i + 1), h)) : [t("nothing yet.", "dim")]),
    },
    {
        name: "random",
        usage: "random",
        desc: "open a page you are not on",
        run: (_a, ctx) => {
            const pool = navItems.filter((n) => n.href !== ctx.path);
            const pick = pool[Math.floor(Math.random() * pool.length)];
            return ctx.go(pick.href, pick.label);
        },
    },
    {
        name: "back",
        usage: "back",
        desc: "previous page",
        run: () => {
            window.setTimeout(() => window.history.back(), 260);
            return [t("going back.")];
        },
    },
    {
        name: "clear",
        usage: "clear",
        desc: "wipe the screen (ctrl+l)",
        run: () => [],
    },
    {
        name: "exit",
        usage: "exit",
        desc: "close the console (esc works too)",
        run: () => [],
    },
    // Hidden: not listed in help, but they answer.
    { name: "sudo", usage: "sudo", desc: "", hidden: true, run: () => [t("nice try. there is no root here, only naOS.", "err")] },
    { name: "rm", usage: "rm", desc: "", hidden: true, run: () => [t("read-only. there is nothing here to delete.", "err")] },
    { name: "naos", usage: "naos", desc: "", hidden: true, run: () => [t("naOS command console. type help.")] },
];

const NAMES = COMMANDS.filter((c) => !c.hidden).map((c) => c.name);

/** The visible commands, for the site search. Read from COMMANDS so new commands show up there on their own. */
export const CONSOLE_INDEX: { name: string; usage: string; desc: string }[] = COMMANDS.filter((c) => !c.hidden).map(({ name, usage, desc }) => ({ name, usage, desc }));
const ALIAS: Record<string, string> = { cd: "open", go: "open", goto: "open", quit: "exit", q: "exit", "?": "help", man: "help", cls: "clear", dir: "ls" };

// Per-line typing times: each line is drawn left to right in steps, one after the other, capped so a long answer
// never keeps you waiting.
function timing(lines: Line[]) {
    const raw = lines.map((l) => Math.min(380, Math.max(90, (l.t ?? `${l.a ?? ""}${l.b ?? ""}`).length * 7)));
    const sum = raw.reduce((a, b) => a + b, 0);
    const k = sum > 1000 ? 1000 / sum : 1;
    let at = 0;
    return lines.map((l, i) => {
        const dur = Math.round(raw[i] * k);
        const t0 = Math.round(at);
        at += dur;
        const chars = (l.t ?? `${l.a ?? ""}${l.b ?? ""}`).length;
        return { dur, t0, steps: Math.max(2, Math.min(28, chars)) };
    });
}

let nextId = 1;
let sessionHistory: string[] = [];

const BOOT: Line[] = [t("naOS command console", "hi"), t("type help to see what it can do.", "dim")];
const CHIPS = ["help", "ls", "whoami", "now", "status"];

/** `prefill` puts a command in the input (the search uses this to open the console on a command). Nothing runs until Enter. */
export function NaosConsole({ onClose, prefill }: { onClose: () => void; prefill?: string }) {
    const path = usePathname();
    const [snd] = useSoundPrefs();
    const [entries, setEntries] = useState<Entry[]>(() => [{ id: nextId++, lines: BOOT }]);
    const [value, setValue] = useState(prefill ?? "");
    const [hint, setHint] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const out = useRef<HTMLDivElement>(null);
    const scrim = useRef<HTMLDivElement>(null);
    const returnTo = useRef<HTMLElement | null>(null);
    const recall = useRef({ i: -1, draft: "" });
    const timers = useRef<number[]>([]);
    const targets = useMemo(buildTargets, []);

    const close = useCallback(() => {
        sfx("close");
        onClose();
    }, [onClose]);

    // Focus in, and back to where it was on the way out.
    useEffect(() => {
        returnTo.current = document.activeElement as HTMLElement | null;
        sfx("open");
        input.current?.focus();
        const pending = timers.current;
        return () => {
            pending.forEach((id) => window.clearTimeout(id));
            returnTo.current?.focus?.();
        };
    }, []);

    // Lock page scroll behind the panel.
    useEffect(() => {
        const prev = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
        return () => {
            document.documentElement.style.overflow = prev;
        };
    }, []);

    // Follow the visible area on phones: when the keyboard comes up the panel shrinks to what is left above it.
    useEffect(() => {
        const vv = window.visualViewport;
        const el = scrim.current;
        if (!vv || !el) return;
        const fit = () => {
            el.style.setProperty("--cn-h", `${Math.round(vv.height)}px`);
            el.style.setProperty("--cn-top", `${Math.round(vv.offsetTop)}px`);
        };
        fit();
        vv.addEventListener("resize", fit);
        vv.addEventListener("scroll", fit);
        return () => {
            vv.removeEventListener("resize", fit);
            vv.removeEventListener("scroll", fit);
        };
    }, []);

    // Keep the newest output in view.
    useEffect(() => {
        const o = out.current;
        if (o) o.scrollTop = o.scrollHeight;
    }, [entries]);

    const go = useCallback(
        (href: string, label: string): Line[] => {
            const id = window.setTimeout(() => {
                onClose();
                navigateWithCurtain(href);
            }, 420);
            timers.current.push(id);
            return [t(`opening ${label.toLowerCase()}…`)];
        },
        [onClose],
    );

    const run = useCallback(
        (raw: string) => {
            const line = raw.trim();
            if (!line) return;
            sfx("tap");
            recall.current = { i: -1, draft: "" };
            setHint("");
            if (sessionHistory[sessionHistory.length - 1] !== line) sessionHistory = [...sessionHistory, line].slice(-50);

            const [w0, ...args] = line.split(/\s+/);
            const name = ALIAS[w0.toLowerCase()] ?? w0.toLowerCase();

            if (name === "clear") {
                setEntries([]);
                return;
            }
            if (name === "exit") {
                close();
                return;
            }
            const cmd = COMMANDS.find((c) => c.name === name);
            let lines: Line[];
            if (!cmd) {
                sfx("deny");
                const near = NAMES.map((n) => ({ n, d: levenshtein(name, n) })).sort((a, b) => a.d - b.d)[0];
                lines = [t(`naos: command not found: ${w0}`, "err")];
                if (near && near.d <= (name.length >= 4 ? 2 : 1) && near.d < name.length) lines.push(t(`did you mean “${near.n}”?`, "dim"));
                else lines.push(t("type help to see what it can do.", "dim"));
            } else {
                lines = cmd.run(args, {
                    path,
                    targets,
                    soundOn: snd.on,
                    history: sessionHistory,
                    go,
                });
            }
            setEntries((e) => [...e.slice(-40), { id: nextId++, cmd: line, lines }]);
        },
        [close, go, path, snd.on, targets],
    );

    const submit = () => {
        const v = value;
        setValue("");
        run(v);
    };

    // Tab completion: the command name first, then a place for open/ls.
    const complete = () => {
        const parts = value.split(/\s+/);
        const last = parts[parts.length - 1].toLowerCase();
        const first = parts[0].toLowerCase();
        let pool: string[];
        if (parts.length === 1) pool = NAMES;
        else if (first === "open" || first === "cd" || first === "go" || first === "goto") pool = targets.map((x) => x.id);
        else if (first === "ls" || first === "dir") pool = ["pages", "projects", "games", "sections", ...navItems.filter((n) => n.children?.length).map((n) => slug(n.label))];
        else if (first === "sound") pool = ["on", "off"];
        else if (first === "help" || first === "man") pool = NAMES;
        else return;
        const m = pool.filter((p) => p.startsWith(last));
        if (!m.length) {
            sfx("deny");
            setHint("");
            return;
        }
        let fill = m[0];
        if (m.length > 1) {
            let n = last.length;
            while (n < m[0].length && m.every((x) => x[n] === m[0][n])) n++;
            fill = m[0].slice(0, n);
            setHint(m.slice(0, 12).join("   "));
        } else {
            setHint("");
            fill += parts.length === 1 && first !== "" ? " " : "";
        }
        parts[parts.length - 1] = fill;
        setValue(parts.join(" "));
        sfx("tip");
    };

    const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submit();
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const h = sessionHistory;
            if (!h.length) return;
            const r = recall.current;
            if (e.key === "ArrowUp") {
                if (r.i === -1) r.draft = value;
                r.i = Math.min(h.length - 1, r.i + 1);
                setValue(h[h.length - 1 - r.i]);
            } else {
                r.i = Math.max(-1, r.i - 1);
                setValue(r.i === -1 ? r.draft : h[h.length - 1 - r.i]);
            }
        } else if (e.key === "Tab" && !e.shiftKey && value.trim()) {
            e.preventDefault();
            complete();
        } else if (e.key === "l" && e.ctrlKey) {
            e.preventDefault();
            setEntries([]);
        } else if (e.key === "c" && e.ctrlKey && !window.getSelection()?.toString()) {
            e.preventDefault();
            setValue("");
            setHint("");
        } else if (e.key === "`") {
            e.preventDefault();
            close();
        } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
            sfx("hover");
        }
    };

    const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            e.preventDefault();
            close();
            return;
        }
        if (e.key !== "Tab") return;
        // Keep Tab inside the panel.
        const items = [...e.currentTarget.querySelectorAll<HTMLElement>("input, button, a[href]")].filter((x) => x.tabIndex >= 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    return (
        <div
            ref={scrim}
            className="nv-scrim cn-scrim"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) close();
            }}
        >
            <div className="nv-panel nv-find cn-panel" role="dialog" aria-modal="true" aria-label="naOS command console" onKeyDown={onPanelKey}>
                <div className="nv-head">
                    <span>console // naOS</span>
                    <span className="nv-count">{path}</span>
                    <button type="button" className="nv-close" onClick={close} aria-label="Close console">
                        <kbd className="nv-key">esc</kbd>
                    </button>
                </div>
                <div
                    className="cn-out"
                    ref={out}
                    role="log"
                    aria-live="polite"
                    aria-relevant="additions"
                    aria-label="Console output"
                    onMouseUp={() => {
                        if (!window.getSelection()?.toString()) input.current?.focus({ preventScroll: true });
                    }}
                >
                    {entries.map((en) => {
                        const tm = timing(en.lines);
                        return (
                            <div className="cn-entry" key={en.id}>
                                {en.cmd !== undefined && (
                                    <div className="cn-cmd">
                                        <span aria-hidden="true">&gt;</span> {en.cmd}
                                    </div>
                                )}
                                {en.lines.map((l, i) => {
                                    const style = {
                                        ["--d" as string]: `${tm[i].t0}ms`,
                                        ["--t" as string]: `${tm[i].dur}ms`,
                                        ["--s" as string]: tm[i].steps,
                                    };
                                    const body =
                                        l.a !== undefined ? (
                                            <>
                                                <b className="cn-a">{l.a}</b>
                                                <span className="cn-b">{l.b}</span>
                                            </>
                                        ) : (
                                            l.t
                                        );
                                    return l.go ? (
                                        <a
                                            key={i}
                                            href={l.go}
                                            className="cn-l cn-row cn-go"
                                            style={style}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                run(`open ${l.go}`);
                                            }}
                                        >
                                            {body}
                                        </a>
                                    ) : (
                                        <div key={i} className={`cn-l${l.a !== undefined ? " cn-row" : ""}${l.k ? ` cn-${l.k}` : ""}`} style={style}>
                                            {body}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
                {hint && (
                    <div className="cn-hint" role="status">
                        {hint}
                    </div>
                )}
                <div className="cn-chips" role="group" aria-label="Quick commands">
                    {CHIPS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            className="cn-chip"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => run(c)}
                        >
                            {c}
                        </button>
                    ))}
                </div>
                <div className="nv-input cn-in">
                    <span className="nv-prompt" aria-hidden="true">&gt;</span>
                    <input
                        ref={input}
                        value={value}
                        placeholder="type a command"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="send"
                        aria-label="Console command"
                        onChange={(e) => {
                            setValue(e.target.value);
                            if (hint) setHint("");
                        }}
                        onKeyDown={onInputKey}
                    />
                </div>
                <div className="nv-foot" aria-hidden="true">
                    <span><kbd className="nv-key">tab</kbd>complete</span>
                    <span><kbd className="nv-key">↑</kbd><kbd className="nv-key">↓</kbd>history</span>
                    <span><kbd className="nv-key">esc</kbd>close</span>
                </div>
            </div>
        </div>
    );
}
