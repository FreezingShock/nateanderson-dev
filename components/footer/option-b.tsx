import Link from "next/link";
import { identity } from "@/lib/content";
import { NateGlyph } from "@/components/cm/mark";
import { ShortcutsButton } from "@/components/cm/keys";
import { PixelIcon } from "@/components/cm/pixel-icons";
import { ABOUT_LINKS, FOOTER_TAGLINE, PAGE_LINKS, PATH, SOCIALS, runningStats } from "./footer-data";

// Option B, "ID card": the footer as Nate's identity card. The badge, the white header bar and the info rows reuse the
// homepage Status card, so the footer reads as the same person. Pages and socials sit as a directory beside it.
export function FooterOptionB() {
    return (
        <footer className="fb-foot" id="footer-b">
            <div className="fb-wrap">
                <div className="fb-grid">
                    <div className="fb-card">
                        <div className="fb-card-top">
                            <span className="fb-live"><i />naOS // identity</span>
                            <span>class of 2027</span>
                        </div>
                        <div className="fb-card-main">
                            <div className="fb-badge">
                                <NateGlyph size={36} />
                                <b>na</b>
                                <span>id 01</span>
                            </div>
                            <dl className="fb-rows">
                                <div><dt>Name</dt><dd>{identity.name} {identity.lastName}</dd></div>
                                <div><dt>Based</dt><dd>Southern California</dd></div>
                                <div><dt>Now</dt><dd>{PATH[0].title}</dd></div>
                                <div><dt>Heading to</dt><dd>{PATH[1].title}</dd></div>
                                <div><dt>Running</dt><dd>Captain, cross country and track</dd></div>
                                <div><dt>Best 3 mile</dt><dd>{runningStats[0].value}</dd></div>
                            </dl>
                        </div>
                        <p className="fb-card-tag">{FOOTER_TAGLINE}</p>
                        <div className="fb-card-foot" aria-hidden="true">
                            <span className="fb-bars"><i /><i /><i /><i /><i /></span>
                            <span>id / verified</span>
                            <span>nateanderson.dev</span>
                        </div>
                    </div>

                    <div className="fb-dir">
                        <nav aria-label="Site pages">
                            <span className="fb-lbl">Directory / pages</span>
                            <ul>
                                {PAGE_LINKS.map((p) => (
                                    <li key={p.href}>
                                        <Link href={p.href}>
                                            <PixelIcon name={p.icon} className="fb-ico" />
                                            <span>{p.label}</span>
                                            <b>{p.no}</b>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                        <nav aria-label="About Nate">
                            <span className="fb-lbl">Directory / about me</span>
                            <ul className="fb-about">
                                {ABOUT_LINKS.map((l) => (
                                    <li key={l.href}>
                                        <Link href={l.href}>
                                            <PixelIcon name={l.icon} className="fb-ico" />
                                            <span>{l.label}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </div>
                </div>

                <div className="fb-find">
                    <span className="fb-lbl">Find me</span>
                    <ul>
                        {SOCIALS.map(({ label, href, icon, preferred }) => (
                            <li key={label}>
                                <a href={href} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">
                                    <PixelIcon name={icon} className="fb-ico" />
                                    <span>{label}</span>
                                    {preferred && <em>Preferred</em>}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="fb-base">
                    <span>© {new Date().getFullYear()} {identity.name} {identity.lastName}</span>
                    <span>Built in Southern California / Camino design system</span>
                    <ShortcutsButton />
                </div>
            </div>
        </footer>
    );
}
