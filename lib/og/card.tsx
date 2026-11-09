import { readFile } from "node:fs/promises";
import type { ReactElement } from "react";

// naOS share card for Open Graph and Twitter previews. Same language as the site: near-black ground,
// white title block with lowercase heavy grotesk, one cyan accent, a magenta guide line and a 1-bit
// dither fade. Built only from divs and inline SVG so next/og (satori) can render it.

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

const INK = "#1a1a1a";
const BLOCK = "#f4f4f2";
const CYAN = "#2fd8e8";
const MAGENTA = "#ff2d8a";
const MUTED = "#a6adad";

// Bayer 4x4 ordered-dither matrix: gives the hard 1-bit pattern (no soft gray blocks).
const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
];

const DITHER_X = 900;
const DITHER_CELL = 9;

/** One SVG path made of square dots whose density rises toward the right edge. */
function ditherPath(): string {
    const parts: string[] = [];
    const cols = Math.ceil((OG_SIZE.width - DITHER_X) / DITHER_CELL);
    const rows = Math.ceil(470 / DITHER_CELL); // stop above the footer strip
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = DITHER_X + c * DITHER_CELL;
            const y = r * DITHER_CELL;
            const t = (c + 0.5) / cols; // 0 at the left edge of the band, 1 at the right
            const bump = 0.5 + 0.5 * Math.sin((r / rows) * Math.PI); // fuller in the middle of the height
            const density = 0.62 * Math.pow(t, 1.5) * (0.6 + 0.4 * bump);
            const threshold = (BAYER[r % 4][c % 4] + 0.5) / 16;
            if (density > threshold) {
                parts.push(
                    `M${x} ${y}h${DITHER_CELL}v${DITHER_CELL}h-${DITHER_CELL}z`
                );
            }
        }
    }
    return parts.join("");
}

const DITHER = ditherPath();

export interface NaosCardProps {
    /** Mono bar at the top-left, after "naOS //". */
    label: string;
    /** Big lowercase title in the white block. */
    title: string;
    /** Optional second block in cyan, under the title. */
    subtitle?: string;
    /** Grey body line. */
    lead?: string;
    /** Path shown in the footer strip, e.g. "/about". */
    path: string;
}

function titleSize(text: string, base: number): number {
    if (text.length <= 12) return base;
    if (text.length <= 22) return Math.round(base * 0.7);
    return Math.round(base * 0.52);
}

export function naosCard({
    label,
    title,
    subtitle,
    lead,
    path,
}: NaosCardProps): ReactElement {
    const big = titleSize(title, 128);
    const sub = subtitle ? (subtitle.length <= 26 ? 60 : 44) : 0;
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                position: "relative",
                overflow: "hidden",
                background: INK,
                color: BLOCK,
                fontFamily: "Arimo",
            }}
        >
            {/* Guide line and dither band, behind everything else. */}
            <svg
                width={OG_SIZE.width}
                height={OG_SIZE.height}
                viewBox={`0 0 ${OG_SIZE.width} ${OG_SIZE.height}`}
                style={{ position: "absolute", left: 0, top: 0 }}
            >
                <path d={DITHER} fill={BLOCK} fillOpacity={0.55} />
                <path
                    d="M742 630 L1088 0"
                    stroke={MAGENTA}
                    strokeWidth={2}
                    fill="none"
                    strokeOpacity={0.85}
                />
                <path
                    d="M0 120 L1200 120"
                    stroke={MAGENTA}
                    strokeWidth={1}
                    fill="none"
                    strokeOpacity={0.35}
                />
            </svg>

            {/* Corner bracket, the naOS panel mark. */}
            <div
                style={{
                    position: "absolute",
                    right: 48,
                    top: 48,
                    width: 52,
                    height: 52,
                    borderTop: `3px solid ${BLOCK}`,
                    borderRight: `3px solid ${BLOCK}`,
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: 72,
                    top: 72,
                    display: "flex",
                    background: BLOCK,
                    color: INK,
                    padding: "7px 14px",
                    fontFamily: "Plex Mono",
                    fontWeight: 500,
                    fontSize: 22,
                    letterSpacing: 2,
                }}
            >
                {`naOS // ${label}`}
            </div>

            <div
                style={{
                    position: "absolute",
                    left: 72,
                    top: 176,
                    right: 96,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        background: BLOCK,
                        color: INK,
                        fontWeight: 700,
                        fontSize: big,
                        letterSpacing: -big * 0.035,
                        lineHeight: 0.86,
                        padding: `${Math.round(big * 0.08)}px ${Math.round(big * 0.2)}px ${Math.round(big * 0.22)}px`,
                        maxWidth: 1000,
                    }}
                >
                    {title.toLowerCase()}
                </div>
                {subtitle && (
                    <div
                        style={{
                            display: "flex",
                            background: CYAN,
                            color: INK,
                            fontWeight: 700,
                            fontSize: sub,
                            letterSpacing: -sub * 0.03,
                            lineHeight: 0.86,
                            padding: `${Math.round(sub * 0.1)}px ${Math.round(sub * 0.3)}px ${Math.round(sub * 0.24)}px`,
                            marginTop: 10,
                        }}
                    >
                        {subtitle}
                    </div>
                )}
                {lead && (
                    <div
                        style={{
                            display: "flex",
                            marginTop: 34,
                            maxWidth: 720,
                            fontSize: 30,
                            lineHeight: 1.3,
                            color: MUTED,
                        }}
                    >
                        {lead}
                    </div>
                )}
            </div>

            <div
                style={{
                    position: "absolute",
                    left: 72,
                    right: 72,
                    bottom: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: "1px solid rgba(244,244,242,0.28)",
                    paddingTop: 18,
                    fontFamily: "Plex Mono",
                    fontWeight: 500,
                    fontSize: 20,
                    letterSpacing: 2,
                    color: MUTED,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                        style={{
                            display: "flex",
                            width: 12,
                            height: 12,
                            background: CYAN,
                        }}
                    />
                    <div style={{ display: "flex" }}>NATEANDERSON.DEV</div>
                </div>
                <div style={{ display: "flex" }}>{path.toUpperCase()}</div>
            </div>
        </div>
    );
}

/** Fonts for next/og. Read from lib/og/fonts (Arimo and IBM Plex Mono, both SIL/Apache licensed). */
export async function naosFonts() {
    const [arimo, mono] = await Promise.all([
        readFile(new URL("./fonts/arimo-700.woff", import.meta.url)),
        readFile(new URL("./fonts/plex-mono-500.woff", import.meta.url)),
    ]);
    return [
        {
            name: "Arimo",
            data: arimo,
            weight: 700 as const,
            style: "normal" as const,
        },
        {
            name: "Plex Mono",
            data: mono,
            weight: 500 as const,
            style: "normal" as const,
        },
    ];
}
