"use client";
// The volume rows of the Settings window's Sound group: master, effects and ambient. They sit under the Sound switch
// (which mutes everything) and are saved in this browser by lib/automation/audio.
import { useSyncExternalStore } from "react";
import { Row } from "@/components/automation/settings-window";
import { getMix, playSound, setMix, subscribeMix, type Mix } from "@/lib/automation/audio";
import "./audio-rows.css";

const SERVER_MIX: Mix = { master: 0.8, effects: 0.9, ambient: 0.6 };

const ROWS: { key: keyof Mix; icon: string; label: string; hint: string; hear: () => void }[] = [
    { key: "master", icon: "sound", label: "Master volume", hint: "Everything at once.", hear: () => playSound("press") },
    { key: "effects", icon: "sound", label: "Effects", hint: "Placing, belts, menus, machines and deliveries.", hear: () => playSound("place") },
    { key: "ambient", icon: "sound", label: "Ambience", hint: "Wind, water, clockwork and the workshop hum.", hear: () => playSound("delivery") },
];

export function VolumeRows() {
    const mix = useSyncExternalStore(subscribeMix, getMix, () => SERVER_MIX);
    return (
        <>
            {ROWS.map((r) => (
                <Row key={r.key} icon={r.icon} label={r.label} hint={r.hint}>
                    <span className="bwa-range">
                        <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={Math.round(mix[r.key] * 100)}
                            aria-label={r.label}
                            onChange={(e) => setMix({ [r.key]: Number(e.target.value) / 100 })}
                            onPointerUp={r.hear}
                            onKeyUp={(e) => { if (e.key.startsWith("Arrow")) r.hear(); }}
                        />
                        <output>{Math.round(mix[r.key] * 100)}</output>
                    </span>
                </Row>
            ))}
        </>
    );
}
