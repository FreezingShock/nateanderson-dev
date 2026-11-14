"use client";
// Brasswork's Settings window: a compact centred panel, sized to its content, grouped under brass headings.
// Click the dark space around it (or press Escape) to close.
import type { HudSettings } from "@/lib/automation/types";
import { uiIconStyle } from "@/lib/automation/icons/ui";
import { ArtDivider, ArtPanel, PanelTitle } from "@/components/brasswork-art";
import "./settings-window.css";

const Ico = ({ id }: { id: string }) => <span className="bws-ico" style={uiIconStyle(id, 32)} aria-hidden="true" />;

function Switch({ label, hint, icon, on, onChange }: { label: string; hint: string; icon: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="bws-row">
            <Ico id={icon} />
            <div className="bws-text">
                <span className="bws-name" id={`bws-${icon}-${label}`}>{label}</span>
                <span className="bws-hint">{hint}</span>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`bws-${icon}-${label}`}
                className="bws-switch"
                onClick={() => onChange(!on)}
            >
                <span className="bws-knob" />
                <span className="bws-state">{on ? "On" : "Off"}</span>
            </button>
        </div>
    );
}

function Pair<T extends string>({ label, hint, icon, value, options, onChange }: {
    label: string; hint: string; icon: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
    return (
        <div className="bws-row">
            <Ico id={icon} />
            <div className="bws-text">
                <span className="bws-name">{label}</span>
                <span className="bws-hint">{hint}</span>
            </div>
            <span className="bws-pair" role="radiogroup" aria-label={label}>
                {options.map((o) => (
                    <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
                        {o.label}
                    </button>
                ))}
            </span>
        </div>
    );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="bws-group" aria-label={title}>
            <h3 className="bws-group-h">{title}</h3>
            {children}
        </section>
    );
}

export function SettingsWindow({ settings, onChange, onClose }: {
    settings: HudSettings; onChange: (patch: Partial<HudSettings>) => void; onClose: () => void;
}) {
    return (
        <div className="bws-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bws-window" role="dialog" aria-label="Settings">
                <ArtPanel>
                    <PanelTitle>Settings</PanelTitle>
                    <div className="bws-body">
                        <Group title="Sound">
                            <Switch icon="sound" label="Sound" hint="Machine clicks, chimes and the workshop hum." on={settings.sound} onChange={(v) => onChange({ sound: v })} />
                        </Group>
                        <ArtDivider />
                        <Group title="Display">
                            <Switch icon="light" label="Simple visuals" hint="Turns off shimmer, scrambling text and sliding panels, and thins the scenery. Helps slower devices." on={settings.lowFx} onChange={(v) => onChange({ lowFx: v })} />
                            <Switch icon="pause" label="Reduce motion" hint="Stops the belts, wind and every animation." on={settings.reduceMotion} onChange={(v) => onChange({ reduceMotion: v })} />
                        </Group>
                        <ArtDivider />
                        <Group title="Numbers">
                            <Switch icon="rates" label="Show rates" hint="Per-minute income under each resource." on={settings.showRates} onChange={(v) => onChange({ showRates: v })} />
                            <Pair icon="stats" label="Number style" hint="12.4k or 12,400." value={settings.numberFormat} options={[{ value: "short", label: "Short" }, { value: "full", label: "Full" }]} onChange={(v) => onChange({ numberFormat: v })} />
                        </Group>
                    </div>
                    <div className="bws-foot">
                        <span>Saved in this browser</span>
                        <button type="button" className="bws-close" onClick={onClose}>Close</button>
                    </div>
                </ArtPanel>
            </div>
        </div>
    );
}
