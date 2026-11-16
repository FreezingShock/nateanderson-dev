"use client";

// Game kit styled pieces for new games: a floating window, a toast stack, tabs, a counter, a press button and a burst.
// Every piece is themed by the CSS variables on the nearest `.gk` element (see app/camino/game-kit.css), so a new game
// sets its palette once and keeps its own look. The three older games keep their own markup and use the hooks only.
import { useRef, type CSSProperties, type ReactNode } from "react";
import { formatNumber, type NumberStyle } from "@/lib/game-kit/format";
import type { Toast } from "@/lib/game-kit/toasts";
import { useCountUp, useGain, usePresence, useReducedMotion, useTween } from "./hooks";
import { useFocusTrap, useTabs, useWindowClose } from "./use-window";
import "@/app/camino/game-kit.css";

/** Corner brackets: the four small marks that frame every kit panel. */
export function Corners() {
    return (
        <>
            <i className="gk-cn" data-c="tl" aria-hidden="true" />
            <i className="gk-cn" data-c="tr" aria-hidden="true" />
            <i className="gk-cn" data-c="bl" aria-hidden="true" />
            <i className="gk-cn" data-c="br" aria-hidden="true" />
        </>
    );
}

export type GameWindowMotion = "rise" | "drop" | "iris" | "unroll" | "stamp";

export type GameWindowProps = {
    /** Mounted and shown while true. Closing plays the exit, then unmounts. */
    open: boolean;
    title: string;
    /** Small text right of the title ("3 of 12 built"). */
    hint?: string;
    /** A 32px icon or art before the title. */
    icon?: ReactNode;
    /** Called on Close, Escape or a click on blank ground around the window. */
    onClose: () => void;
    /** Each menu gets its own open and close motion. */
    motion?: GameWindowMotion;
    /** sm 360, md 520, lg 760 wide; capped to the game area. Under 640px wide every window is a bottom sheet. */
    size?: "sm" | "md" | "lg";
    /** Modal windows trap focus. Floating (non-modal) ones leave the game playable behind them (default). */
    modal?: boolean;
    children: ReactNode;
    footer?: ReactNode;
};

const EXIT_MS = 180;

/**
 * A floating game window: sharp panel, corner brackets, title row with a Close button, and its own open/close motion.
 * No dark scrim: the game keeps running and stays visible. A click on blank ground around it closes it.
 */
export function GameWindow(props: GameWindowProps) {
    const { mounted } = usePresence(props.open, EXIT_MS);
    if (!mounted) return null;
    return <WindowBody {...props} />;
}

function WindowBody({ open, title, hint, icon, onClose, motion = "rise", size = "md", modal = false, children, footer }: GameWindowProps) {
    const box = useRef<HTMLElement>(null);
    const { closing, requestClose } = useWindowClose(onClose, { exitMs: EXIT_MS });
    useFocusTrap(box, modal);
    const out = closing || !open;
    return (
        <div className="gk-win-layer" data-modal={modal ? "" : undefined} onPointerDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
            <section ref={box} tabIndex={-1} className="gk-win" data-size={size} data-motion={motion} data-s={out ? "out" : "in"} role="dialog" aria-modal={modal || undefined} aria-label={title}>
                <header className="gk-win-head">
                    {icon && <span className="gk-win-icon" aria-hidden="true">{icon}</span>}
                    <h2>{title}</h2>
                    {hint && <span className="gk-win-hint">{hint}</span>}
                    <button type="button" className="gk-x" onClick={requestClose} aria-label={`Close ${title}`} data-tip="Close · Esc">×</button>
                </header>
                <div className="gk-win-body">{children}</div>
                {footer && <footer className="gk-win-foot">{footer}</footer>}
                <Corners />
            </section>
        </div>
    );
}

/** Toasts from useToasts, newest last. `tone` "hot" draws the accent edge on top; "dim" is quieter. */
export function ToastStack<Tone extends string>({ toasts, onDismiss, placement = "top-right" }: { toasts: Toast<Tone>[]; onDismiss?: (id: number) => void; placement?: "top-right" | "top" | "bottom" }) {
    return (
        <div className="gk-toasts" data-at={placement} role="status" aria-live="polite">
            {toasts.map((t) => (
                <p key={t.id} className="gk-toast" data-tone={t.tone} data-sticky={t.sticky ? "" : undefined} onClick={onDismiss ? () => onDismiss(t.id) : undefined}>
                    {t.text}
                </p>
            ))}
        </div>
    );
}

export type TabItem<T extends string> = { id: T; label: string; icon?: ReactNode; badge?: ReactNode };

/** A row of square tabs with arrow-key movement. Renders only the selected panel's content (`children`). */
export function Tabs<T extends string>({ items, value, onChange, label, children, prefix = "gk" }: { items: TabItem<T>[]; value: T; onChange: (id: T) => void; label: string; children: ReactNode; prefix?: string }) {
    const { listProps, tabProps, panelProps } = useTabs(items.map((i) => i.id), value, onChange, prefix);
    return (
        <div className="gk-tabs">
            <div className="gk-tab-row" {...listProps} aria-label={label}>
                {items.map((it) => (
                    <button key={it.id} className="gk-tab" {...tabProps(it.id)} data-tip={it.label}>
                        {it.icon && <span className="gk-tab-icon" aria-hidden="true">{it.icon}</span>}
                        <span className="gk-tab-label">{it.label}</span>
                        {it.badge !== undefined && <span className="gk-tab-badge">{it.badge}</span>}
                    </button>
                ))}
            </div>
            <div className="gk-tab-pane" key={value} {...panelProps(value)}>
                {children}
            </div>
        </div>
    );
}

/**
 * A live number that rolls to its new value instead of jumping, and ticks once (a short lift) when it rises.
 * `mode` "tween" follows a live stat; "count" counts up from 0 for a payout.
 */
export function Counter({ value, style = "suffix", digits = 2, mode = "tween", ms, className, prefix = "", suffix = "" }: { value: number; style?: NumberStyle; digits?: number; mode?: "tween" | "count"; ms?: number; className?: string; prefix?: string; suffix?: string }) {
    const still = useReducedMotion();
    const tween = useTween(value, { ms: ms ?? 400, still: still || mode !== "tween" });
    const count = useCountUp(value, { ms: ms ?? 650, still: still || mode !== "count" });
    const gain = useGain(value);
    const shown = mode === "count" ? count : tween;
    return (
        <span className={`gk-num ${className ?? ""}`} data-up={gain && gain.gained > 0 ? gain.key : undefined} key={gain && gain.gained > 0 ? gain.key : undefined}>
            {prefix}
            {formatNumber(shown, style, digits)}
            {suffix}
        </span>
    );
}

/**
 * A square game button with the kit's press: it lifts on hover, sinks on press, and pulses when `pulse` changes (a buy).
 * `ready` marks it affordable. Pass `hotkey` to show the key in the corner.
 */
export function PressButton({ children, onPress, ready = true, disabled, hotkey, tip, pulse, className, style }: { children: ReactNode; onPress: () => void; ready?: boolean; disabled?: boolean; hotkey?: string; tip?: string; pulse?: number; className?: string; style?: CSSProperties }) {
    return (
        <button type="button" className={`gk-btn ${className ?? ""}`} data-ready={ready ? "" : undefined} disabled={disabled} onClick={onPress} data-tip={tip} aria-keyshortcuts={hotkey} style={style}>
            {children}
            {hotkey && <kbd className="gk-key" aria-hidden="true">{hotkey}</kbd>}
            {pulse !== undefined && <Burst trigger={pulse} />}
        </button>
    );
}

/**
 * A square ring and eight pixel sparks in the current colour (set `color` on a parent). Plays once each time `trigger`
 * rises; a fast run restarts it rather than stacking. Hidden under reduced motion. `size` grows it for bigger moments.
 */
export function Burst({ trigger, size = "s" }: { trigger: number; size?: "s" | "m" | "l" }) {
    const gain = useGain(trigger);
    if (!gain || gain.gained <= 0) return null;
    return (
        <i key={gain.key} className="gk-burst" data-size={size} aria-hidden="true">
            {Array.from({ length: 8 }, (_, k) => (
                <b key={k} style={{ "--a": `${k * 45}deg` } as CSSProperties} />
            ))}
        </i>
    );
}
