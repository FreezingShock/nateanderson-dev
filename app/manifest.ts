import type { MetadataRoute } from "next";

// A manifest is what turns "random Next.js app" into "this is a real,
// installable site" in browser dev tools / Lighthouse — cheap legitimacy
// signal, and lets the site be added to a phone home screen.
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Nate's Portfolio",
        short_name: "Nate's Portfolio",
        description:
            "Games, renders, and systems, built while studying construction management.",
        start_url: "/",
        display: "standalone",
        background_color: "#040506",
        theme_color: "#040506",
        icons: [
            {
                src: "/icon.svg",
                sizes: "any",
                type: "image/svg+xml",
            },
            {
                src: "/icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/apple-touch-icon.png",
                sizes: "180x180",
                type: "image/png",
            },
        ],
    };
}
