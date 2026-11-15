import Link from "next/link";
import { GAME_MODES, allGames } from "@/lib/creations-data";
import { PixelIcon } from "@/components/cm/pixel-icons";

// Homepage "Play" showcase: one card per featured game, linking straight into it. Copy is the game's own
// blurb and feature list from lib/creations-data, so nothing here is written for the homepage.
// Images are static webp captures in public/home/games (1200 and 780 wide, 16:10). Lazy, so they do not
// slow the first paint. There are no looping captures: a still is the reduced-motion fallback and the default.
const SHOWCASE: { slug: string; alt: string }[] = [
    { slug: "brasswork", alt: "Brasswork: a voxel island seen from above, with a drill placed on a copper node" },
    { slug: "starwright", alt: "Starwright: a star in the fusion stage, with the fusion ladder panel open" },
    { slug: "groundbreak", alt: "Groundbreak: a Bay Area waterfront at sunset, with a crane and a sidewalk run in progress" },
];

export function GamesShowcase() {
    const games = allGames();
    return (
        <ul className="gs-grid" role="list">
            {SHOWCASE.map(({ slug, alt }) => {
                const game = games.find((g) => g.slug === slug);
                if (!game?.href) return null;
                const genre = GAME_MODES.find((m) => m.games.some((g) => g.slug === slug))?.title ?? "Game";
                return (
                    <li key={slug} className="gs-item" data-rx="">
                        <Link prefetch={false} className="gs-card" href={game.href} data-scr-hover>
                            <span className="gs-media">
                                <picture>
                                    <source type="image/webp" srcSet={`/home/games/${slug}-780.webp 780w, /home/games/${slug}-1200.webp 1200w`} sizes="(max-width: 767px) calc(100vw - 32px), 33vw" />
                                    <img src={`/home/games/${slug}-1200.webp`} alt={alt} width={1200} height={750} loading="lazy" decoding="async" />
                                </picture>
                                <span className="gs-tag">{genre}</span>
                            </span>
                            <span className="gs-meta">
                                <b data-scr-text>{game.title}</b>
                                <p>{game.blurb}</p>
                                <span className="gs-feats">
                                    {game.features.slice(0, 3).map((f) => (
                                        <span key={f}>{f}</span>
                                    ))}
                                </span>
                                <span className="gs-play">
                                    <span>Play</span>
                                    <span className="gs-arr" aria-hidden="true"><PixelIcon name="arrowR" /></span>
                                </span>
                            </span>
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}
