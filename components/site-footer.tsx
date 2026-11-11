import Link from "next/link";
import { identity } from "@/lib/content";
import { navItems } from "@/lib/nav";
import { NateMark } from "@/components/cm/mark";
import { ShortcutsButton } from "@/components/cm/keys";
import { PixelIcon, type PixelName } from "@/components/cm/pixel-icons";

// Footer-only copy, kept separate from identity.tagline (used by metadata, the OG image and the manifest).
const FOOTER_TAGLINE =
    "Building games, renders, and systems, and aiming for construction management at Cal Poly SLO.";

const SOCIALS: { label: string; href: string; icon: PixelName; preferred?: boolean }[] = [
    { label: "GitHub", href: "https://github.com/FreezingShock", icon: "github" },
    { label: "Discord", href: "https://discord.com/users/724456022722215966", icon: "discord" },
    { label: "Instagram", href: "https://instagram.com/nate9anderson", icon: "instagram" },
    { label: "TikTok", href: "https://www.tiktok.com/@nate9anderson", icon: "tiktok" },
    { label: "YouTube", href: "https://www.youtube.com/channel/UC_MMqRncSjzBoT2aDRhXj7Q", icon: "youtube" },
    { label: "Email", href: "mailto:nateanderson36b2@gmail.com", icon: "mail", preferred: true },
];

const ABOUT_LINKS = [
    { label: "Who I am", href: "/about#hero" },
    { label: "Running", href: "/about#running" },
    { label: "Philosophy", href: "/about#philosophy" },
    { label: "Skills", href: "/about#skills" },
    { label: "Education path", href: "/about#timeline" },
];

export function SiteFooter() {
    return (
        <footer className="cm-foot" id="footer">
            <div className="cm-wrap cm-foot-wrap">
                <div className="cm-foot-top">
                    <div className="cm-foot-brand">
                        <NateMark sub="nateanderson.dev" />
                        <p className="cm-foot-tagline">{FOOTER_TAGLINE}</p>
                        <div className="cm-foot-status">
                            <span className="cm-coord">Southern California</span>
                        </div>
                    </div>
                    <nav className="cm-foot-col" aria-label="Site pages">
                        <span className="cm-lbl">Pages</span>
                        {navItems.map((n) => (
                            <Link key={n.href} href={n.href}>{n.label}</Link>
                        ))}
                    </nav>
                    <nav className="cm-foot-col" aria-label="About Nate">
                        <span className="cm-lbl">About me</span>
                        {ABOUT_LINKS.map((l) => (
                            <Link key={l.href} href={l.href}>{l.label}</Link>
                        ))}
                    </nav>
                </div>

                <div className="cm-foot-find">
                    <span className="cm-lbl">Find me</span>
                    <ul className="cm-foot-social">
                        {SOCIALS.map(({ label, href, icon, preferred }, i) => (
                            <li key={label}>
                                <a
                                    className="cm-btn"
                                    href={href}
                                    target={href.startsWith("mailto:") ? undefined : "_blank"}
                                    rel="noreferrer"
                                >
                                    <b className="na-ix">{String(i + 1).padStart(2, "0")}</b>
                                    <PixelIcon name={icon} className="cm-ico" />
                                    <span data-scr-hover><span data-scr-text>{label}</span></span>
                                    <em className="na-arr"><PixelIcon name="arrowR" /></em>
                                </a>
                                {preferred && <span className="cm-foot-pref">Preferred</span>}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="na-sig" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
                <div className="cm-rule" style={{ margin: 0 }} />
                <div className="cm-foot-base">
                    <span className="cm-coord">© {new Date().getFullYear()} {identity.name} {identity.lastName}</span>
                    <span className="cm-coord">Built in Southern California / Camino design system</span>
                    <ShortcutsButton />
                </div>
            </div>
        </footer>
    );
}
