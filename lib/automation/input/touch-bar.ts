// On-screen controls for touch screens. Plain DOM, no framework. Every button is at least 48 by 48 CSS
// pixels, with a visible label, so it is easy to hit with a thumb. The bar shows on coarse pointers and
// on narrow screens, and stays hidden on a wide mouse-and-keyboard layout.

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
const CSS = `
.bw-touch-bar{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));display:none;flex-wrap:wrap;justify-content:flex-end;gap:8px;max-width:calc(100% - 24px);z-index:5;touch-action:manipulation;-webkit-user-select:none;user-select:none}
@media (pointer:coarse),(max-width:900px){.bw-touch-bar{display:flex}}
.bw-touch-bar button{min-width:48px;min-height:48px;padding:0 12px;border:2px solid #b8862f;border-radius:0;background:#1d160b;color:#f4e4b8;font:600 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent}
.bw-touch-bar button:active{background:#3a2c14}
.bw-touch-bar button[aria-pressed="true"]{background:#f2c14e;color:#1d160b;border-color:#f2c14e}
.bw-touch-bar button:disabled{opacity:.4}
.bw-touch-bar button:focus-visible{outline:2px solid #f4e4b8;outline-offset:2px}
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

    const el = doc.createElement("div");
    el.className = "bw-touch-bar";
    el.setAttribute("role", "toolbar");
    el.setAttribute("aria-label", "Build controls");

    const make = (label: string, aria: string, onPress: () => void) => {
        const b = doc.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.setAttribute("aria-label", aria);
        b.addEventListener("click", (e) => {
            e.preventDefault();
            onPress();
        });
        el.appendChild(b);
        return b;
    };

    const top = make("Top", "Top-down view", () => {
        opts.onTopDown();
        sync();
    });
    make("Rotate", "Rotate the ghost, or the building under the last touch", opts.onRotate);
    make("Undo", "Undo", opts.onUndo);
    make("Redo", "Redo", opts.onRedo);
    make("Remove", "Remove a building (Delete tool)", opts.onRemove);
    make("Cancel", "Cancel the current tool", opts.onCancel);

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
        },
    };
}
