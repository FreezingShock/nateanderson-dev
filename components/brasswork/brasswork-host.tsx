"use client";

// Mount point for Brasswork. The game pieces live in their own folders and are wired in here as they land:
//   lib/automation/sim (simulation), render (voxel island), data (recipes), input (camera, placement),
//   components/automation (panels, HUD).
// Three.js must only be imported from the render folder through a dynamic import, so other routes stay light.
import { useGameShell } from "@/components/games/shell/game-route-shell";

const PIECES = [
    { name: "Simulation", folder: "lib/automation/sim" },
    { name: "Island renderer", folder: "lib/automation/render" },
    { name: "Recipes", folder: "lib/automation/data" },
    { name: "Camera and placement", folder: "lib/automation/input" },
    { name: "Panels and HUD", folder: "components/automation" },
];

export function BrassworkHost() {
    const { paused } = useGameShell();
    return (
        <div className="bw-host" data-paused={paused || undefined}>
            <p className="bw-lead">Brasswork is not playable yet.</p>
            <ul className="bw-pieces" aria-label="Build status">
                {PIECES.map((p) => (
                    <li key={p.folder}>
                        <span>{p.name}</span>
                        <code>{p.folder}</code>
                        <em>in progress</em>
                    </li>
                ))}
            </ul>
        </div>
    );
}
