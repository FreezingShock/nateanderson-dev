// One list of the games on /creations/games/*: names, routes, intro copy, palette theme, the save slot's name and
// the page metadata. Pages and the shell read from here, so a title or share preview is written once.
// Plain data only (no engine imports), so both server pages and client code can use it.
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export type GameId = "brasswork" | "starwright" | "groundbreak" | "node-farm";
export type GameTheme = "brass" | "star" | "ground" | "node";

export type GameEntry = {
    id: GameId;
    name: string;
    path: string;
    /** Label above the page title, matching the hub section the game sits in. */
    eyebrow: string;
    /** Page description, also used for the meta description and share preview. */
    description: string;
    /** Heading of the play section on the page. */
    playTitle: string;
    theme: GameTheme;
    backHref: string;
    backLabel: string;
};

export const GAMES: Record<GameId, GameEntry> = {
    brasswork: {
        id: "brasswork",
        name: "Brasswork",
        path: "/creations/games/brasswork",
        eyebrow: "Automation",
        description: "A 3D automation game in development: a clockwork workshop on a voxel island.",
        playTitle: "Open the workshop.",
        theme: "brass",
        backHref: "/creations/games#automation",
        backLabel: "Back to Games",
    },
    starwright: {
        id: "starwright",
        name: "Starwright",
        path: "/creations/games/starwright",
        eyebrow: "Incremental",
        description: "An idle game about a star. Fuse hydrogen up the periodic table, go supernova, and chart constellations. Saves in your browser.",
        playTitle: "Light your star.",
        theme: "star",
        backHref: "/creations/games#incremental",
        backLabel: "Back to Games",
    },
    groundbreak: {
        id: "groundbreak",
        name: "Groundbreak",
        path: "/creations/games/groundbreak",
        eyebrow: "Incremental",
        description: "An idle game about a construction company. Chain twelve materials from gravel to floors, build a Bay Area skyline job by job, and incorporate to start again with it intact. Saves in your browser.",
        playTitle: "Break ground.",
        theme: "ground",
        backHref: "/creations/games#incremental",
        backLabel: "Back to Games",
    },
    "node-farm": {
        id: "node-farm",
        name: "Node Farm",
        path: "/creations/games/node-farm",
        eyebrow: "Incremental",
        description: "An idle incremental game. Hack the core, buy Multipliers and Reboots, then farm Copper, Silicon, Quartz and Aether. Saves in your browser.",
        playTitle: "Hack the node.",
        theme: "node",
        backHref: "/creations/games#incremental",
        backLabel: "Back to Games",
    },
};

/** Page metadata for a game route. Every game's title, description and share preview come from here. */
export function gameMetadata(id: GameId): Metadata {
    const g = GAMES[id];
    return pageMeta({
        title: g.name,
        description: g.description,
        path: g.path,
        image: "/creations/opengraph-image",
    });
}
