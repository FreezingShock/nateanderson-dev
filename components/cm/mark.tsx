// Nate's own mark: an "N" built from the Camino slab language. Two paper bars joined by a cyan
// diagonal. It is drawn with CSS variables so it follows the dark and paper themes.
export function NateGlyph({ size = 22, className }: { size?: number; className?: string }) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <rect x="2" y="3" width="4.5" height="18" fill="var(--cm-paper)" />
            <rect x="17.5" y="3" width="4.5" height="18" fill="var(--cm-paper)" />
            <polygon points="6.5,3 11.5,3 17.5,21 12.5,21" fill="var(--cm-cyan)" />
        </svg>
    );
}

/** The lockup: glyph + name. `sub` is the small mono line under it. */
export function NateMark({
    sub,
    large,
    bare,
}: {
    sub?: string;
    large?: boolean;
    bare?: boolean;
}) {
    return (
        <span className={`cm-mark${large ? " lg" : ""}`} style={{ alignItems: "center" }}>
            <NateGlyph size={large ? 40 : 22} />
            {!bare && (
                <span className="word">
                    <b>NATE ANDERSON</b>
                    {sub && <small>{sub}</small>}
                </span>
            )}
        </span>
    );
}
