"use client";

// The "continue your save" line on each Games hub card. It reads the game's own save key on the client only,
// so the server render and the first client render match, and the line reserves its height while it waits.
import { useEffect, useState } from "react";
import { agoLabel, readLastGame, readSaveInfo, type SaveInfo } from "@/lib/game-launch/launch";

export function ResumeLine({ slug }: { slug: string }) {
    const [ready, setReady] = useState(false);
    const [info, setInfo] = useState<SaveInfo | null>(null);
    const [last, setLast] = useState(false);

    useEffect(() => {
        setInfo(readSaveInfo(slug));
        setLast(readLastGame() === slug);
        setReady(true);
    }, [slug]);

    if (!ready) {
        return <p className="gl-resume" data-state="pending" aria-hidden="true">&nbsp;</p>;
    }

    let text: string;
    let state: "saved" | "fresh";
    if (info?.kind === "save") {
        state = "saved";
        const parts = [info.detail, info.savedAt !== undefined ? agoLabel(info.savedAt) : "saved on this device"].filter(Boolean);
        text = `Continue your save · ${parts.join(" · ")}`;
    } else if (info?.kind === "stats") {
        state = "saved";
        text = `Continue your stats · ${info.detail}`;
    } else {
        state = "fresh";
        text = "No save yet · starts fresh";
    }

    return (
        <p className="gl-resume" data-state={state}>
            {last && <span className="gl-last">Last played</span>}
            <span>{text}</span>
        </p>
    );
}
