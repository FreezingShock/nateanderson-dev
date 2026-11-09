import { cn } from "@/lib/utils";

// Animated show/hide panel. The height transition is a CSS grid-rows change (0fr <-> 1fr), so it animates
// to the content's real height with no JS measuring. `inert` takes collapsed content out of the tab order.
// Camino motion: a quick 150ms ease, no overshoot.
export function Collapse({
    open,
    children,
    className,
    id,
}: {
    open: boolean;
    children: React.ReactNode;
    className?: string;
    /** Kept for call-site compatibility; Camino has no glows to spill. */
    bleed?: boolean;
    id?: string;
}) {
    return (
        <div
            id={id}
            className={cn(
                "grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                className
            )}
            inert={!open}
        >
            <div className="min-h-0 overflow-hidden">{children}</div>
        </div>
    );
}
