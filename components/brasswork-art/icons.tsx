// Brasswork icons with their hover life: items tilt and catch a glint, machines hop on their base, HUD glyphs nudge.
// Art: public/brasswork/icons (scripts/brasswork/build-icons.py and build-ui-icons.py). The animation runs when the
// icon or any button, link or row around it is hovered or focused, so it works inside every menu without wiring.
import type { CSSProperties } from "react";
import { iconCell, iconStyle, MACHINE_ICONS, STRUCTURE_ICONS } from "@/lib/automation/icons";
import { uiIconCell, uiIconStyle } from "@/lib/automation/icons/ui";
import "./icons.css";

const BIG = new Set<string>([...Object.keys(MACHINE_ICONS), ...Object.keys(STRUCTURE_ICONS)]);

/** The background longhands of a sprite style, moved into CSS variables so the glint can reuse them as a mask. */
function spriteVars(s: CSSProperties, px: number): CSSProperties {
    return {
        ...s,
        width: px,
        height: px,
        ["--bwi-img" as string]: s.backgroundImage,
        ["--bwi-size" as string]: s.backgroundSize,
        ["--bwi-pos" as string]: s.backgroundPosition,
        ["--bwi-render" as string]: s.imageRendering,
    };
}

/**
 * Item, machine, structure or belt icon. `name` adds a hover tooltip and makes the icon an image for screen readers;
 * leave it out where the name is already written next to the icon.
 */
export function ArtIcon({ id, size = 48, name, className }: { id: string; size?: number; name?: string; className?: string }) {
    if (iconCell(id) === undefined) return null;
    return (
        <span
            className={`bwi ${className ?? ""}`}
            data-kind={BIG.has(id) ? "machine" : "item"}
            data-name={name}
            role={name ? "img" : undefined}
            aria-label={name}
            aria-hidden={name ? undefined : true}
            style={spriteVars(iconStyle(id, size), size)}
        />
    );
}

/** HUD glyph (menus, dock, stage buttons) with the same hover life as the item icons. */
export function UiArtIcon({ id, size = 32, name, className }: { id: string; size?: number; name?: string; className?: string }) {
    if (uiIconCell(id) === undefined) return null;
    return (
        <span
            className={`bwi ${className ?? ""}`}
            data-kind="ui"
            data-name={name}
            role={name ? "img" : undefined}
            aria-label={name}
            aria-hidden={name ? undefined : true}
            style={spriteVars(uiIconStyle(id, size), size)}
        />
    );
}
