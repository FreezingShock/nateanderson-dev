"use client";
// The Node Farm settings block (shown in the Menu window as config/node.cfg). Everything here is kept per device, not in the save.
// Effects level lives in lib/nodefarm/fx.ts; the other switches are owned by node-farm.tsx and come in as props.
import { FX_MODES, setFxMode, useFxMode, useLowFx, type FxMode } from "@/lib/nodefarm/fx";
import type { NumFmt } from "@/lib/nodefarm/engine";
import { NF_SYSTEMS, resetMix, setVol, useMix } from "@/lib/nodefarm/sound";
import { Frame } from "./win-kit";

const FORMATS: [NumFmt, string][] = [["short", "1.2M"], ["sci", "1.2e6"], ["eng", "1.2e6 / e3"]];
const FX_NOTE: Record<FxMode, string> = {
    full: "everything runs",
    low: "no drifting layers, loops or blurs: for slow machines",
    auto: "low on slow devices or when reduced motion is on",
};

export type SettingsProps = {
    soundOn: boolean; onSound: () => void; humOn: boolean; onHum: () => void; eventsOn: boolean; onEvents: () => void;
    volume: number; onVolume: (v: number) => void; calm: boolean; osCalm: boolean; onCalm: () => void; jumpOn: boolean; onJump: () => void;
    numFmt: NumFmt; onNumFmt: (f: NumFmt) => void;
};

type Line = { key: string; on: boolean; flip: () => void; note: string; off?: boolean };

export function SettingsFrame(p: SettingsProps) {
    const fx = useFxMode();
    const low = useLowFx();
    const mix = useMix();
    const group = (title: string, lines: Line[], extra?: React.ReactNode) => (
        <li className="nf-st-g" key={title}>
            <p className="nf-st-h">{"# "}{title}</p>
            <ul className="nf-wk-cfg">
                {lines.map((o) => (
                    <li key={o.key}>
                        <button type="button" role="switch" aria-checked={o.on} disabled={o.off} onClick={o.flip}>
                            <span className="nf-wk-box" aria-hidden="true">{o.on ? "x" : " "}</span>
                            <span className="nf-wk-k">{o.key}</span>
                            <span className="nf-wk-eq" aria-hidden="true">=</span>
                            <b>{o.on ? "on" : "off"}</b>
                            <span className="nf-wk-c">{"// "}{o.note}</span>
                        </button>
                    </li>
                ))}
                {extra}
            </ul>
        </li>
    );
    return (
        <Frame i={1} color="#b6f04a" path="config/node.cfg" title="Settings" note="Kept on this device, not in the save. Click a line to flip it.">
            <ul className="nf-st">
                {group("sound", [
                    { key: "sound", on: p.soundOn, flip: p.onSound, note: "naOS clicks, prints and alarms" },
                    { key: "hum", on: p.humOn, flip: p.onHum, note: "the reactor's low drone" },
                ], (
                    <li className="nf-wk-cfgrow">
                        <label>
                            <span className="nf-wk-box" aria-hidden="true">~</span>
                            <span className="nf-wk-k">volume</span>
                            <span className="nf-wk-eq" aria-hidden="true">=</span>
                            <b>{Math.round(p.volume * 100)}%</b>
                            <input type="range" min={0} max={1} step={0.05} value={p.volume} onChange={(e) => p.onVolume(Number(e.target.value))} aria-label="Master volume (all site sounds)" />
                        </label>
                    </li>
                ))}
                <li className="nf-st-g" key="mix">
                    <p className="nf-st-h">{"# "}mix {"// click a name to hear it"}</p>
                    <ul className="nf-wk-cfg">
                        {NF_SYSTEMS.map((m) => (
                            <li className="nf-wk-cfgrow" key={m.id}>
                                <div>
                                    <span className="nf-wk-box" aria-hidden="true">~</span>
                                    {m.id === "hum" ? <span className="nf-wk-k">{m.label}</span> : <button type="button" className="nf-wk-k" onClick={m.sample} aria-label={`Play a ${m.label} sound`}>{m.label}</button>}
                                    <span className="nf-wk-eq" aria-hidden="true">=</span>
                                    <b>{Math.round(mix[m.id] * 100)}%</b>
                                    <input type="range" min={0} max={1} step={0.05} value={mix[m.id]} onChange={(e) => setVol(m.id, Number(e.target.value))} aria-label={`${m.label} volume: ${m.note}`} />
                                    <span className="nf-wk-c">{"// "}{m.note}</span>
                                </div>
                            </li>
                        ))}
                        <li className="nf-wk-cfgrow"><div><span className="nf-wk-box" aria-hidden="true">~</span><button type="button" className="nf-wk-k" onClick={resetMix}>reset mix</button></div></li>
                    </ul>
                </li>
                {group("motion", [
                    { key: "calm", on: p.calm || p.osCalm, flip: p.onCalm, off: p.osCalm, note: p.osCalm ? "your device already asks for less motion" : "less motion: no pops, flashes or loops" },
                ], (
                    <li className="nf-wk-cfgrow">
                        <div role="group" aria-label="Effects level">
                            <span className="nf-wk-box" aria-hidden="true">~</span>
                            <span className="nf-wk-k">effects</span>
                            <span className="nf-wk-eq" aria-hidden="true">=</span>
                            <span className="nf-wk-pick">
                                {FX_MODES.map((m) => <button key={m} type="button" aria-pressed={fx === m} onClick={() => setFxMode(m)}>{m}</button>)}
                            </span>
                            <span className="nf-wk-c">{"// "}{FX_NOTE[fx]}{fx === "auto" ? ` (now ${low ? "low" : "full"})` : ""}</span>
                        </div>
                    </li>
                ))}
                {group("play", [
                    { key: "events", on: p.eventsOn, flip: p.onEvents, note: "zone events every few minutes" },
                    { key: "jump", on: p.jumpOn, flip: p.onJump, note: "scroll to the board when you come back to a save" },
                ], (
                    <li className="nf-wk-cfgrow">
                        <div role="group" aria-label="Number format">
                            <span className="nf-wk-box" aria-hidden="true">~</span>
                            <span className="nf-wk-k">numbers</span>
                            <span className="nf-wk-eq" aria-hidden="true">=</span>
                            <span className="nf-wk-pick">
                                {FORMATS.map(([k, ex]) => <button key={k} type="button" aria-pressed={p.numFmt === k} onClick={() => p.onNumFmt(k)}>{ex}</button>)}
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </Frame>
    );
}
