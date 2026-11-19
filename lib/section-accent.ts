// One accent per big division of the site, set on <html data-section> from the path (AccentRoot).
// The time-of-day accent (lib/accent.ts) stays on the home page and on the shared chrome. Section colours are
// fixed, so a visitor always knows where they are. Each colour is kept away from the three time bands
// (amber, cyan, violet) and from the alert red.
//
// Games keep their own palettes: /creations/games/<game> has no section, so its chrome is untouched.

export const SECTION_ACCENT = {
    creations: "#ff2d8a", // hot pink: the naOS guide magenta, used for the Creations hub and its work
    studies: "#3ce07a", // green: the healthy-state green, for coursework
    timeline: "#ff7a1a", // orange: the page-transition orange, for the pathway
    blog: "#d8e86a", // lime: the rare colour-break tone, for writing
    history: "#d44fd0", // orchid: a category flag tone, for the record
    about: "#7fb4ff", // pale blue: the one new tone, for the person page
} as const;

export type Section = keyof typeof SECTION_ACCENT;

/** Section for a path, or null for the home page and for game routes (which keep their own palette). */
export function sectionForPath(path: string): Section | null {
    if (path === "/" || path === "") return null;
    if (path === "/creations/games" || path.startsWith("/creations/games/")) {
        return path === "/creations/games" ? "creations" : null;
    }
    const first = path.split("/").filter(Boolean)[0];
    return first && first in SECTION_ACCENT ? (first as Section) : null;
}
