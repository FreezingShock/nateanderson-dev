"use client";

import { LOGS } from "@/lib/nodefarm/content/story";
import { NF_KEY_GROUPS } from "@/lib/nodefarm/keys";

// The side panel beside Node Farm on its page: the game's first log, the key list, and the save tools. It reads no game state.
// It talks to the game only through two window events the game already listens for: nf:win opens a window, nf:fs turns
// full screen on. The game keeps its own save and its own keyboard.

const openWindow = (w: "menu" | "map" | "goals" | "records") =>
    window.dispatchEvent(new CustomEvent("nf:win", { detail: { w } }));
const openFullScreen = () => window.dispatchEvent(new CustomEvent("nf:fs", { detail: { on: true } }));
const openKeys = () => window.dispatchEvent(new Event("cm:keys"));

const LEAD = LOGS[0];
// Keys that are always there. Rows that unlock later (tree, lab, handover, stress) stay out of the first read.
const KEY_ROWS = NF_KEY_GROUPS.filter((g) => g.title !== "Node Farm: in a window or event")
    .flatMap((g) => g.rows)
    .filter((r) => !r.needs);

export function NodeFarmSide() {
    return (
        <aside className="nf-side" aria-label="About Node Farm">
            <section className="nf-card nf-story" aria-labelledby="nf-story-h">
                <div className="nf-card-top">
                    <span className="nf-card-sys">naOS // log 001</span>
                </div>
                <h3 id="nf-story-h" className="nf-card-h">{LEAD.title}</h3>
                <p className="nf-card-p">{LEAD.text}</p>
                <p className="nf-card-note">More logs come in as you play.</p>
            </section>

            <section className="nf-card nf-controls" aria-labelledby="nf-controls-h">
                <div className="nf-card-top">
                    <span className="nf-card-sys">naOS // keys</span>
                </div>
                <h3 id="nf-controls-h" className="nf-card-h">Controls</h3>
                <dl className="nf-keys">
                    {KEY_ROWS.map((r) => (
                        <div key={r.label} className="nf-key">
                            <dt>{r.keys.map((k) => <kbd key={k}>{k}</kbd>)}</dt>
                            <dd>{r.label}</dd>
                        </div>
                    ))}
                </dl>
                <button type="button" className="nf-side-btn" onClick={openKeys}>All keys and shortcuts <kbd>?</kbd></button>
            </section>

            <section className="nf-card nf-saves" aria-labelledby="nf-saves-h">
                <div className="nf-card-top">
                    <span className="nf-card-sys">naOS // save</span>
                </div>
                <h3 id="nf-saves-h" className="nf-card-h">Save and view</h3>
                <p className="nf-card-p">Saves in this browser. Away time counts up to 8 hours.</p>
                <div className="nf-side-acts">
                    <button type="button" className="nf-side-btn" onClick={() => openWindow("menu")}>Save code and settings</button>
                    <button type="button" className="nf-side-btn" onClick={() => openWindow("map")}>Map</button>
                    <button type="button" className="nf-side-btn" onClick={() => openWindow("goals")}>Goals</button>
                    <button type="button" className="nf-side-btn" onClick={() => openWindow("records")}>Records</button>
                </div>
                <button type="button" className="nf-side-btn nf-side-full" onClick={openFullScreen}>
                    Full screen <kbd>F</kbd>
                </button>
            </section>
        </aside>
    );
}
