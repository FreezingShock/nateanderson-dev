import Link from "next/link";
import { identity } from "@/lib/content";
import { PATH } from "@/lib/identity";
import { navItems } from "@/lib/nav";
import { NateGlyph } from "@/components/cm/mark";
import { ShortcutsButton } from "@/components/cm/keys";
import { PixelIcon, type PixelName } from "@/components/cm/pixel-icons";

// Site footer, the "ID card" layout: Nate's identity card beside a page and about directory, then the channels.
// Every fact here already appears on the site (identity, timeline, nav). Styles live in app/camino/site-footer.css.

const FOOTER_TAGLINE =
    "Building games, renders, and systems, and aiming for construction management at Cal Poly SLO.";

const SOCIALS: { label: string; href: string; icon: PixelName; preferred?: boolean }[] = [
    { label: "Email", href: "mailto:nateanderson36b2@gmail.com", icon: "mail", preferred: true },
    { label: "GitHub", href: "https://github.com/FreezingShock", icon: "github" },
    { label: "Discord", href: "https://discord.com/users/724456022722215966", icon: "discord" },
    { label: "Instagram", href: "https://instagram.com/nate9anderson", icon: "instagram" },
    { label: "TikTok", href: "https://www.tiktok.com/@nate9anderson", icon: "tiktok" },
    { label: "YouTube", href: "https://www.youtube.com/channel/UC_MMqRncSjzBoT2aDRhXj7Q", icon: "youtube" },
];

const ABOUT_LINKS: { label: string; href: string; icon: PixelName }[] = [
    { label: "Who I am", href: "/about#hero", icon: "eye" },
    { label: "Running", href: "/about#running", icon: "footprints" },
    { label: "Philosophy", href: "/about#philosophy", icon: "brain" },
    { label: "Skills", href: "/about#skills", icon: "zap" },
    { label: "Education path", href: "/about#timeline", icon: "book" },
];

// Icon for each top-level page, keyed by its nav href.
const PAGE_ICON: Record<string, PixelName> = {
    "/": "home",
    "/creations": "creations",
    "/timeline": "timeline",
    "/studies": "studies",
    "/blog": "blog",
    "/history": "history",
    "/about": "about",
};

const PAGE_LINKS = navItems.map((n) => ({ href: n.href, label: n.label, no: n.no, icon: PAGE_ICON[n.href] ?? ("home" as PixelName) }));

export function SiteFooter() {
    const year = new Date().getFullYear();
    return (
        <footer className="sf-foot" id="footer">
            <div className="sf-wrap">
                <div className="sf-grid">
                    <div className="sf-card">
                        <div className="sf-card-top">
                            <span className="sf-live"><i />naOS // identity</span>
                            <span>class of 2027</span>
                        </div>
                        <div className="sf-card-main">
                            <div className="sf-badge">
                                <NateGlyph size={36} />
                                <b>na</b>
                                <span>id 01</span>
                            </div>
                            <dl className="sf-rows">
                                <div><dt>Name</dt><dd>{identity.name} {identity.lastName}</dd></div>
                                <div><dt>Based</dt><dd>Southern California</dd></div>
                                <div><dt>Now</dt><dd>{PATH[0].title}</dd></div>
                                <div><dt>Heading to</dt><dd>{PATH[1].title}</dd></div>
                            </dl>
                        </div>
                        <p className="sf-card-tag">{FOOTER_TAGLINE}</p>
                        <div className="sf-card-foot" aria-hidden="true">
                            <span className="sf-bars"><i /><i /><i /><i /><i /></span>
                            <span>id / verified</span>
                            <span>nateanderson.dev</span>
                        </div>
                    </div>

                    <div className="sf-dir">
                        <nav aria-label="Site pages">
                            <span className="sf-lbl">Directory / pages</span>
                            <ul>
                                {PAGE_LINKS.map((p) => (
                                    <li key={p.href}>
                                        <Link href={p.href}>
                                            <PixelIcon name={p.icon} className="sf-ico" />
                                            <span>{p.label}</span>
                                            <b>{p.no}</b>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                        <nav aria-label="About Nate">
                            <span className="sf-lbl">Directory / about me</span>
                            <ul className="sf-about">
                                {ABOUT_LINKS.map((l) => (
                                    <li key={l.href}>
                                        <Link href={l.href}>
                                            <PixelIcon name={l.icon} className="sf-ico" />
                                            <span>{l.label}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </div>
                </div>

                <section className="sf-find" aria-labelledby="sf-find-title">
                    <div className="sf-find-head" aria-hidden="true">
                        <span className="sf-live"><i />channels</span>
                        <span>{SOCIALS.length} open</span>
                    </div>
                    <div className="sf-find-ticks" aria-hidden="true" />
                    <h2 id="sf-find-title" className="sf-find-title">contact me</h2>
                    <ul className="sf-chan">
                        {SOCIALS.map(({ label, href, icon, preferred }, i) => (
                            <li key={label}>
                                <a href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">
                                    <b>{String(i + 1).padStart(2, "0")}</b>
                                    <PixelIcon name={icon} className="sf-ico-lg" />
                                    <span>{label}</span>
                                    {preferred && <em>Preferred</em>}
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>

                <div className="sf-base">
                    <span>© {year} {identity.name} {identity.lastName}</span>
                    <span>Built in Southern California / Camino design system</span>
                    <ShortcutsButton />
                </div>
            </div>
        </footer>
    );
}
