import Link from "next/link";
import { Github, Mail, Youtube } from "lucide-react";
import { DiscordLogoIcon, InstagramLogoIcon } from "@radix-ui/react-icons";
import { identity } from "@/lib/content";
import { navItems } from "@/lib/nav";
import { NateMark } from "@/components/cm/mark";

function TikTokIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
    );
}

const SOCIALS = [
    { label: "GitHub", href: "https://github.com/FreezingShock", Icon: Github },
    { label: "Discord", href: "https://discord.com/users/724456022722215966", Icon: DiscordLogoIcon },
    { label: "Instagram", href: "https://instagram.com/nate9anderson", Icon: InstagramLogoIcon },
    { label: "TikTok", href: "https://www.tiktok.com/@nate9anderson", Icon: TikTokIcon },
    { label: "YouTube", href: "https://www.youtube.com/channel/UC_MMqRncSjzBoT2aDRhXj7Q", Icon: Youtube },
    { label: "Email", href: "mailto:nateanderson36b2@gmail.com", Icon: Mail, preferred: true },
];

const ABOUT_LINKS = [
    { label: "Who I am", href: "/about#hero" },
    { label: "Running", href: "/about#running" },
    { label: "Fractured Islands", href: "/about#roblox" },
    { label: "Philosophy", href: "/about#philosophy" },
    { label: "Skills", href: "/about#skills" },
    { label: "Education path", href: "/about#timeline" },
];

export function SiteFooter() {
    return (
        <footer className="cm-foot" id="footer">
            <div className="cm-wrap" style={{ display: "grid", gap: "var(--cm-s6)" }}>
                <div className="cm-cols4" style={{ alignItems: "start" }}>
                    <div className="cm-stack">
                        <NateMark sub="nateanderson.dev" />
                        <p className="cm-note" style={{ maxWidth: "34ch" }}>{identity.tagline}</p>
                        <span className="cm-read live">Southern California · Class of 2027</span>
                    </div>
                    <nav aria-label="Site pages" style={{ display: "grid", gap: 10, alignContent: "start" }}>
                        <span className="cm-lbl">Pages</span>
                        {navItems.map((n) => (
                            <Link key={n.href} href={n.href}>{n.label}</Link>
                        ))}
                    </nav>
                    <nav aria-label="About Nate" style={{ display: "grid", gap: 10, alignContent: "start" }}>
                        <span className="cm-lbl">About me</span>
                        {ABOUT_LINKS.map((l) => (
                            <Link key={l.href} href={l.href}>{l.label}</Link>
                        ))}
                    </nav>
                    <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                        <span className="cm-lbl">Find me</span>
                        <ul className="cm-row-gap" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                            {SOCIALS.map(({ label, href, Icon, preferred }) => (
                                <li key={label}>
                                    <a
                                        className="cm-btn"
                                        href={href}
                                        target={href.startsWith("mailto:") ? undefined : "_blank"}
                                        rel="noreferrer"
                                    >
                                        <Icon className="cm-ico" />
                                        {label}
                                        {preferred && <span className="cm-state live">Preferred</span>}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="cm-rule" style={{ margin: 0 }} />
                <div className="cm-row" style={{ justifyContent: "space-between" }}>
                    <span className="cm-coord">© {new Date().getFullYear()} {identity.name} {identity.lastName}</span>
                    <span className="cm-coord">Built in Southern California / Camino design system</span>
                </div>
            </div>
        </footer>
    );
}
