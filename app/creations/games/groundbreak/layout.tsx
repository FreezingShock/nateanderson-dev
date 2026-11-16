import { GameRouteShell } from "@/components/games/shell/game-route-shell";
import "@/app/camino/groundbreak.css";

// Route shell for Groundbreak: the site page with its intro, and the game in a windowed panel (components/games/shell).
export default function GroundbreakLayout({ children }: { children: React.ReactNode }) {
    return (
        <GameRouteShell name="Groundbreak" game="groundbreak" mode="windowed">
            {children}
        </GameRouteShell>
    );
}
