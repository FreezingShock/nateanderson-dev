import type { CSSProperties } from "react";
import Link from "next/link";
import { identity } from "@/lib/content";
import { NateMark } from "@/components/cm/mark";
import { ShortcutsButton } from "@/components/cm/keys";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { ABOUT_LINKS, FOOTER_TAGLINE, PAGE_LINKS, PILLAR_ITEMS, SOCIALS } from "./footer-data";

// Option A, "Signal deck": the footer as a status deck. A live signal graph (CSS only, transform-only steps) sits
// beside the identity block, page and about columns carry pixel icons, and the four pillars read as a spec row.
export function FooterOptionA() {
    return (
        <footer className="fa-foot" id="footer-a">
            <div className="fa-wrap">
                <div className="fa-head" aria-hidden="true">
                    <span className="fa-live"><i />session open</span>
                    <span>nateanderson.dev / footer</span>
                    <span className="fa-head-r">southern california</span>
                </div>

                <div className="fa-top">
                    <div className="fa-brand">
                        <NateMark sub="nateanderson.dev" />
                        <p className="fa-tag">{FOOTER_TAGLINE}</p>
                        <div className="fa-signal" role="img" aria-label="Decorative signal graph">
                            <div className="fa-graph" aria-hidden="true">
                                {Array.from({ length: 24 }, (_, i) => (
                                    <i key={i} style={{ "--i": i } as CSSProperties} />
                                ))}
                            </div>
                            <div className="fa-signal-meta" aria-hidden="true">
                                <span>signal / live</span>
                                <span>{identity.name} {identity.lastName}</span>
                            </div>
                        </div>
                    </div>

                    <nav className="fa-col" aria-label="Site pages">
                        <span className="fa-lbl">Pages</span>
                        <ul>
                            {PAGE_LINKS.map((p) => (
                                <li key={p.href}>
                                    <Link href={p.href}>
                                        <b>{p.no}</b>
                                        <PixelIcon name={p.icon} className="fa-ico" />
                                        <span>{p.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <nav className="fa-col" aria-label="About Nate">
                        <span className="fa-lbl">About me</span>
                        <ul>
                            {ABOUT_LINKS.map((l) => (
                                <li key={l.href}>
                                    <Link href={l.href}>
                                        <PixelIcon name={l.icon} className="fa-ico" />
                                        <span>{l.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>

                <div className="fa-pillars">
                    {PILLAR_ITEMS.map((p) => (
                        <div key={p.label} className="fa-pillar">
                            <PixelIcon name={p.icon} className="fa-ico-lg" />
                            <div>
                                <span className="fa-lbl">{p.label}</span>
                                <b>{p.headline}</b>
                                <small>{p.detail}</small>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="fa-find">
                    <span className="fa-lbl">Find me</span>
                    <ul>
                        {SOCIALS.map(({ label, href, icon, preferred }, i) => (
                            <li key={label}>
                                <a
                                    href={href}
                                    target={href.startsWith("mailto:") ? undefined : "_blank"}
                                    rel="noreferrer"
                                >
                                    <b>{String(i + 1).padStart(2, "0")}</b>
                                    <PixelIcon name={icon} className="fa-ico" />
                                    <span>{label}</span>
                                    <PixelIcon name="arrowR" className="fa-arr" />
                                </a>
                                {preferred && <em>Preferred</em>}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="fa-base">
                    <span>© {new Date().getFullYear()} {identity.name} {identity.lastName}</span>
                    <span>Built in Southern California / Camino design system</span>
                    <ShortcutsButton />
                </div>
            </div>
        </footer>
    );
}
