import type { CSSProperties } from "react";

/**
 * naOS dock icons. Each one is drawn by hand on a 12 x 12 grid and rendered as crisp SVG rectangles, so it reads as
 * 1-bit pixel art. "#" is a solid pixel, ":" is a half-tone pixel that is dithered (a checkerboard), "." is empty.
 * The half-tone pixels are split into two checkerboard phases so CSS can shimmer between them (see nav-naos.css).
 * Every drawing is original.
 */
const SIZE = 12;

const MAPS = {
    home: [
        ".....##.....",
        "....#::#....",
        "...#::::#...",
        "..#::::::#..",
        ".#::::::::#.",
        "############",
        ".#::::::::#.",
        ".#::::::::#.",
        ".#:::##:::#.",
        ".#:::##:::#.",
        ".#:::##:::#.",
        ".##########.",
    ],
    creations: [
        ".....##.....",
        "...######...",
        ".##:####:##.",
        "############",
        "#::::##::::#",
        "#::::##::::#",
        "#::::##::::#",
        "#::::##::::#",
        ".#:::##:::#.",
        "..#::##::#..",
        "....####....",
        ".....##.....",
    ],
    timeline: [
        "####........",
        "#::#........",
        "#::#........",
        "####........",
        ".##.........",
        ".##.........",
        ".##########.",
        ".........##.",
        "........####",
        "........#::#",
        "........#::#",
        "........####",
    ],
    studies: [
        "............",
        ".....##.....",
        "...######...",
        ".##########.",
        "###::::::###",
        ".###########",
        "...######..#",
        "...#::::#..#",
        "...#::::#..#",
        "....####..##",
        "............",
        "............",
    ],
    blog: [
        "........##..",
        ".......####.",
        "......###:##",
        ".....###:##.",
        "....###:##..",
        "...###:##...",
        "..###:##....",
        ".####:#.....",
        ".###:##.....",
        "##::#.......",
        "##..........",
        "############",
    ],
    history: [
        "...######...",
        "..#......#..",
        ".#........#.",
        "#....##....#",
        "#....##....#",
        "#....##....#",
        "#....####..#",
        "#........::#",
        "#.......:::#",
        ".#.....:::#.",
        "..#::::::#..",
        "...######...",
    ],
    about: [
        "....####....",
        "...#::::#...",
        "...#::::#...",
        "....####....",
        "............",
        "..########..",
        ".##::::::##.",
        "##::::::::##",
        "#::::::::::#",
        "#::::::::::#",
        "#::::::::::#",
        "############",
    ],
} as const;

export type PixelName = keyof typeof MAPS;

/** Merge horizontal runs of pixels into single rects so each icon stays a handful of path segments. */
function build(name: PixelName) {
    const rows = MAPS[name];
    const paths = { s: "", a: "", b: "" };
    const run = (key: "s" | "a" | "b", y: number, x0: number, x1: number) => {
        paths[key] += `M${x0} ${y}h${x1 - x0}v1h-${x1 - x0}z`;
    };
    rows.forEach((row, y) => {
        // Solid pixels merge into runs. Half-tone pixels never touch horizontally in a checkerboard, so each is one cell.
        let start = -1;
        for (let x = 0; x <= SIZE; x++) {
            const solid = x < SIZE && row[x] === "#";
            if (solid && start < 0) start = x;
            if (!solid && start >= 0) {
                run("s", y, start, x);
                start = -1;
            }
        }
        for (let x = 0; x < SIZE; x++) {
            if (row[x] !== ":") continue;
            run((x + y) % 2 === 0 ? "a" : "b", y, x, x + 1);
        }
    });
    return paths;
}

const BUILT = Object.fromEntries((Object.keys(MAPS) as PixelName[]).map((n) => [n, build(n)])) as Record<PixelName, ReturnType<typeof build>>;

export function PixelIcon({ name, className, style }: { name: PixelName; className?: string; style?: CSSProperties }) {
    const p = BUILT[name];
    return (
        <svg
            className={className ? `px ${className}` : "px"}
            data-ic={name}
            style={style}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            fill="currentColor"
            shapeRendering="crispEdges"
            aria-hidden="true"
            focusable="false"
        >
            <path className="px-s" d={p.s} />
            <path className="px-a" d={p.a} />
            <path className="px-b" d={p.b} />
        </svg>
    );
}

export const PIXEL_FOR: Record<string, PixelName> = {
    "/": "home",
    "/creations": "creations",
    "/timeline": "timeline",
    "/studies": "studies",
    "/blog": "blog",
    "/history": "history",
    "/about": "about",
};
