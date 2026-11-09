import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollType, Scramble, Slab } from "@/components/cm/motion";

/** Inner-page header: mono label, highlight-bar title (first bar black, rest cyan), lead, optional actions. */
export function PageHead({
    label,
    title,
    lead,
    back,
    children,
}: {
    label: string;
    /** One to three short lines; each becomes a stacked highlight bar. */
    title: string[];
    lead?: ReactNode;
    back?: { href: string; label: string };
    children?: ReactNode;
}) {
    return (
        <header className="cm-head">
            <div className="cm-grid-bg" aria-hidden="true" />
            <div className="cm-wrap cm-stage">
                {back && (
                    <Link href={back.href} className="cm-lbl cm-crumb">
                        <span aria-hidden="true">←</span> {back.label}
                    </Link>
                )}
                <span className="cm-lbl">{label}</span>
                <h1 style={{ margin: 0 }}>
                    <span className={`cm-highlight wipe${title.length === 1 ? " solo" : ""}`} style={{ display: "inline-flex", flexDirection: "column" }}>
                        {title.map((t) => (
                            <span key={t}>{t}</span>
                        ))}
                    </span>
                </h1>
                {lead &&
                    (typeof lead === "string" ? (
                        <ScrollType text={lead} auto className="cm-lead" style={{ margin: 0 }} />
                    ) : (
                        <p className="cm-lead" style={{ margin: 0 }}>{lead}</p>
                    ))}
                {children}
            </div>
        </header>
    );
}

/** Numbered section: hairline top rule, `NN / Name` label, h2, optional blurb and a link on the right. */
export function Section({
    id,
    no,
    label,
    title,
    blurb,
    more,
    children,
    className = "",
    ctos = false,
}: {
    id?: string;
    no?: string;
    label: string;
    title: string;
    blurb?: ReactNode;
    more?: { href: string; label: string };
    children: ReactNode;
    className?: string;
    /** ctOS treatment: scrambled label and slab-reveal heading. Opt-in per page. */
    ctos?: boolean;
}) {
    return (
        <section className={`cm-section ruled ${className}`.trim()} id={id}>
            <span className="cm-sec-rule" data-mx="line" aria-hidden="true" />
            <div className="cm-wrap" data-mx-stagger="">
                <div className="cm-sec-head">
                    <div>
                        {ctos ? (
                            <Scramble className="cm-lbl" text={no ? `${no} / ${label}` : label} />
                        ) : (
                            <span className="cm-lbl">{no ? `${no} / ${label}` : label}</span>
                        )}
                        {ctos ? (
                            <h2 className="cm-h2" data-mx="slab">
                                <Slab>{title}</Slab>
                            </h2>
                        ) : (
                            <h2 className="cm-h2">{title}</h2>
                        )}
                        {blurb &&
                            (typeof blurb === "string" ? (
                                <ScrollType text={blurb} className="cm-body" style={{ margin: 0 }} />
                            ) : (
                                <p className="cm-body" style={{ margin: 0 }}>{blurb}</p>
                            ))}
                    </div>
                    {more && (
                        <Link className="cm-more" href={more.href}>
                            {more.label} →
                        </Link>
                    )}
                </div>
                {children}
            </div>
        </section>
    );
}

export function Meter({
    value,
    tone,
    label,
}: {
    /** 0-100 */
    value: number;
    tone?: "warn" | "alert" | "good";
    label?: string;
}) {
    const v = Math.max(0, Math.min(100, value));
    return (
        <div
            className={`cm-meter ${tone ?? ""}`.trim()}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v)}
            aria-label={label}
        >
            <i style={{ ["--v" as string]: `${v}%` }} />
        </div>
    );
}

/** A mono key/value pair for compact data. */
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
    return (
        <div>
            <div className="cm-lbl">{label}</div>
            <div className="cm-num big">{value}</div>
            {note && <div className="cm-coord">{note}</div>}
        </div>
    );
}
