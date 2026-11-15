// Brasswork menu faces, self-hosted so the build needs no network (both SIL OFL, files in ./fonts).
// To swap a face, replace the file and the call on the matching line only;
// components/brasswork-ui/type.css reads --font-bw-display and --font-bw-text through the --bw-font-* tokens.
import localFont from "next/font/local";

const display = localFont({
    src: "./fonts/fraunces-latin-wght-normal.woff2",
    weight: "100 900",
    variable: "--font-bw-display",
    display: "swap",
});
const text = localFont({
    src: [
        { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
        { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
        { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
        { path: "./fonts/ibm-plex-sans-latin-700-normal.woff2", weight: "700" },
    ],
    variable: "--font-bw-text",
    display: "swap",
});

export const bwFontClass = `${display.variable} ${text.variable}`;
