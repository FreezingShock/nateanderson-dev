import { Fragment, type CSSProperties, type ElementType, type ReactNode } from "react";

// Server-safe motion primitives. They only emit markup (data attributes + per-character spans); the engine in
// lib/motion/engine.ts (started once by <MotionRoot/>) does the work. See MOTION.md for the full recipe.

export type RevealVariant = "rise" | "slide" | "slide-r" | "scale" | "wipe" | "line" | "fade";

/** Props for a plain element that should reveal once on scroll. Spread onto any tag. */
export function mx(variant: RevealVariant = "rise", delay?: number) {
    return {
        "data-mx": variant === "rise" ? "" : variant,
        ...(delay != null ? { style: { ["--d" as string]: `${delay}ms` } as CSSProperties } : {}),
    };
}

/**
 * Text that types itself in by scroll distance: the further the line travels up the screen, the more of it is
 * written. Text that is already on screen at load types in over time instead. Fully readable without JS and to
 * screen readers (the real text is in a visually hidden copy).
 */
export function ScrollType({
    text,
    as: Tag = "p",
    className = "",
    auto = false,
    style,
}: {
    text: string;
    as?: ElementType;
    className?: string;
    /** Force the timed variant (use for first-screen leads). Off-screen text always follows the scroll. */
    auto?: boolean;
    style?: CSSProperties;
}) {
    const words = text.split(" ");
    let idx = 0;
    return (
        <Tag className={`cm-type ${className}`.trim()} data-mx-type={auto ? "auto" : "scroll"} style={style}>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true">
                {words.map((w, wi) => (
                    <Fragment key={wi}>
                        {wi > 0 && " "}
                        <span className="w">
                            {Array.from(w).map((ch, ci) => (
                                <span key={ci} className="c" style={{ ["--i" as string]: idx++ } as CSSProperties}>
                                    {ch}
                                </span>
                            ))}
                        </span>
                    </Fragment>
                ))}
            </span>
        </Tag>
    );
}

/** A decorative element that drifts with scroll (transform only). `k` is the fraction of scroll it follows. */
export function parallax(k = 0.1) {
    return { "data-mx-par": String(k) };
}

export type { ReactNode };
