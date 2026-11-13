import { GameRouteShell } from "@/components/games/shell/game-route-shell";

// Route-level game shell for Node Farm. Only wraps the route: game internals (lib/nodefarm, components/nodefarm) are untouched.
export default function NodeFarmLayout({ children }: { children: React.ReactNode }) {
    return <GameRouteShell name="Node Farm">{children}</GameRouteShell>;
}
