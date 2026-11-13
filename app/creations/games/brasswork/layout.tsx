import { GameRouteShell } from "@/components/games/shell/game-route-shell";

// Route-level game shell for Brasswork. Three.js is loaded only inside this route (see components/brasswork).
export default function BrassworkLayout({ children }: { children: React.ReactNode }) {
    return <GameRouteShell name="Brasswork">{children}</GameRouteShell>;
}
