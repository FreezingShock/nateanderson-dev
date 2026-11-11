// Camino motion engine. One tiny runtime shared by the whole site.
//
//  - Reveals:      [data-mx] elements and the children of [data-mx-stagger] containers fade/slide in once, when they
//                  scroll into view. Elements that enter together are staggered as one wave.
//  - Scroll type:  [data-mx-type] text is typed by scroll distance (and by time for text that is already on screen
//                  at load). Progress is written as one CSS variable (--n); CSS does the rest.
//  - Parallax:     [data-mx-par="0.1"] drifts with scroll (transform only).
//  - Page gauge:   --cm-page-p on the .cm-pgauge element (0-1) drives the thin progress line at the top of the viewport.
//
// Everything is gated while the boot sequence or a page curtain is up (html[data-boot] / html[data-xition]) so
// nothing animates behind a cover. All writes are CSS custom properties, attributes, transform and opacity; all
// geometry reads are batched into one rAF per scroll frame. No React state is involved, so nothing re-renders.

const STEP = 70; // ms between siblings in a reveal wave
const MAX_WAVE = 7; // cap so long lists don't trickle forever
const REVEAL_MS = 740; // --cm-d-reveal is .7s; drop the reveal transition only after it has finished, or the last few px snap
// Scroll-linked text lines (fraction of the viewport height, measured from the top edge):
const READ_LINE = 0.8; // above this line text is fully resolved: typed and unscrambled, never half-finished
const SCR_ENTER = 0.92; // scrambled text starts decoding here (just inside the bottom edge)
const TYPE_FROM = 0.92; // scroll-typed blocks start typing here

interface TypeItem {
    el: HTMLElement;
    chars: HTMLElement[];
    total: number;
    auto: boolean;
    t0: number;
    dur: number;
    timeP: number;
    last: number;
    cur: HTMLElement | null;
    active: boolean;
}
interface ParItem {
    el: HTMLElement;
    k: number;
    active: boolean;
    last: number;
}

const SEL = "[data-mx], [data-mx-type], [data-mx-par], [data-mx-scr], [data-rx], [data-rx-scr]";
const html = () => document.documentElement;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * React stamps its fiber onto every element it hydrates. Until that happens the node is still server HTML (streamed
 * Suspense content can sit like that for a while). Any engine write before then (attributes, --n, scrambled text)
 * makes React report a hydration mismatch, so the engine only touches nodes React already owns.
 */
const hydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith("__reactFiber$"));

/** Text the engine wrote itself. It is no longer React's text, so checks must not read it as server HTML. */
const ours = new WeakSet<Node>();
/** Replace an element's text. Only ever called on nodes that are hydrated (see `register`, `autoRx`, `onHoverScr`). */
function setText(el: HTMLElement, text: string) {
    el.textContent = text;
    if (el.firstChild) ours.add(el.firstChild);
}

export const prefersReducedMotion = () =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True while the boot sequence or a page curtain covers the screen. */
function gated(): boolean {
    const d = html();
    const b = d.getAttribute("data-boot");
    return b === "full" || b === "quick" || d.hasAttribute("data-xition");
}

let lastNavAt = 0;
/** Mark "a navigation just happened": content that mounts in the next moments reveals like a new page. */
export function markNavigation() {
    lastNavAt = performance.now();
    settleScrambles();
}

// ---------------------------------------------------------------------------------------------------------------
let started = false;
const seen = new WeakSet<Element>();
const queue = new Set<Element>(); // found while gated, registered once the cover lifts
const types = new Map<Element, TypeItem>();
const pars = new Map<Element, ParItem>();
let revealIO: IntersectionObserver | null = null;
let scrIO: IntersectionObserver | null = null;
const rxs = new Map<Element, RxItem>();
let activeIO: IntersectionObserver | null = null;
let raf = 0;
const readyCbs = new Set<() => void>();

/** Run `cb` once nothing covers the screen (immediately if nothing does). Returns a cancel function. */
export function whenUngated(cb: () => void): () => void {
    if (!gated()) {
        cb();
        return () => {};
    }
    readyCbs.add(cb);
    return () => readyCbs.delete(cb);
}

function flushGate() {
    if (gated()) return;
    const cbs = [...readyCbs];
    readyCbs.clear();
    cbs.forEach((cb) => cb());
    const q = [...queue];
    queue.clear();
    q.forEach(register);
    schedule();
}

// Server HTML the engine found before React hydrated it. Held here and retried on a short timer; once React owns
// the node it is scanned exactly as if it had been there at load. Entries whose node left the page are dropped.
const waiting = new Set<Element>();
let waitTimer = 0;
function wait(el: Element) {
    waiting.add(el);
    if (!waitTimer) waitTimer = window.setInterval(retryWaiting, 100);
}
function retryWaiting() {
    Array.from(waiting).forEach((el) => {
        if (!el.isConnected) {
            waiting.delete(el);
            return;
        }
        if (!hydrated(el)) return;
        waiting.delete(el);
        if (el.matches(SEL)) register(el);
        scan(el);
    });
    if (!waiting.size && waitTimer) {
        window.clearInterval(waitTimer);
        waitTimer = 0;
    }
}

function register(el: Element) {
    if (!(el instanceof HTMLElement) || seen.has(el)) return;
    if (gated()) {
        queue.add(el);
        return;
    }
    if (!hydrated(el)) return wait(el);
    seen.add(el);
    if (el.hasAttribute("data-mx-type")) return registerType(el);
    if (el.hasAttribute("data-mx-par")) return registerPar(el);
    if (el.hasAttribute("data-rx") || el.hasAttribute("data-rx-scr")) return registerRx(el);
    if (el.hasAttribute("data-mx-scr")) return void scrIO?.observe(el);
    revealIO?.observe(el);
}

function registerType(el: HTMLElement) {
    const chars = Array.from(el.querySelectorAll<HTMLElement>(".c"));
    const total = chars.length;
    if (!total) return;
    // Only text marked `auto` (first-screen leads) types over time; everything else follows the scroll, so
    // content that streams in later can never be mistaken for "already on screen".
    const auto = el.getAttribute("data-mx-type") === "auto";
    types.set(el, {
        el,
        chars,
        total,
        auto,
        t0: performance.now(),
        dur: Math.min(1800, Math.max(650, total * 16)),
        timeP: 0,
        last: -1,
        cur: null,
        active: true,
    });
    activeIO?.observe(el);
}

function registerPar(el: HTMLElement) {
    pars.set(el, { el, k: parseFloat(el.getAttribute("data-mx-par") || "0.1") || 0.1, active: true, last: NaN });
    activeIO?.observe(el);
}

function revealNow(el: HTMLElement, wave: number) {
    if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", `${Math.min(wave, MAX_WAVE) * STEP}ms`);
    const d = parseFloat(el.style.getPropertyValue("--d")) || 0;
    el.setAttribute("data-in", "");
    window.setTimeout(() => el.setAttribute("data-mxd", ""), d + REVEAL_MS);
}

function onReveal(entries: IntersectionObserverEntry[]) {
    const hits = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
    hits.forEach((e, i) => {
        revealIO?.unobserve(e.target);
        revealNow(e.target as HTMLElement, i);
    });
}

/** Find motion targets under `root`. Safe to call repeatedly. */
export function scan(root: ParentNode = document) {
    if (!started) return;
    autoRx(root);
    const found = new Set<Element>();
    root.querySelectorAll(SEL).forEach((e) => found.add(e));
    root.querySelectorAll("[data-mx-stagger] > *").forEach((e) => {
        if (!e.hasAttribute("data-mx") && !e.hasAttribute("data-rx") && !e.querySelector("[data-mx], [data-rx]")) found.add(e);
    });
    found.forEach(register);
}

function onMutations(muts: MutationRecord[]) {
    const fresh = performance.now() - lastNavAt < 1500 || gated();
    for (const m of muts) {
        m.addedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement)) return;
            autoRx(n);
            const parent = n.parentElement;
            const isStaggerChild = !!parent?.hasAttribute("data-mx-stagger");
            const targets: HTMLElement[] = [];
            if (n.matches(SEL) || isStaggerChild) targets.push(n);
            n.querySelectorAll<HTMLElement>(SEL).forEach((e) => targets.push(e));
            n.querySelectorAll<HTMLElement>("[data-mx-stagger] > *").forEach((e) => {
                if (!e.hasAttribute("data-mx") && !e.hasAttribute("data-rx") && !e.querySelector("[data-mx], [data-rx]")) targets.push(e);
            });
            for (const t of targets) {
                if (seen.has(t)) continue;
                if (!hydrated(t)) {
                    wait(t);
                    continue;
                }
                const typed = t.hasAttribute("data-mx-type") || t.hasAttribute("data-mx-par") || t.hasAttribute("data-mx-scr") || t.hasAttribute("data-rx") || t.hasAttribute("data-rx-scr");
                if (!fresh && !typed) {
                    // Content that appears because the user did something (filters, tabs): no animation, and
                    // never a hidden flash. Microtask timing means this lands before the next paint.
                    const r = t.getBoundingClientRect();
                    if (r.top < innerHeight) {
                        seen.add(t);
                        t.setAttribute("data-in", "");
                        t.setAttribute("data-mxd", "");
                        continue;
                    }
                }
                register(t);
            }
        });
    }
}


// ---- Character scramble -----------------------------------------------------------------------------------------
// [data-mx-scr] text decodes left to right out of random glyphs when it scrolls into view (and again on hover for
// [data-scr-hover]). The element's real text is the final state and is never changed for assistive tech (the
// component keeps an sr-only copy). One rAF per running scramble, ~30fps writes, text nodes only.
//
// Hard guarantees (a scramble must never be able to stay as glyphs):
//  - one run per element: starting a run cancels the previous one (frame loop and deadline timer);
//  - the true text is read from data-final, else the sr-only copy next to it, and only then from the DOM, so a
//    half-scrambled node can never be mistaken for the real text;
//  - every run has a deadline timer that writes the final text even if the frame loop stalls or dies;
//  - hidden tabs, bfcache restores and route changes settle every running run immediately.
const GLYPHS = "01<>/\\[]{}#%$&@*+=-_:;|!?";
interface ScrRun {
    raf: number;
    timer: number;
    final: string;
}
const running = new Map<HTMLElement, ScrRun>();

/** The real text of a scramble target. Never derived from text the engine may have scrambled. */
function finalOf(el: HTMLElement): string {
    const have = el.getAttribute("data-final");
    if (have !== null) return have;
    const sr = el.previousElementSibling;
    const real = sr instanceof HTMLElement && sr.classList.contains("sr-only") ? sr.textContent : null;
    const final = real ?? el.textContent ?? "";
    el.setAttribute("data-final", final);
    return final;
}

function endRun(el: HTMLElement, write = true) {
    const run = running.get(el);
    if (!run) return;
    cancelAnimationFrame(run.raf);
    window.clearTimeout(run.timer);
    running.delete(el);
    if (write && el.textContent !== run.final) setText(el, run.final);
}

/** Write the real text into every running scramble right now. */
function settleScrambles() {
    for (const el of Array.from(running.keys())) endRun(el);
}

function scramble(el: HTMLElement, ms?: number) {
    const final = finalOf(el);
    endRun(el, false);
    if (prefersReducedMotion() || !final.trim()) {
        setText(el, final);
        return;
    }
    const chars = Array.from(final);
    const dur = ms ?? Math.min(1000, Math.max(420, chars.length * 24));
    const lock = chars.map((_, i) => (i / chars.length) * 0.78 + Math.random() * 0.22); // when each char resolves (0-1)
    const t0 = performance.now();
    let lastW = 0;
    const run: ScrRun = { raf: 0, timer: 0, final };
    // Deadline: even if the frame loop never runs again (stalled rAF, throttled tab), the real text lands.
    run.timer = window.setTimeout(() => endRun(el), dur + 400);
    const tick = (now: number) => {
        if (running.get(el) !== run) return;
        const p = clamp01((now - t0) / dur);
        if (p >= 1) {
            endRun(el);
            return;
        }
        if (now - lastW >= 32) {
            lastW = now;
            let out = "";
            for (let i = 0; i < chars.length; i++) {
                const c = chars[i];
                out += c === " " || lock[i] <= p ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
            }
            setText(el, out);
        }
        run.raf = requestAnimationFrame(tick);
    };
    running.set(el, run);
    run.raf = requestAnimationFrame(tick);
}

function onScrIO(entries: IntersectionObserverEntry[]) {
    for (const e of entries) {
        if (!e.isIntersecting) continue;
        scrIO?.unobserve(e.target);
        const el = e.target as HTMLElement;
        const d = parseFloat(el.getAttribute("data-mx-scr-d") || "0") || 0;
        const delay = d + 0; // optional stagger in ms
        el.setAttribute("data-in", "");
        if (delay) window.setTimeout(() => scramble(el), delay);
        else scramble(el);
    }
}

// ---- Replaying reveals ------------------------------------------------------------------------------------------
// [data-rx] items reveal every time they scroll into view and go back out when they leave, on the side they left
// from (so scrolling up plays the move in reverse). `data-rin` = shown, `data-rd` = "t" or "b" (the edge it comes
// from / goes to). Items entering together are staggered by position. [data-rx-scr] text re-scrambles on each entry.
// A [data-rx-auto] container (Section with `ctos`) tags its own items so pages need no extra markup.
const GROUPS = ".cm-grid, .cm-split, .cm-cols3, .pf, .cm-rail";
const ROWS = ".pf-feed li, .pf-steps li, .pf-pillars > div, .cm-rail > li, .cm-table tbody tr, .cm-stream li";
const TEXTS = ".pf-feed li > span:last-child, .pf-steps b, .pf-steps .cm-lbl, .pf-pillars dt, .pf-pillars dd, .cm-card > b, .cm-card .st, .cm-card > .cm-state, .cm-hbar > span";

function tag(el: Element, variant: string) {
    if (el instanceof HTMLElement && !el.hasAttribute("data-rx") && !el.closest("[data-mx]")) el.setAttribute("data-rx", variant);
}
function autoRx(root: ParentNode) {
    const wraps: Element[] = [];
    if (root instanceof Element && root.matches("[data-rx-auto]")) wraps.push(root);
    root.querySelectorAll("[data-rx-auto]").forEach((w) => wraps.push(w));
    for (const w of wraps) {
        if (w.hasAttribute("data-rx-done")) continue;
        if (!hydrated(w)) {
            wait(w);
            continue;
        }
        // Plan every write first. Children of a hydrated wrapper can still be server HTML (a Suspense boundary inside the
        // section streams in later), so the wrapper is tagged only once each planned node is React's too. Tagging a
        // half-hydrated subtree was the source of "data-rx-scr on <b>" mismatches. Retried until everything is ready.
        const tags: [Element, string][] = [];
        for (const c of Array.from(w.children)) {
            if (c.matches(".cm-sec-head")) continue; // heading, label and blurb animate themselves
            if (c.matches(GROUPS)) {
                const two = c.matches(".pf, .cm-split");
                Array.from(c.children).forEach((k, i) => {
                    tags.push([k, two ? (k.matches(".pf-id") ? "" : i % 2 ? "slide-r" : "slide") : ""]);
                });
            } else tags.push([c, ""]);
        }
        w.querySelectorAll(ROWS).forEach((r) => tags.push([r, "row"]));
        const texts = Array.from(w.querySelectorAll<HTMLElement>(TEXTS)).filter(
            (t) => t.children.length === 0 && t.textContent?.trim() && !t.hasAttribute("data-rx-scr") && !t.closest("[data-mx-scr]"),
        );
        if (![...tags.map(([e]) => e), ...texts].every((e) => hydrated(e))) {
            wait(w);
            continue;
        }
        w.setAttribute("data-rx-done", "");
        for (const [el, variant] of tags) tag(el, variant);
        texts.forEach((t) => t.setAttribute("data-rx-scr", ""));
    }
}

interface RxItem {
    el: HTMLElement;
    scr: boolean;
    inh: boolean; // also mirrors its progress to an inherited --pi for the CSS that styles its descendants
    pool: string[]; // the non-space characters a scramble draws its noise from (built once, not per frame)
    off: number;
    final: string;
    chars: string[];
    lock: number[];
    p: number;
    active: boolean;
    side: number; // 0 = below the viewport, 1 = above it (applied when the item leaves the active zone)
    intro: boolean;
    t0: number;
    w: number;
    done: boolean;
    ref: number; // viewport y where progress is 0; fixed for items already on screen at load so they start fully shown
}

function registerRx(el: HTMLElement) {
    const scr = el.hasAttribute("data-rx-scr");
    const sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
    const final = scr ? finalOf(el) : "";
    const chars = scr ? Array.from(final) : [];
    rxs.set(el, {
        el,
        scr,
        inh: !scr && (el.hasAttribute("data-rx-inh") || el.getAttribute("data-rx") === "slab"),
        pool: chars.filter((c) => c !== " "),
        off: (sib % 4) * 34,
        final,
        chars,
        lock: chars.map((_, i) => (i / Math.max(1, chars.length)) * 0.78 + Math.random() * 0.22),
        p: -1,
        active: true,
        side: 0,
        intro: false,
        t0: 0,
        w: 0,
        done: false,
        ref: NaN,
    });
    activeIO?.observe(el);
}

/** Scrubbed text: characters lock in left to right as p goes 0 to 1 and come undone again as it goes back. */
function renderScr(it: RxItem, p: number, now: number) {
    if (p >= 1) {
        if (!it.done) {
            setText(it.el, it.final);
            it.done = true;
        }
        return;
    }
    if (now - it.w < 40 && it.done === false && it.p >= 0) return;
    it.w = now;
    it.done = false;
    const pool = it.pool;
    let out = "";
    for (let i = 0; i < it.chars.length; i++) {
        const c = it.chars[i];
        if (c === " " || it.lock[i] <= p) out += c;
        else out += Math.random() < 0.72 && pool.length ? pool[(Math.random() * pool.length) | 0] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    setText(it.el, out);
}

function setRx(it: RxItem, p: number, now: number) {
    if (it.scr) renderScr(it, p, now);
    else {
        // smoothstep: soft start and landing. --p is not inherited (see ctos.css), so only the few elements whose
        // children read it (slabs, game frames, timeline phases) also get the inherited --pi.
        const v = (p * p * (3 - 2 * p)).toFixed(3);
        it.el.style.setProperty("--p", v);
        if (it.inh) it.el.style.setProperty("--pi", v);
    }
    it.p = p;
}

/** Hover scramble: once when the pointer enters the element, again only after it has left and come back. Moving
 *  between children, or resting on it, never re-triggers (pointerover bubbles, so the origin is checked). */
function onHoverScr(ev: PointerEvent) {
    if (ev.pointerType === "touch") return;
    const el = (ev.target as Element | null)?.closest?.("[data-scr-hover]");
    if (!el || !(el instanceof HTMLElement)) return;
    const from = ev.relatedTarget;
    if (from instanceof Node && el.contains(from)) return;
    const t = el.querySelector<HTMLElement>("[data-scr-text]") ?? el;
    if (!hydrated(t)) return; // pointer can arrive while the page is still hydrating
    scramble(t, 380);
}

// ---------------------------------------------------------------------------------------------------------------
function schedule() {
    if (!raf && started) raf = requestAnimationFrame(frame);
}

let lastT = 0;
let lastScrollAt = -1e9; // when the page last scrolled; scrubbed text that is left half-decoded resolves once it is quiet
let idleTimer = 0;
let gaugeEl: HTMLElement | null = null;
function pageGauge(): HTMLElement | null {
    if (!gaugeEl || !gaugeEl.isConnected) gaugeEl = document.querySelector<HTMLElement>(".cm-pgauge");
    return gaugeEl;
}
function frame(now: number) {
    raf = 0;
    const vh = innerHeight;
    const doc = html();
    const max = Math.max(0, doc.scrollHeight - vh);
    const y = scrollY;
    const atEnd = max > 0 && y >= max - 6;

    // 1) reads: every rect this frame, before any write. Reading after a write forces a style flush each time.
    const typeRects: [TypeItem, DOMRect][] = [];
    types.forEach((t) => {
        if (t.active) typeRects.push([t, t.el.getBoundingClientRect()]);
    });
    const rxRects: [RxItem, DOMRect][] = [];
    const parked: RxItem[] = []; // items outside the active zone that settle on their resting edge
    rxs.forEach((it) => {
        if (it.active) rxRects.push([it, it.el.getBoundingClientRect()]);
        else if (it.p !== it.side) parked.push(it);
    });

    // 2) writes
    // The gauge reads --cm-page-p, so write it on the gauge (cheap subtree) rather than on <html>: a root-level custom
    // property change restyles the whole document on every scroll frame.
    const gauge = pageGauge();
    if (gauge) gauge.style.setProperty("--cm-page-p", (max ? clamp01(y / max) : 0).toFixed(4));
    let again = false;

    for (const [t, r] of typeRects) {
        // Typing runs only while the block enters through the bottom band and is finished by the read line, so text
        // the reader can see is never left half-typed.
        let p = clamp01((vh * TYPE_FROM - r.top) / (vh * (TYPE_FROM - READ_LINE)));
        if (atEnd && r.top < vh) p = 1;
        if (t.auto && t.timeP < 1) {
            t.timeP = clamp01((now - t.t0) / t.dur);
            if (t.timeP < 1) again = true;
        }
        p = Math.max(p, t.timeP);
        const n = p * (t.total + 3);
        if (Math.abs(n - t.last) < 0.04 && p > 0 && p < 1) continue;
        t.last = n;
        t.el.style.setProperty("--n", n.toFixed(2));
        const idx = p > 0 && p < 1 ? Math.min(t.total - 1, Math.floor(n)) : -1;
        const next = idx >= 0 ? t.chars[idx] : null;
        if (next !== t.cur) {
            t.cur?.removeAttribute("data-cur");
            next?.setAttribute("data-cur", "");
            t.cur = next;
        }
    }

    // Scrubbed reveals: each item's progress is a function of where it sits in the viewport, so scrolling down plays
    // the animation forward and scrolling back up plays the exact same animation in reverse.
    for (const it of parked) setRx(it, it.side, now);
    const band = Math.min(vh * 0.36, 340);
    // Critically damped follow: the displayed progress eases toward where the scroll position says it should be, so
    // wheel notches and touch flicks glide instead of stepping. Frame-rate independent via dt.
    const dt = Math.min(50, Math.max(8, now - lastT));
    lastT = now;
    const k = 1 - Math.exp(-dt / 120);
    for (const [it, r] of rxRects) {
        let p: number;
        if (it.scr) {
            // Scrambled text decodes only while its line is entering at the bottom edge. Once it is past the read line
            // it is fully legible, so text the reader can see is never left as glyphs.
            p = clamp01((vh * SCR_ENTER - r.top) / (vh * (SCR_ENTER - READ_LINE)));
            // A line that stops scrolling inside the decode band (or loads there) must not stay glyphs: once the page
            // has been still for a moment it finishes decoding on its own. Scrolling again re-scrubs it as before.
            if (p > 0 && p < 1 && now - lastScrollAt > 350) p = 1;
        } else {
            if (Number.isNaN(it.ref)) {
                const base = vh * 0.97 - it.off;
                it.ref = r.top < base ? Math.max(base, r.top + band) : -1;
            }
            p = clamp01(((it.ref < 0 ? vh * 0.97 - it.off : it.ref) - r.top) / band);
        }
        if (atEnd && r.top < vh) p = 1;
        if (it.p < 0 && p >= 1 && !it.intro && !it.done) {
            it.intro = true; // already in view when it first appears: play it forward once over time
            it.t0 = now + it.off * 2;
        }
        if (it.intro) {
            const tp = clamp01((now - it.t0) / 650);
            if (tp >= 1) it.intro = false;
            else again = true;
            p = Math.min(p, tp);
            if (it.p < 0 && tp <= 0) p = 0;
        }
        if (!it.intro && it.p >= 0) {
            const tgt = p;
            if (Math.abs(tgt - it.p) < (it.scr && tgt >= 1 ? 0.04 : 0.004)) p = tgt; // decoded text lands, it does not asymptote
            else {
                p = it.p + (tgt - it.p) * k;
                again = true;
            }
        }
        if (it.p === p) continue;
        setRx(it, p, now);
    }

    pars.forEach((p) => {
        if (!p.active) return;
        const v = Math.round(y * p.k * 10) / 10;
        if (v === p.last) return;
        p.last = v;
        p.el.style.setProperty("--py", `${v}px`);
    });

    if (again) schedule();
}

// ---------------------------------------------------------------------------------------------------------------
/** Start the engine. Returns a cleanup. Call once from the root client component. */
export function start(): () => void {
    if (started) return () => {};
    started = true;
    const reduce = prefersReducedMotion();

    revealIO = new IntersectionObserver(onReveal, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    scrIO = new IntersectionObserver(onScrIO, { rootMargin: "0px 0px -6% 0px", threshold: 0.4 });
    activeIO = new IntersectionObserver(
        (es) => {
            es.forEach((e) => {
                const t = types.get(e.target);
                if (t) t.active = e.isIntersecting || t.last < 0;
                const p = pars.get(e.target);
                if (p) p.active = e.isIntersecting;
                const r = rxs.get(e.target);
                if (r) {
                    r.active = e.isIntersecting;
                    if (!e.isIntersecting) r.side = e.boundingClientRect.top < 0 ? 1 : 0;
                }
            });
            schedule();
        },
        { rootMargin: "20% 0px 20% 0px" },
    );

    const onScroll = () => schedule();
    const onUserScroll = () => {
        lastScrollAt = performance.now();
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(schedule, 400);
        schedule();
    };
    // A hidden or restored page has stalled timers and frames: land every scramble on its real text and re-measure.
    const onVisible = () => {
        settleScrambles();
        schedule();
    };
    addEventListener("scroll", onUserScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    addEventListener("pageshow", onVisible);
    addEventListener("resize", onScroll, { passive: true });
    addEventListener("popstate", markNavigation);
    document.addEventListener("pointerover", onHoverScr, { passive: true });

    // Streaming content and image/font loads move things after the first frame: re-measure when the page resizes.
    const ro = new ResizeObserver(onScroll);
    ro.observe(document.body);

    const attrs = new MutationObserver(flushGate);
    attrs.observe(html(), { attributes: true, attributeFilter: ["data-boot", "data-xition"] });

    const dom = new MutationObserver(onMutations);
    dom.observe(document.body, { childList: true, subtree: true });

    if (reduce) {
        // CSS already shows everything; just keep the page gauge honest.
        schedule();
    } else {
        scan(document);
        flushGate();
        schedule();
    }

    return () => {
        started = false;
        removeEventListener("scroll", onUserScroll);
        document.removeEventListener("visibilitychange", onVisible);
        removeEventListener("pageshow", onVisible);
        window.clearTimeout(idleTimer);
        settleScrambles();
        removeEventListener("resize", onScroll);
        removeEventListener("popstate", markNavigation);
        document.removeEventListener("pointerover", onHoverScr);
        attrs.disconnect();
        ro.disconnect();
        dom.disconnect();
        revealIO?.disconnect();
        scrIO?.disconnect();
        rxs.clear();
        activeIO?.disconnect();
        revealIO = activeIO = scrIO = null;
        types.clear();
        pars.clear();
        queue.clear();
        readyCbs.clear();
        waiting.clear();
        if (waitTimer) window.clearInterval(waitTimer);
        waitTimer = 0;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
    };
}
