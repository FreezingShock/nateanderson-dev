"use client";

// The "Last played" strip under the home hero. It reads the game the viewer opened last (the per-device record the
// Games hub keeps) and that game's own save line. Client only: the server render holds the strip's height, so the
// page does not shift when the stored values arrive.
import Link from "next/link";
import { useEffect, useState } from "react";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { agoLabel, readLastGame, readSaveInfo, type SaveInfo } from "@/lib/game-launch/launch";

export type PlayedGame = { slug: string; title: string; href: string };

type Found = { game: PlayedGame; info: SaveInfo | null };

function saveLine(info: SaveInfo | null): { text: string; saved: boolean } {
    if (info?.kind === "save") {
        const parts = [info.detail, info.savedAt !== undefined ? agoLabel(info.savedAt) : "saved on this device"];
        return { text: `Continue your save · ${parts.filter(Boolean).join(" · ")}`, saved: true };
    }
    if (info?.kind === "stats") return { text: `Continue your stats · ${info.detail}`, saved: true };
    return { text: "No save yet · starts fresh", saved: false };
}

export function LastPlayed({ games }: { games: PlayedGame[] }) {
    const [ready, setReady] = useState(false);
    const [found, setFound] = useState<Found | null>(null);

    useEffect(() => {
        const slug = readLastGame();
        const game = games.find((g) => g.slug === slug) ?? null;
        setFound(game ? { game, info: readSaveInfo(game.slug) } : null);
        setReady(true);
    }, [games]);

    return (
        <section className="cm-wrap home-last" aria-label="Last played">
            <div className="cm-panel home-last-panel">
                <div className="cm-hbar">
                    <span>Last played</span>
                    <span>{found ? "On this device" : "Games"}</span>
                </div>
                {!ready ? (
                    <div className="hl-body" data-state="pending" aria-hidden="true" />
                ) : found ? (
                    <FoundBody found={found} />
                ) : (
                    <div className="hl-body" data-state="none">
                        <div className="hl-main">
                            <b className="hl-title">no game opened yet</b>
                            <span className="hl-save">Open a game and it shows up here with its save.</span>
                        </div>
                        <Link prefetch={false} className="hl-go" href="/creations/games">
                            <span>Games</span>
                            <span className="hl-arrow" aria-hidden="true"><PixelIcon name="arrowR" size={9} /></span>
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}

function FoundBody({ found }: { found: Found }) {
    const line = saveLine(found.info);
    return (
        <div className="hl-body" data-state="found">
            <div className="hl-main">
                <b className="hl-title">{found.game.title}</b>
                <span className="hl-save">{line.text}</span>
            </div>
            <Link prefetch={false} className="hl-go" href={found.game.href}>
                <span>{line.saved ? "Resume" : "Open"}</span>
                <span className="hl-arrow" aria-hidden="true"><PixelIcon name="arrowR" size={9} /></span>
            </Link>
        </div>
    );
}
