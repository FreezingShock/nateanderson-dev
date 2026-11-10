import type { Metadata, Viewport } from "next";
import { Arimo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Bar, Dock } from "@/components/cm/bar";
import { Film } from "@/components/cm/film";
import { Launcher } from "@/components/cm/launcher";
import { SiteMap } from "@/components/cm/site-map";
import { Boot, BOOT_SCRIPT } from "@/components/cm/boot";
import { MotionRoot } from "@/components/cm/motion-root";
import { CtosBody } from "@/components/cm/ctos-body";
import { SiteFooter } from "@/components/site-footer";
import { SoundProvider } from "@/components/sound-provider";

// Camino type: Helvetica Neue first (Arimo is the metric-compatible fallback where Helvetica is absent),
// IBM Plex Mono for every label, number, tag and button.
const arimo = Arimo({ variable: "--font-arimo", subsets: ["latin"], display: "swap" });
const plexMono = IBM_Plex_Mono({
    variable: "--font-plex-mono",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    display: "swap",
});

const DESCRIPTION =
    "Games, renders, and systems, built while studying construction management.";

export const metadata: Metadata = {
    metadataBase: new URL("https://nateanderson.dev"),
    title: { default: "Nate's Portfolio", template: "%s · Nate's Portfolio" },
    description: DESCRIPTION,
    authors: [{ name: "Nate" }],
    creator: "Nate",
    applicationName: "Nate's Portfolio",
    formatDetection: { telephone: false },
    icons: {
        icon: [
            { url: "/icon.svg", type: "image/svg+xml" },
            { url: "/favicon.ico", sizes: "any" },
        ],
        apple: "/apple-touch-icon.png",
    },
    openGraph: {
        type: "website",
        locale: "en_US",
        title: "Nate's Portfolio",
        description: DESCRIPTION,
        siteName: "Nate's Portfolio",
        url: "https://nateanderson.dev",
    },
    twitter: { card: "summary_large_image", title: "Nate's Portfolio", description: DESCRIPTION },
};

export const viewport: Viewport = {
    themeColor: "#1a1a1a",
    viewportFit: "cover",
    colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`cm ${arimo.variable} ${plexMono.variable}`} suppressHydrationWarning>
            <head>
                {/* Picks the load-sequence variant before first paint (see components/cm/boot.tsx). */}
                <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
            </head>
            <body>
                <ThemeProvider
                    attribute="data-theme"
                    themes={["dark"]}
                    defaultTheme="dark"
                    forcedTheme="dark"
                    enableSystem={false}
                    disableTransitionOnChange
                >
                    <a className="cm-btn solid cm-skip" href="#main">Skip to content</a>
                    <Boot />
                    <Film />
                    <MotionRoot />
                    <CtosBody />
                    <Bar />
                    <main id="main" className="cm-main">{children}</main>
                    <SiteFooter />
                    <Dock />
                    <SiteMap />
                    <Launcher />
                    <SoundProvider />
                </ThemeProvider>
            </body>
        </html>
    );
}
