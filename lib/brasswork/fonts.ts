// Brasswork menu faces. To swap a face, change the import and the call on the matching line only;
// components/brasswork-ui/type.css reads --font-bw-display and --font-bw-text through the --bw-font-* tokens.
import { Fraunces, IBM_Plex_Sans } from "next/font/google";

const display = Fraunces({ variable: "--font-bw-display", subsets: ["latin"], display: "swap" });
const text = IBM_Plex_Sans({ variable: "--font-bw-text", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export const bwFontClass = `${display.variable} ${text.variable}`;
