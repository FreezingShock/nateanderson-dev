import type { ReactNode } from "react";

/**
 * naOS status card for system screens (404, error, loading). Reuses the homepage ID-card classes from
 * app/camino/ctos.css (`hero-status id`, `id-top`, `id-main`, `id-foot`), so it only renders inside `.ctos`.
 */
export function SystemCard({
    channel,
    live,
    code,
    rows,
    foot,
    actions,
    children,
}: {
    channel: string;
    live: string;
    code: string;
    rows: { k: string; v: ReactNode }[];
    foot: string;
    actions?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <section className="hero-status id sys-card">
            <div className="id-top">
                <span>naOS // {channel}</span>
                <span className="id-live">
                    <i aria-hidden="true" />
                    {live}
                </span>
            </div>
            <div className="id-main">
                <div className="id-badge" aria-hidden="true">
                    <b>{code}</b>
                    <span>naOS</span>
                </div>
                <dl className="id-rows">
                    {rows.map((r) => (
                        <div key={r.k}>
                            <dt>{r.k}</dt>
                            <dd>{r.v}</dd>
                        </div>
                    ))}
                </dl>
            </div>
            {children}
            {actions && <div className="sys-actions">{actions}</div>}
            <div className="id-foot">
                <span className="id-bars" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                </span>
                <span>{foot}</span>
            </div>
        </section>
    );
}

export const SYSTEM_JUMP = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/creations", label: "Creations" },
    { href: "/timeline", label: "Timeline" },
    { href: "/studies", label: "Studies" },
    { href: "/blog", label: "Blog" },
] as const;
