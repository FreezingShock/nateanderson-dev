import { GameRouteShell } from "@/components/games/shell/game-route-shell";
import { BrassworkRouteChrome } from "@/components/brasswork/route-chrome";
import "@/app/camino/brasswork.css";
import { bwFontClass } from "@/lib/brasswork/fonts";

// Route-level game shell for Brasswork. Three.js is loaded only inside this route (see components/brasswork).
export default function BrassworkLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={bwFontClass} style={{ display: "contents" }}>
            <GameRouteShell name="Brasswork">
                <BrassworkRouteChrome />
                {children}
            </GameRouteShell>
        </div>
    );
}
