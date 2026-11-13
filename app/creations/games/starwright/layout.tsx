import { GameRouteShell } from "@/components/games/shell/game-route-shell";
import { StarwrightRouteChrome } from "@/components/starwright/route-chrome";
import "@/app/camino/starwright.css";

// Route-level game shell for Starwright (full screen, manual pause, hidden-tab handling).
export default function StarwrightLayout({ children }: { children: React.ReactNode }) {
    return (
        <GameRouteShell name="Starwright">
            <StarwrightRouteChrome />
            {children}
        </GameRouteShell>
    );
}
