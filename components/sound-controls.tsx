"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSoundPrefs } from "@/lib/sound/use-sound";
import { sfx } from "@/lib/sound/sounds";

/** A small speaker button that mutes and unmutes every sound on the site. */
export function SoundToggle({ className = "" }: { className?: string }) {
    const [p, set] = useSoundPrefs();
    return (
        <button
            type="button"
            data-snd="off"
            aria-label={p.on ? "Mute sound" : "Unmute sound"}
            aria-pressed={!p.on}
            onClick={() => {
                set({ on: !p.on });
                if (!p.on) setTimeout(() => sfx("on"), 40);
            }}
            className={`flex size-8 items-center justify-center rounded-full text-foreground/80 transition-colors hover:text-foreground ${className}`}
        >
            {p.on ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
    );
}

const rows = [
    { k: "master", label: "Master", test: "buy" },
    { k: "ui", label: "Site and menus", test: "tap" },
    { k: "game", label: "Games", test: "bulk" },
] as const;

/** On/off plus master, interface and game volume. Shared by the account settings and the game's settings tab. */
export function SoundPanel({ game = false }: { game?: boolean }) {
    const [p, set] = useSoundPrefs();
    return (
        <div className="space-y-2">
            <button
                type="button"
                role="switch"
                aria-checked={p.on}
                data-snd="off"
                onClick={() => {
                    set({ on: !p.on });
                    if (!p.on) setTimeout(() => sfx("on"), 40);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 font-rubik text-xs"
            >
                Sound effects
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: p.on ? "color-mix(in oklch, var(--cm-good) 20%, transparent)" : "color-mix(in oklch, var(--muted-foreground) 20%, transparent)", color: p.on ? "var(--cm-good)" : undefined }}>
                    {p.on ? "ON" : "OFF"}
                </span>
            </button>
            {rows.map((r) => (
                <label key={r.k} className="flex items-center gap-3 font-rubik text-xs" style={{ opacity: p.on ? 1 : 0.45 }}>
                    <span className="w-28 shrink-0 text-muted-foreground">{r.label}</span>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(p[r.k] * 100)}
                        disabled={!p.on}
                        data-snd="off"
                        aria-label={`${r.label} volume`}
                        onChange={(e) => set({ [r.k]: Number(e.target.value) / 100 })}
                        onPointerUp={() => sfx(r.test)}
                        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--cm-cyan)]"
                    />
                    <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">{Math.round(p[r.k] * 100)}%</span>
                </label>
            ))}
            {game && (
                <div className="rounded-lg border border-white/10 p-3" style={{ opacity: p.on ? 1 : 0.45 }}>
                    <label className="flex items-center gap-3 font-rubik text-xs">
                        <span className="w-28 shrink-0 text-foreground">Big button</span>
                        <input
                            type="range"
                            min={0}
                            max={30}
                            value={p.clickMute}
                            disabled={!p.on}
                            data-snd="off"
                            aria-label="Mute the big button sound after this many seconds of continuous clicking"
                            onChange={(e) => set({ clickMute: Number(e.target.value) })}
                            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--cm-cyan)]"
                        />
                        <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">{p.clickMute === 0 ? "Never" : `${p.clickMute}s`}</span>
                    </label>
                    <p className="mt-1.5 font-rubik text-[10px] leading-snug text-muted-foreground">
                        {p.clickMute === 0
                            ? "The button always makes its sound."
                            : `After ${p.clickMute} second${p.clickMute === 1 ? "" : "s"} of non-stop clicking the button fades to silent. Pause for a moment and it comes back.`}
                    </p>
                </div>
            )}
        </div>
    );
}
