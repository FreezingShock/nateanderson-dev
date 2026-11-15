import { GameRouteShell } from "@/components/games/shell/game-route-shell";
import { gbFontClass } from "@/lib/groundbreak-fonts/fonts";
import "@/app/camino/groundbreak.css";

// Route-level game shell for Groundbreak (full screen, manual pause, hidden-tab handling) plus its own faces.
export default function GroundbreakLayout({ children }: { children: React.ReactNode }) {
    return (
        <GameRouteShell name="Groundbreak">
            <div className={gbFontClass}>{children}</div>
        </GameRouteShell>
    );
}
