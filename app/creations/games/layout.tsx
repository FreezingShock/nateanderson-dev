import "@/app/camino/game-launch.css";
import { GameLaunchLayer } from "@/components/game-launch/launch-layer";

// Shared layout for the Games hub and every game route. It only adds the launch and exit cover, which sits outside
// the page so it can play across the route change. Each game keeps its own layout and shell.
export default function GamesLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <GameLaunchLayer />
        </>
    );
}
