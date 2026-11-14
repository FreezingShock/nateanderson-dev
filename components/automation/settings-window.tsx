"use client";
// Brasswork's Settings window: a compact centred panel, sized to its content, grouped under brass headings.
// Click the dark space around it (or press Escape) to close.
import type { HudSettings } from "@/lib/automation/types";
import { uiIconStyle } from "@/lib/automation/icons/ui";
import { MenuWindow } from "@/components/brasswork-ui/window";
import "./settings-window.css";

export const Ico = ({ id }: { id: string }) => <span className="bws-ico" style={uiIconStyle(id, 32)} aria-hidden="true" />;

function Switch({ label, hint, icon, on, onChange }: { label: string; hint: string; icon: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="bws-row">
            <Ico id={icon} />
            <div className="bws-text">
                <span className="bws-name" id={`bws-${icon}-${label}`}>{label}</span>
                <span className="bws-hint">{hint}</span>
            </div>
            <span className="bws-lamp" data-on={on ? "true" : "false"} aria-hidden="true" />
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

/** A row with an icon, a name, a one-line explanation and a control. `stack` puts a wide control on its own line. */
export function Row({ icon, label, hint, stack, children }: { icon: string; label: string; hint: string; stack?: boolean; children: React.ReactNode }) {
    return (
        <div className="bws-row" data-stack={stack ? "true" : undefined}>
            <Ico id={icon} />
            <div className="bws-text">
                <span className="bws-name">{label}</span>
                <span className="bws-hint">{hint}</span>
            </div>
            {children}
        </div>
    );
}

export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
    return (
        <span className="bws-pair" data-n={options.length} role="radiogroup" aria-label={label}>
            {options.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
                    {o.label}
                </button>
            ))}
        </span>
    );
}

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="bws-group" aria-label={title}>
            <h3 className="bws-group-h">{title}</h3>
            {children}
        </section>
    );
}

export type SettingsSlots = { display?: React.ReactNode; save?: React.ReactNode };

export function SettingsWindow({ settings, onChange, onClose, slots }: {
    settings: HudSettings; onChange: (patch: Partial<HudSettings>) => void; onClose: () => void; slots?: SettingsSlots;
}) {
    return (
        <MenuWindow title="Workshop controls" label="Settings" art={<span className="bws-spin"><Ico id="settings" /></span>} onClose={onClose}>
            <div className="bws-body" data-panel="controls">
                        <Group title="Sound">
                            <Switch icon="sound" label="Sound" hint="Machine clicks, chimes and the workshop hum." on={settings.sound} onChange={(v) => onChange({ sound: v })} />
                        </Group>
                        <Group title="Display">
                            <Switch icon="light" label="Simple visuals" hint="No shimmer, scrambling text or sliding panels, and fewer plants. Helps slower devices." on={settings.lowFx} onChange={(v) => onChange({ lowFx: v })} />
                            <Switch icon="pause" label="Reduce motion" hint="Stops the belts, wind and every animation." on={settings.reduceMotion} onChange={(v) => onChange({ reduceMotion: v })} />
                            {slots?.display}
                        </Group>
                        <Group title="Numbers">
                            <Switch icon="rates" label="Show rates" hint="Per-minute income under each resource." on={settings.showRates} onChange={(v) => onChange({ showRates: v })} />
                            <Row icon="stats" label="Number style" hint="12.4k or 12,400."><Choice label="Number style" value={settings.numberFormat} options={[{ value: "short", label: "Short" }, { value: "full", label: "Full" }]} onChange={(v) => onChange({ numberFormat: v })} /></Row>
                        </Group>
                        {slots?.save && (
                            <>
                                        <Group title="Save and leave">{slots.save}</Group>
                            </>
                        )}
                        <p className="bws-note">Changes apply at once and are saved in this browser.</p>
            </div>
        </MenuWindow>
    );
}
