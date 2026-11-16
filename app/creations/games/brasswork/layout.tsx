import { GameRouteShell } from "@/components/games/shell/game-route-shell";
import "@/app/camino/brasswork.css";
import { bwFontClass } from "@/lib/brasswork/fonts";

// Route shell for Brasswork: the site page with its intro, and the game in a windowed panel (components/games/shell).
// Three.js is loaded only inside this route (see components/brasswork).
export default function BrassworkLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={bwFontClass} style={{ display: "contents" }}>
            <GameRouteShell name="Brasswork" game="brasswork" mode="windowed">
                {children}
            </GameRouteShell>
        </div>
    );
}
