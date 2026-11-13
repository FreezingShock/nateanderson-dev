// The live terminal feed under the reactor. Pure data, no React: lines are tokens (so the UI can colour them like code),
// presses are batched into one counting line, the list is capped, and subscribers are told at most every 150 ms, so Drones
// pressing many buttons a second cost one small re-render, not one per press.
import { MATS, fmt, statDef, type ButtonStat, type StatId } from "./engine";

export type TokKind = "id" | "fn" | "num" | "str" | "kw" | "p" | "c" | "t";
export interface Tok { k: TokKind; v: string; c?: string }
export type FeedTone = "good" | "warn" | "hot";
export interface FeedLine {
    id: number;
    t: string;
    tone?: FeedTone;
    toks: Tok[];
    /** typed out character by character when it is the newest line */
    type?: boolean;
    key?: string;
    at: number;
    n: number;
    sum: number;
    mk?: (n: number, sum: number) => Tok[];
}

export const FEED_CAP = 60;
const MERGE_MS = 1500;
const FLUSH_MS = 150;

const clock = () => new Date().toTimeString().slice(0, 8);

// ---- token helpers
export const id = (v: string, c?: string): Tok => ({ k: "id", v, c });
export const fn = (v: string): Tok => ({ k: "fn", v });
export const num = (v: string | number): Tok => ({ k: "num", v: String(v) });
export const str = (v: string): Tok => ({ k: "str", v: `"${v}"` });
export const kw = (v: string): Tok => ({ k: "kw", v });
export const p = (v: string): Tok => ({ k: "p", v });
export const com = (v: string): Tok => ({ k: "c", v });
export const txt = (v: string): Tok => ({ k: "t", v });

/** obj.fn(args) as tokens; args are tokens already. */
export function call(obj: Tok, name: string, args: Tok[] = []): Tok[] {
    const out: Tok[] = [obj, p("."), fn(name), p("(")];
    args.forEach((a, i) => {
        if (i) out.push(p(", "));
        out.push(a);
    });
    out.push(p(")"));
    return out;
}

const LEVEL: Record<FeedTone | "sys", string> = { good: "ok", warn: "warn", hot: "alert", sys: "sys" };

/** Plain text from the game (goals, events, greetings) as a level tag, then the words with numbers and CAPS picked out. */
export function fromText(text: string, tone?: FeedTone): Tok[] {
    const out: Tok[] = [kw(LEVEL[tone ?? "sys"]), p(": ")];
    for (const part of text.split(/(×?\d[\d.,]*[A-Za-z]{0,2}%?|\b[A-Z][A-Z0-9]{2,}\b)/)) {
        if (!part) continue;
        out.push(/^[×\d]/.test(part) ? num(part) : /^[A-Z][A-Z0-9]{2,}$/.test(part) ? kw(part) : txt(part));
    }
    return out;
}

const statId = (stat: StatId) => id(stat, statDef(stat).color);

/** The code name of a button's action, shown as a small caption on the button and in the feed. */
export function fnName(stat: ButtonStat): string {
    return stat === "reboot" ? "reboot" : stat === "mult" ? "add" : (MATS as readonly string[]).includes(stat) ? "spawn" : "run";
}
export const fnCaption = (stat: ButtonStat, gain: number) => `.${fnName(stat)}(${fmt(gain, 1)})`;

/** One press (or a batch of them): `copper.spawn("Wire") ×12 → +60`. */
export function buyToks(stat: ButtonStat, name: string, n: number, gain: number): Tok[] {
    const t: Tok[] = call(statId(stat), fnName(stat), [str(name)]);
    if (n > 1) t.push(txt(" "), num(`×${fmt(n)}`));
    t.push(p(" → "), num(`+${fmt(gain)}`));
    return t;
}

export function unlockToks(stat: StatId, zone: string, no: number): Tok[] {
    return [...call(statId(stat), "decrypt"), p(" → "), str("online"), txt(" "), com(`// zone ${String(no).padStart(2, "0")}: ${zone}`)];
}

export function droneToks(n: number, posted: number): Tok[] {
    const t = call(id("drones"), "work");
    t.push(txt(" "), num(`×${fmt(n)}`));
    if (posted > 0) t.push(p(" → "), com(`${posted} posted`));
    return t;
}

// ---- the store
export class FeedStore {
    lines: FeedLine[] = [];
    /** bumps on every flush; the React side reads it as its snapshot */
    v = 0;
    private seq = 1;
    private subs = new Set<() => void>();
    private timer: ReturnType<typeof setTimeout> | null = null;

    subscribe = (cb: () => void) => {
        this.subs.add(cb);
        return () => {
            this.subs.delete(cb);
        };
    };
    getVersion = () => this.v;

    private flush() {
        if (this.timer) return;
        this.timer = setTimeout(() => {
            this.timer = null;
            this.v++;
            this.subs.forEach((f) => f());
        }, FLUSH_MS);
    }

    push(toks: Tok[], o: { tone?: FeedTone; type?: boolean } = {}) {
        this.lines.push({ id: this.seq++, t: clock(), tone: o.tone, toks, type: o.type, at: Date.now(), n: 1, sum: 0 });
        if (this.lines.length > FEED_CAP) this.lines.splice(0, this.lines.length - FEED_CAP);
        this.flush();
    }

    /** Count another one into the newest line when it has the same key (and is recent); otherwise start a new line. */
    batch(key: string, mk: (n: number, sum: number) => Tok[], amount: number, windowMs = MERGE_MS) {
        const now = Date.now();
        // look back a few lines, so a Drone line and a player line that alternate each keep counting in place
        let last: FeedLine | undefined;
        for (let i = this.lines.length - 1; i >= 0 && i >= this.lines.length - 4; i--) {
            if (this.lines[i].key === key) {
                last = this.lines[i];
                break;
            }
        }
        if (last && now - last.at < windowMs) {
            last.n++;
            last.sum += amount;
            last.at = now;
            last.toks = mk(last.n, last.sum);
            this.flush();
            return;
        }
        this.push(mk(1, amount));
        const l = this.lines[this.lines.length - 1];
        l.key = key;
        l.sum = amount;
        l.mk = mk;
    }

    clear() {
        this.lines = [];
        this.flush();
    }

    dispose() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.subs.clear();
    }
}
