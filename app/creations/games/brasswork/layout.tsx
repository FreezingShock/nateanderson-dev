import { GameRouteShell } from "@/components/games/shell/game-route-shell";
import { BrassworkRouteChrome } from "@/components/brasswork/route-chrome";
import "@/app/camino/brasswork.css";

// Route-level game shell for Brasswork. Three.js is loaded only inside this route (see components/brasswork).
export default function BrassworkLayout({ children }: { children: React.ReactNode }) {
    return (
        <GameRouteShell name="Brasswork">
            <BrassworkRouteChrome />
            {children}
        </GameRouteShell>
    );
}
