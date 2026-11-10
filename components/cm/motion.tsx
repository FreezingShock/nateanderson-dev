import { Fragment, type CSSProperties, type ElementType, type ReactNode } from "react";

// Server-safe motion primitives. They only emit markup (data attributes + per-character spans); the engine in
// lib/motion/engine.ts (started once by <MotionRoot/>) does the work. See MOTION.md for the full recipe.

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

/**
 * Mono text that decodes out of random glyphs (left to right) when it scrolls into view. The real text is in a
 * visually hidden copy, so screen readers and no-JS see it untouched. `hover` re-runs it on pointer hover.
 */
export function Scramble({
    text,
    as: Tag = "span",
    className = "",
    delay,
    hover = false,
    replay = false,
}: {
    text: string;
    as?: ElementType;
    className?: string;
    /** ms before it starts, once in view */
    delay?: number;
    hover?: boolean;
    /** re-scramble every time it scrolls back into view */
    replay?: boolean;
}) {
    return (
        <Tag className={className || undefined} {...(hover ? { "data-scr-hover": "" } : {})}>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true" {...(replay ? { "data-rx-scr": "" } : { "data-mx-scr": "" })} data-scr-text="" {...(delay ? { "data-mx-scr-d": String(delay) } : {})}>
                {text}
            </span>
        </Tag>
    );
}

/**
 * Heading text that slides up out of a mask while a solid block sweeps across behind it (the ctOS title-card
 * move). Wrap the text; put `data-mx="slab"` on the heading tag. `tone` picks the block colour.
 */
export function Slab({ children, tone = "paper" }: { children: ReactNode; tone?: "cyan" | "paper" }) {
    return (
        <span className={`sl ${tone}`}>
            <span className="sl-t">{children}</span>
        </span>
    );
}
