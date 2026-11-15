// On-screen controls for touch screens. Plain DOM, no framework. The bar is one row of icon buttons in a strip
// under the 3D stage, so it never sits over the build field. Each button is 44 by 44 CSS pixels, with its name in
// aria-label and a tooltip. The strip shows on coarse pointers and on narrow screens, and stays hidden on a wide
// mouse-and-keyboard layout.

import type { TipData } from "../tips";
import { CONTROL_TIPS } from "../tips";
import { uiIconStyle } from "../icons/ui";

export interface TouchBarOptions {
    // Element the bar is added to. Its position is set to relative if it is static.
    container: HTMLElement;
    isTopDown(): boolean;
    onTopDown(): void;
    onRotate(): void;
    onUndo(): void;
    onRedo(): void;
    onRemove(): void;
    onCancel(): void;
}

export interface TouchBar {
    el: HTMLElement;
    // Refreshes the top-down button's pressed state. Call after any change to the view.
    sync(): void;
    destroy(): void;
}

const STYLE_ID = "bw-touch-bar-style";
// Height of the strip. The stage gives this much room at its bottom edge, and --bw-inset-bottom on .ab-root follows it.
const CSS = `
.bw-touch-bar{position:absolute;left:0;right:0;bottom:calc(-1 * var(--bw-touch-h,56px));height:var(--bw-touch-h,56px);box-sizing:border-box;display:none;align-items:center;justify-content:center;gap:6px;padding:0 max(8px,env(safe-area-inset-right));background:#0d0905;border-top:2px solid #4a3a22;z-index:5;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.bw-touch-bar button{flex:none;display:grid;place-items:center;width:44px;height:44px;margin:0;padding:0;border:2px solid #b8862f;border-radius:0;background:#1d160b;cursor:pointer;-webkit-tap-highlight-color:transparent}
.bw-touch-bar button:active{background:#3a2c14}
.bw-touch-bar button[aria-pressed="true"]{background:#f2c14e;border-color:#f2c14e}
.bw-touch-bar button[aria-pressed="true"] span{filter:brightness(0.18) sepia(1)}
.bw-touch-bar button:disabled{opacity:.4}
.bw-touch-bar button:focus-visible{outline:2px solid #f4e4b8;outline-offset:2px}
.bw-touch-bar span{display:block;pointer-events:none}
@media (pointer:coarse),(max-width:900px){
  .bw-touch-bar{display:flex}
  .bw-touch-host{margin-bottom:var(--bw-touch-h,56px)}
  .ab-root.bw{--bw-touch-h:56px;--bw-inset-bottom:68px}
}
`;

function ensureStyle(doc: Document) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.appendChild(style);
}

export function createTouchBar(opts: TouchBarOptions): TouchBar {
    const doc = opts.container.ownerDocument;
    ensureStyle(doc);
    if (getComputedStyle(opts.container).position === "static") opts.container.style.position = "relative";
    opts.container.classList.add("bw-touch-host");

    const el = doc.createElement("div");
    el.className = "bw-touch-bar";
    el.setAttribute("role", "toolbar");
    el.setAttribute("aria-label", "Build controls");

    // Each button shows one glyph from the brass HUD sheet. The name lives in aria-label and in the tooltip.
    const make = (icon: string, name: string, onPress: () => void, tip: TipData) => {
        const b = doc.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", name);
        // The shared Brasswork tag; a tap shows it and the tap still does its job.
        b.setAttribute("data-tip", JSON.stringify(tip));
        const span = doc.createElement("span");
        const st = uiIconStyle(icon, 28);
        for (const [k, v] of Object.entries(st)) {
            (span.style as unknown as Record<string, string>)[k] = typeof v === "number" ? `${v}px` : String(v);
        }
        b.appendChild(span);
        b.addEventListener("click", (e) => {
            e.preventDefault();
            onPress();
        });
        el.appendChild(b);
        return b;
    };

    const top = make(
      "map",
      "Top-down view",
      () => {
        opts.onTopDown();
        sync();
      },
      CONTROL_TIPS.topdown,
    );
    make("rotate", "Rotate the ghost, or the building under the last touch", opts.onRotate, CONTROL_TIPS.rotate);
    make("undo", "Undo", opts.onUndo, CONTROL_TIPS.undo);
    make("redo", "Redo", opts.onRedo, CONTROL_TIPS.redo);
    make("remove", "Remove a building (Delete tool)", opts.onRemove, CONTROL_TIPS.remove);
    make("back", "Cancel the current tool", opts.onCancel, CONTROL_TIPS.cancel);

    function sync() {
        top.setAttribute("aria-pressed", String(opts.isTopDown()));
    }
    sync();

    opts.container.appendChild(el);
    return {
        el,
        sync,
        destroy() {
            el.remove();
            opts.container.classList.remove("bw-touch-host");
        },
    };
}
