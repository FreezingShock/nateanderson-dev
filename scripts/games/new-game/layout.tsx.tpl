import { GameRouteShell } from "@/components/games/shell/game-route-shell";
import "@/app/camino/__SLUG__.css";

// Route shell for __NAME__: the site page with its intro, and the game in a windowed panel (components/games/shell).
export default function __CAMEL__Layout({ children }: { children: React.ReactNode }) {
    return (
        <GameRouteShell name="__NAME__" game="__SLUG__" mode="windowed">
            {children}
        </GameRouteShell>
    );
}
