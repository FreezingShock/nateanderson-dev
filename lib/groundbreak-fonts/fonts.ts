// Groundbreak faces, self-hosted so the build needs no network (both SIL OFL, files in this folder).
// Display is Barlow Condensed 700 only (every display style in the game is 700; the 600 face was preloaded and never drawn), text and numbers are IBM Plex Mono (site office printouts).
import localFont from "next/font/local";

const display = localFont({
    src: [
        { path: "./barlow-condensed-latin-700-normal.woff2", weight: "700" },
    ],
    variable: "--font-gb-display",
    display: "swap",
});
const text = localFont({
    src: [
        { path: "./ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
        { path: "./ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
        { path: "./ibm-plex-mono-latin-600-normal.woff2", weight: "600" },
    ],
    variable: "--font-gb-text",
    display: "swap",
});

export const gbFontClass = `${display.variable} ${text.variable}`;
