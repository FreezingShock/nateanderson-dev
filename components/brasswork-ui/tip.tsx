"use client";

// The one Brasswork tooltip. Any element carries its content as a JSON `data-tip` attribute (see tipAttr); one
// layer, mounted once, reads that attribute and draws a riveted brass tag. Desktop: shows on hover and keyboard
// focus. Phone (touch): a tap shows the tag for a few seconds and the tap still does its job. The canvas uses
// showPointerTip for tags that follow the mouse over the island. The layer never plays sound.
import { useEffect } from "react";
import "./tip.css";

import type { TipData } from "@/lib/automation/tips";
export type { TipData };

/** Spread onto any element: `<button {...tipAttr(tip)}>`. Returns nothing when there is no tip. */
export function tipAttr(tip: TipData | null | undefined): { "data-tip"?: string } {
  return tip ? { "data-tip": JSON.stringify(tip) } : {};
}

const SHOW_DELAY = 140;
const HIDE_DELAY = 90;
const TOUCH_HOLD = 2600;
const REFRESH = 300;
const GAP = 10;
const MARGIN = 8;

let el: HTMLDivElement | null = null;
let anchor: Element | null = null;
let pointerMode = false;
let shown = false;
// A tag opened by a tap stays up for its own timer, even if the tapped control re-renders.
let pinned = false;
let lastJson = "";
let showTimer = 0;
let hideTimer = 0;
let touchTimer = 0;
let refreshTimer = 0;
let px = 0;
let py = 0;

function ensureEl(): HTMLDivElement {
  if (el && el.isConnected) return el;
  el = document.createElement("div");
  el.className = "bwtip";
  el.setAttribute("aria-hidden", "true");
  el.dataset.on = "0";
  document.body.appendChild(el);
  return el;
}

function parse(json: string | null): TipData | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as TipData;
    return v && typeof v.title === "string" ? v : null;
  } catch {
    return null;
  }
}

function build(tip: TipData) {
  const box = ensureEl();
  box.replaceChildren();
  const head = document.createElement("div");
  head.className = "bwtip-head";
  if (tip.tag) {
    const tag = document.createElement("span");
    tag.className = "bwtip-tag";
    tag.textContent = tip.tag;
    head.appendChild(tag);
  }
  if (tip.key) {
    const key = document.createElement("kbd");
    key.className = "bwtip-key";
    key.textContent = tip.key;
    head.appendChild(key);
  }
  if (head.childNodes.length) box.appendChild(head);
  const title = document.createElement("div");
  title.className = "bwtip-title";
  title.textContent = tip.title;
  box.appendChild(title);
  if (tip.text) {
    const p = document.createElement("p");
    p.className = "bwtip-text";
    p.textContent = tip.text;
    box.appendChild(p);
  }
  if (tip.rows?.length) {
    const dl = document.createElement("dl");
    dl.className = "bwtip-rows";
    for (const r of tip.rows) {
      const row = document.createElement("div");
      row.className = "bwtip-row";
      if (r.tone) row.dataset.tone = r.tone;
      const dt = document.createElement("dt");
      dt.textContent = r.k;
      const dd = document.createElement("dd");
      dd.textContent = r.v;
      row.append(dt, dd);
      dl.appendChild(row);
    }
    box.appendChild(dl);
  }
  if (tip.note) {
    const n = document.createElement("p");
    n.className = "bwtip-note";
    n.textContent = tip.note;
    box.appendChild(n);
  }
}

/** Places the tag beside its anchor (above, or below when there is no room) or beside the pointer. */
function place() {
  const box = ensureEl();
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  if (pointerMode || !anchor) {
    let left = px + 16;
    let top = py + 18;
    if (left + w > vw - MARGIN) left = px - w - 12;
    if (top + h > vh - MARGIN) top = py - h - 12;
    box.dataset.side = "";
    box.style.left = `${Math.max(MARGIN, left)}px`;
    box.style.top = `${Math.max(MARGIN, top)}px`;
    return;
  }
  const r = anchor.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  let left = Math.min(Math.max(MARGIN, cx - w / 2), vw - w - MARGIN);
  let top = r.top - h - GAP;
  let side = "top";
  if (top < MARGIN) {
    top = r.bottom + GAP;
    side = "bottom";
  }
  box.dataset.side = side;
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.setProperty("--arrow", `${Math.min(Math.max(14, cx - left), w - 14)}px`);
}

function calmFor(root: Element | null): string {
  const r = root as HTMLElement | null;
  const calm = r?.dataset.reduce === "true" || r?.dataset.lowfx === "true";
  return calm ? "1" : "0";
}

function paint(tip: TipData, root: Element | null, json: string) {
  const box = ensureEl();
  if (json !== lastJson) {
    build(tip);
    lastJson = json;
  }
  box.dataset.calm = calmFor(root);
  box.style.fontFamily = anchor ? getComputedStyle(anchor).fontFamily : "";
  place();
}

function show(now: boolean) {
  window.clearTimeout(showTimer);
  if (!anchor) return;
  const run = () => {
    const json = anchor?.getAttribute("data-tip") ?? null;
    const tip = parse(json);
    if (!anchor || !tip) return hide();
    paint(tip, anchor.closest(".ab-root"), json ?? "");
    ensureEl().dataset.on = "1";
    shown = true;
    startRefresh();
  };
  if (now || shown) run();
  else showTimer = window.setTimeout(run, SHOW_DELAY);
}

function hide() {
  window.clearTimeout(showTimer);
  window.clearTimeout(hideTimer);
  window.clearTimeout(touchTimer);
  if (el) el.dataset.on = "0";
  shown = false;
  pinned = false;
  pointerMode = false;
  anchor = null;
  lastJson = "";
  stopRefresh();
}

function scheduleHide() {
  window.clearTimeout(showTimer);
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(hide, HIDE_DELAY);
}

/** While a tag is up, re-read its source so numbers (stock, rates, status) stay live. Stops when the anchor leaves. */
function startRefresh() {
  if (refreshTimer) return;
  refreshTimer = window.setInterval(() => {
    if (!anchor || !anchor.isConnected) {
      if (pinned) return stopRefresh();
      return hide();
    }
    if (pointerMode) return;
    const json = anchor.getAttribute("data-tip") ?? "";
    const tip = parse(json);
    if (!tip) return hide();
    if (json !== lastJson) paint(tip, anchor.closest(".ab-root"), json);
  }, REFRESH);
}

function stopRefresh() {
  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = 0;
}

/**
 * A tag that follows the pointer over the island (canvas hover). Pass null to hide it. `root` is the Brasswork root,
 * so Simple visuals and reduced motion apply.
 */
export function showPointerTip(x: number, y: number, tip: TipData | null, root: Element | null = null) {
  px = x;
  py = y;
  if (!tip) {
    if (pointerMode) hide();
    return;
  }
  if (!pointerMode) {
    anchor = null;
    pointerMode = true;
    shown = true;
  }
  const json = JSON.stringify(tip);
  paint(tip, root, json);
  ensureEl().dataset.on = "1";
}

/** Mounts the layer's listeners once. Render it anywhere inside a Brasswork page. */
export function TipLayer() {
  useEffect(() => {
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      // A canvas tag (pointer mode) ends as soon as the pointer moves onto the page's own controls.
      if (pointerMode && !(e.target as Element | null)?.closest?.("canvas")) hide();
      if (pointerMode) return;
      const t = (e.target as Element | null)?.closest?.("[data-tip]") ?? null;
      if (!t) return scheduleHide();
      window.clearTimeout(hideTimer);
      if (t === anchor) return;
      anchor = t;
      show(false);
    };
    const onOut = (e: PointerEvent) => {
      // The pointer left the window: nothing to hover any more.
      if (e.pointerType !== "touch" && !e.relatedTarget) {
        if (pointerMode) hide();
        else scheduleHide();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (pointerMode) return;
      if (e.pointerType === "touch") {
        const t = (e.target as Element | null)?.closest?.("[data-tip]") ?? null;
        if (!t) return hide();
        anchor = t;
        pinned = true;
        show(true);
        window.clearTimeout(touchTimer);
        touchTimer = window.setTimeout(hide, TOUCH_HOLD);
      } else {
        // A click means the player is acting, so the tag steps aside until the pointer comes back.
        hide();
      }
    };
    const onFocus = (e: FocusEvent) => {
      const t = e.target as Element | null;
      if (!t || pointerMode || !t.matches?.("[data-tip]") || !t.matches(":focus-visible")) return;
      anchor = t;
      show(true);
    };
    // Only the element the tag belongs to can hide it on blur. Focus moving elsewhere must not, and a tap-pinned tag keeps its own timer.
    const onBlur = (e: FocusEvent) => {
      if (!pointerMode && !pinned && e.target === anchor) scheduleHide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    const onScroll = () => {
      if (!pointerMode && anchor) hide();
    };
    const onResize = () => hide();

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onResize);
      hide();
      if (el) el.remove();
      el = null;
    };
  }, []);
  return null;
}
