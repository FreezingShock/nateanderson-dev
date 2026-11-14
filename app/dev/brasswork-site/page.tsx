import { notFound } from "next/navigation";
import SiteShot from "./site-shot";

// Renders one prestige site with the game's own renderer, for scripts/brasswork/render-sites.mjs.
// Hidden in production builds unless VOXEL_BENCH=1 is set for the render run.
export const metadata = { robots: { index: false, follow: false } };

export default function BrassworkSitePage() {
    if (process.env.NODE_ENV === "production" && process.env.VOXEL_BENCH !== "1") notFound();
    return <SiteShot />;
}
