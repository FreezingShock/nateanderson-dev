import type { CSSProperties } from "react";
import Link from "next/link";
import { identity } from "@/lib/content";
import { NateMark } from "@/components/cm/mark";
import { ShortcutsButton } from "@/components/cm/keys";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { ABOUT_LINKS, FOOTER_TAGLINE, PAGE_LINKS, PATH, PILLAR_ITEMS, SOCIALS, runningStats } from "./footer-data";
import { LiveReadout } from "./live-readout";

// Option C, "Live readout": the footer as a telemetry strip. A full-width live graph runs across the top, the four
// facts from the About page sit as stat tiles under it, and the pages, the path and the socials use a dense grid.
export function FooterOptionC() {
    return (
        <footer className="fc-foot" id="footer-c">
            <div className="fc-wrap">
                <div className="fc-readout">
                    <div className="fc-readout-head">
                        <NateMark sub="nateanderson.dev" />
                        <span className="fc-live"><i />live / naOS telemetry</span>
                    </div>
                    <LiveReadout bars={36} />
                    <div className="fc-readout-meta" aria-hidden="true">
                        <span>00</span><span>signal</span><span>24h</span><span>now</span>
                    </div>
                </div>

                <div className="fc-stats">
                    {runningStats.map((s) => (
                        <div key={s.label} className="fc-stat" style={{ "--c": "var(--cm-cyan)" } as CSSProperties}>
                            <span className="fc-lbl">{s.label}</span>
                            <b>{s.value}</b>
                        </div>
                    ))}
                </div>

                <p className="fc-tag">{FOOTER_TAGLINE}</p>

                <div className="fc-grid">
                    <nav className="fc-pages" aria-label="Site pages">
                        <span className="fc-lbl">Pages</span>
                        <ul>
                            {PAGE_LINKS.map((p) => (
                                <li key={p.href}>
                                    <Link href={p.href}>
                                        <PixelIcon name={p.icon} className="fc-ico" />
                                        <span>{p.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <nav className="fc-about" aria-label="About Nate">
                        <span className="fc-lbl">About me</span>
                        <ul>
                            {ABOUT_LINKS.map((l) => (
                                <li key={l.href}>
                                    <Link href={l.href}>
                                        <PixelIcon name={l.icon} className="fc-ico" />
                                        <span>{l.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="fc-path">
                        <span className="fc-lbl">Path</span>
                        <ol>
                            {PATH.map((s) => (
                                <li key={s.title} className={s.current ? "cur" : undefined}>
                                    <span>{s.when}</span>
                                    <b>{s.title}</b>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>

                <div className="fc-pillars">
                    {PILLAR_ITEMS.map((p) => (
                        <div key={p.label} className="fc-pillar">
                            <PixelIcon name={p.icon} className="fc-ico-lg" />
                            <span className="fc-lbl">{p.label}</span>
                            <b>{p.headline}</b>
                        </div>
                    ))}
                </div>

                <div className="fc-find">
                    {SOCIALS.map(({ label, href, icon, preferred }) => (
                        <a key={label} href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">
                            <PixelIcon name={icon} className="fc-ico" />
                            <span>{label}</span>
                            {preferred && <em>Preferred</em>}
                        </a>
                    ))}
                </div>

                <div className="fc-base">
                    <span>© {new Date().getFullYear()} {identity.name} {identity.lastName}</span>
                    <span>{identity.name} {identity.lastName} / nateanderson.dev</span>
                    <ShortcutsButton />
                </div>
            </div>
        </footer>
    );
}
