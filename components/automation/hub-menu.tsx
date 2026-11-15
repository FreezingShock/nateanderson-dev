"use client";

import { ArtIcon, UiArtIcon } from "@/components/brasswork-art/icons";
import { useEffect, useRef, useState } from "react";
import { MenuWindow } from "@/components/brasswork-ui/window";
import { MachinePortrait } from "@/components/brasswork-art";
import { iconStyle } from "@/lib/automation/icons";
import { uiIconStyle } from "@/lib/automation/icons/ui";
import type { HubStep, HubUnlock, HubView } from "@/lib/automation/types";
import "./hub-menu.css";

/** Anything can open the hub menu: the host on a click on the hub building, a button, the goal strip. */
export const HUB_OPEN_EVENT = "bw:open-hub";
export function openHubMenu(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(HUB_OPEN_EVENT));
}

const STAGE_NAMES = ["Bare hall", "Clock tower", "Smokestacks", "Patina dome"];

function UnlockTile({ u }: { u: HubUnlock }) {
  return (
    <li className="hm-open" data-kind={u.kind}>
      {u.kind === "blueprints" ? (
        <UiArtIcon id="blueprints" size={48} name="Blueprints" className="hm-open-ico" />
      ) : (
        <ArtIcon id={u.icon ?? u.id} size={48} name={u.name} className="hm-open-ico" />
      )}
      <span className="hm-open-name">{u.name}</span>
      <span className="hm-open-kind">{u.kind === "recipe" ? "recipe" : u.kind === "machine" ? "build" : u.kind === "crate" ? "crate" : "research"}</span>
    </li>
  );
}

function Slip({ step, index, total }: { step: HubStep; index: number; total: number }) {
  const label = step.kind === "request" ? "Order" : step.id === "commission" ? "Commission" : "Milestone";
  return (
    <article className="hm-slip" data-state={step.state} aria-label={`${label}: ${step.name}`}>
      <header className="hm-slip-head">
        <span className="hm-slip-no">{step.id === "commission" ? label : `${label} ${index} of ${total}`}</span>
        {step.state === "done" && <span className="hm-stamp" aria-label="Filled">Filled</span>}
        {step.state === "now" && <span className="hm-slip-state">Open now</span>}
        {step.state === "ahead" && <span className="hm-slip-state" data-wait="true">Waiting</span>}
      </header>
      <h3 className="hm-slip-title">{step.name}</h3>
      {step.note && <p className="hm-slip-note">{step.note}</p>}

      <h4 className="hm-kick">Deliver to the hub</h4>
      <ul className="hm-items">
        {step.items.map((it) => {
          const pct = Math.round((it.have / it.need) * 100);
          return (
            <li key={it.id} className="hm-item" data-full={it.have >= it.need}>
              <ArtIcon id={it.id} size={48} name={it.name} className="hm-item-ico" />
              <span className="hm-item-name">{it.name}</span>
              <span className="hm-item-count">{it.have} / {it.need}</span>
              <span className="hm-bar" role="progressbar" aria-label={`${it.name} delivered`} aria-valuemin={0} aria-valuemax={it.need} aria-valuenow={it.have}>
                <i style={{ width: `${pct}%` }} />
              </span>
            </li>
          );
        })}
      </ul>

      <h4 className="hm-kick">{step.state === "done" ? "Opened" : "Opens"}</h4>
      <ul className="hm-opens">{step.unlocks.map((u) => <UnlockTile key={`${u.kind}-${u.id}`} u={u} />)}</ul>

      {step.state === "now" && <p className="hm-hint">Belt these into the hub, or drop them in with a loader. Everything the hub receives counts.</p>}
    </article>
  );
}

/**
 * The hub menu: what the hub wants next, how much has arrived, and what each delivery opens.
 * Early orders open recipes and machines directly; the milestones after them pay blueprints for research.
 */
export function HubMenu({ hub, onClose }: { hub: HubView; onClose: () => void }) {
  const now = hub.steps.findIndex((s) => s.state === "now");
  const [sel, setSel] = useState(now >= 0 ? now : Math.max(0, hub.steps.length - 1));
  const step = hub.steps[sel];
  const orders = hub.steps.filter((s) => s.kind === "request");
  const indexOf = (s: HubStep) => hub.steps.filter((x) => x.kind === s.kind).findIndex((x) => x.id === s.id) + 1;
  if (!step) return null;
  const listed = (kind: HubStep["kind"]) => hub.steps.map((s, i) => ({ s, i })).filter((x) => x.s.kind === kind);

  const row = ({ s, i }: { s: HubStep; i: number }) => (
    <li key={s.id}>
      <button type="button" className="hm-row" data-state={s.state} aria-current={i === sel} onClick={() => setSel(i)}>
        <span className="hm-dot" data-state={s.state} aria-hidden="true">
          {s.state === "done" ? <span style={uiIconStyle("done", 20)} /> : s.state === "ahead" ? <span style={uiIconStyle("lock", 20)} /> : <b />}
        </span>
        <span className="hm-row-name">{s.name}</span>
        {s.state === "now" && <span className="hm-row-pct">{Math.round(s.progress * 100)}%</span>}
      </button>
    </li>
  );

  return (
    <MenuWindow title="Hub" label="Hub" size="wide" variant="settle" art={<MachinePortrait id="hub" size={32} />} onClose={onClose}>
      <div className="hm-wrap">
        <aside className="hm-side" aria-label="Hub ladder">
          <div className="hm-hall">
            <MachinePortrait id="hub" size={96} label="The hub" />
            <div className="hm-hall-txt">
              <span className="hm-hall-stage">{STAGE_NAMES[hub.stage] ?? "Counting hall"}</span>
              <span className="hm-hall-count">{hub.doneCount} of {hub.steps.length} filled</span>
              <span className="hm-hall-bp"><span style={uiIconStyle("blueprints", 20)} aria-hidden="true" />{hub.blueprints} blueprints</span>
            </div>
          </div>
          <h4 className="hm-kick">Orders · open recipes and machines</h4>
          <ol className="hm-ladder">{listed("request").map(row)}</ol>
          <h4 className="hm-kick">Milestones · pay blueprints</h4>
          <ol className="hm-ladder">{listed("milestone").map(row)}</ol>
        </aside>
        <Slip step={step} index={indexOf(step)} total={step.kind === "request" ? orders.length : hub.steps.length - orders.length} />
      </div>
    </MenuWindow>
  );
}

/** A short toast when the hub fills an order: the recipes and machines it just opened. Non-blocking. */
export function HubToast({ hub, onOpen }: { hub: HubView; onOpen: () => void }) {
  const seen = useRef<Set<string> | null>(null);
  const [toast, setToast] = useState<HubStep | null>(null);
  useEffect(() => {
    const done = new Set(hub.steps.filter((s) => s.state === "done" && s.kind === "request").map((s) => s.id));
    if (seen.current === null) { seen.current = done; return; } // the first read is the saved state, not news
    const fresh = hub.steps.find((s) => done.has(s.id) && !seen.current!.has(s.id));
    seen.current = done;
    if (fresh) setToast(fresh);
  }, [hub]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="hm-toast" role="status">
      <span className="hm-toast-kick">Order filled</span>
      <span className="hm-toast-name">{toast.name}</span>
      <span className="hm-toast-opens">Opened: {toast.unlocks.map((u) => u.name).join(", ")}</span>
      <button type="button" className="hm-toast-btn" onClick={() => { setToast(null); onOpen(); }}>Open hub</button>
    </div>
  );
}
