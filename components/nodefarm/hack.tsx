"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound/sounds";

// The intrusion trace: a short memory-and-keys hack. A four-step sequence is shown for a moment, then you key it back in
// order before the timer runs out. Win for an Overclock; a wrong key or a timeout loses the trace.
const KEYS = [
    { g: "◆", c: "#2fd8e8", n: "diamond" },
    { g: "▲", c: "#b6f04a", n: "triangle" },
    { g: "●", c: "#ff2d8a", n: "circle" },
    { g: "■", c: "#f0a53c", n: "square" },
];
const LEN = 4;
const SHOW_MS = 2600;
const PLAY_MS = 6000;

export function Hack({ onDone }: { onDone: (won: boolean) => void }) {
    const [seq] = useState(() => Array.from({ length: LEN }, () => Math.floor(Math.random() * 4)));
    const [phase, setPhase] = useState<"show" | "play">("show");
    const [step, setStep] = useState(0);
    const [bad, setBad] = useState(-1);
    const done = useRef(false);
    const finish = (won: boolean) => {
        if (done.current) return;
        done.current = true;
        onDone(won);
    };

    useEffect(() => {
        const t = setTimeout(() => setPhase("play"), SHOW_MS);
        return () => clearTimeout(t);
    }, []);
    useEffect(() => {
        if (phase !== "play") return;
        const t = setTimeout(() => finish(false), PLAY_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    const key = (k: number) => {
        if (phase !== "play" || done.current) return;
        if (k === seq[step]) {
            sfx("tap");
            if (step + 1 >= LEN) finish(true);
            else setStep(step + 1);
        } else {
            sfx("deny");
            setBad(k);
            setTimeout(() => finish(false), 350);
        }
    };

    return (
        <div className="nf-hack" role="dialog" aria-label="Intrusion trace">
            <div className="nf-hack-top"><b>TRACE // INTRUSION</b><span>{phase === "show" ? "memorize the sequence" : "key it in"}</span></div>
            <ol className="nf-hack-seq" aria-label={phase === "show" ? `Sequence: ${seq.map((i) => KEYS[i].n).join(", ")}` : "Sequence hidden"}>
                {seq.map((k, i) => (
                    <li key={i} data-lit={phase === "show" || i < step ? "" : undefined} style={{ ["--c" as string]: KEYS[k].c }}>
                        {phase === "show" || i < step ? KEYS[k].g : "?"}
                    </li>
                ))}
            </ol>
            <div className="nf-hack-keys">
                {KEYS.map((k, i) => (
                    <button key={i} type="button" disabled={phase !== "play"} data-bad={bad === i ? "" : undefined} style={{ ["--c" as string]: k.c }} aria-label={k.n} onClick={() => key(i)}>
                        {k.g}
                    </button>
                ))}
            </div>
            <div className="nf-hack-bar" data-phase={phase} aria-hidden="true"><i /></div>
        </div>
    );
}
