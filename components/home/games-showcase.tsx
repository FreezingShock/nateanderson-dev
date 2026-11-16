import Link from "next/link";
import { GAME_MODES, allGames } from "@/lib/creations-data";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { GamesBand } from "@/components/home/games-band";

// Homepage "Play" showcase: one card per featured game, linking straight into it. Each card carries its own
// game's look (data-game picks the palette in home.css). Copy is the game's own blurb from lib/creations-data;
// the three labels are short forms of that game's feature list, not new copy.
// Behind the cards, GamesBand paints an animated sprite scene per game across the whole section (games-band.tsx).
// Images are UI-free captures of a built-up save (public/home/games, 1200 and 780 wide, 16:10). Lazy-loaded.
const SHOWCASE: { slug: string; alt: string; labels: string[] }[] = [
    {
        slug: "brasswork",
        alt: "Brasswork: a brass machine floor on a voxel island, with drills, kilns and a windmill",
        labels: ["3D island", "Machines on a grid", "Expeditions"],
    },
    {
        slug: "starwright",
        alt: "Starwright: a hydrogen star in the fusion stage against a dithered starfield",
        labels: ["10 elements", "Supernova", "Constellations"],
    },
    {
        slug: "groundbreak",
        alt: "Groundbreak: a half-built site on the Bay Area waterfront at sunset, with a crane and crew",
        labels: ["12 materials", "Cutaway site", "Skyline"],
    },
];

export function GamesShowcase() {
    const games = allGames();
    return (
        <>
            <GamesBand />
            <ul className="gs-grid" role="list">
                {SHOWCASE.map(({ slug, alt, labels }) => {
                    const game = games.find((g) => g.slug === slug);
                    if (!game?.href) return null;
                    const genre = GAME_MODES.find((m) => m.games.some((g) => g.slug === slug))?.title ?? "Game";
                    return (
                        <li key={slug} className="gs-item" data-rx="">
                            <Link prefetch={false} className="gs-card" href={game.href} data-game={slug} data-scr-hover>
                                <span className="gs-plate">
                                    <span className="gs-shot">
                                        <picture>
                                            <source type="image/webp" srcSet={`/home/games/${slug}-780.webp 780w, /home/games/${slug}-1200.webp 1200w`} sizes="(max-width: 767px) calc(100vw - 80px), 30vw" />
                                            <img src={`/home/games/${slug}-1200.webp`} alt={alt} width={1200} height={750} loading="lazy" decoding="async" />
                                        </picture>
                                    </span>
                                    <span className="gs-genre">{genre}</span>
                                </span>
                                <span className="gs-meta">
                                    <b data-scr-text>{game.title}</b>
                                    <p>{game.blurb}</p>
                                    <span className="gs-labels">
                                        {labels.map((l) => (
                                            <span key={l} className="gs-label">{l}</span>
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
        </>
    );
}
