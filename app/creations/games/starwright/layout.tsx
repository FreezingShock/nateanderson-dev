import { GameRouteShell } from "@/components/games/shell/game-route-shell";
import "@/app/camino/starwright.css";
import "@/app/camino/starwright-ev.css";

// Route shell for Starwright: the site page with its intro, and the game in a windowed panel (components/games/shell).
export default function StarwrightLayout({ children }: { children: React.ReactNode }) {
    return (
        <GameRouteShell name="Starwright" game="starwright" mode="windowed">
            {children}
        </GameRouteShell>
    );
}
