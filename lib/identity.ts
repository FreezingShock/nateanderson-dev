// Who Nate is, grouped so the home page's Profile section reads in seconds.
// Facts only: pulled from the About and Timeline pages and Nate's own notes.

export const PROFILE_LEAD =
    "Student, runner and maker of games, websites and apps. I design game systems, reimagine real places in 3D, and I'm heading into construction management.";

export interface Pillar {
    label: string;
    headline: string;
    detail: string;
}

export const PILLARS: Pillar[] = [
    { label: "Build", headline: "Games and websites", detail: "Systems design, Three.js and real open data" },
    { label: "Make", headline: "3D and design", detail: "Architecture and renovation studies, modeled and redesigned" },
    { label: "Run", headline: "Cross country", detail: "Chasing faster miles, captain of cross country and track" },
    { label: "Think", headline: "Philosophy", detail: "Kierkegaard, agnosticism and egg theory" },
];

export interface Step {
    when: string;
    title: string;
    detail: string;
    current?: boolean;
}

export const PATH: Step[] = [
    {
        when: "Now",
        title: "Senior year, Class of 2027",
        detail: "Building sfvOS and Deepstack, and applying to college.",
        current: true,
    },
    {
        when: "Next",
        title: "Cal Poly SLO, Construction Management",
        detail: "Starting as a freshman. Goals: Cal Poly SLO or Pomona. Fallback: community college.",
    },
];

// Lines for the home page's "Now" feed, newest first.
export const NOW_FEED: { tag: string; text: string }[] = [
    { tag: "Shipping", text: "Nexus, a cozy offline city builder, is live at playnexus.dev." },
    { tag: "Modeling", text: "Real places in 3D: renovation studies measured, modeled and redesigned." },
    { tag: "Running", text: "Cross country and track, captain this year." },
    { tag: "Applying", text: "Cal Poly SLO or Pomona as goals, community college as the fallback." },
];
