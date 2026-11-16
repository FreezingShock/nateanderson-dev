// On-screen camera pad for touch screens. A joystick pans the map, two turn buttons swing the camera left and right,
// and two zoom buttons move in and out. It sits in the stage's bottom corners above the bottom bar, shows on coarse
// pointers and narrow screens, and stays hidden on a mouse layout. Presses here never reach the build pointer, which
// listens on the canvas only, so a press on the pad never places a building.

import type { OrbitCamera } from "./camera";

export interface TouchPadOptions {
    // Element the pad is added to, the same stage container the touch bar uses.
    container: HTMLElement;
    camera: OrbitCamera;
}

export interface TouchPad {
    el: HTMLElement;
    // Call once per frame with the frame time in seconds. Held controls move the camera here.
    update(dt: number): void;
    destroy(): void;
}

const STYLE_ID = "bw-touch-pad-style";
const CSS = `
.bw-pad{position:absolute;left:10px;bottom:var(--bw-pad-bottom,72px);z-index:6;display:none;align-items:flex-end;gap:8px;box-sizing:border-box;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.bw-pad-stick{position:relative;width:112px;height:112px;box-sizing:border-box;border:2px solid #b8862f;background:radial-gradient(circle at 50% 50%,rgba(197,154,82,.10),rgba(8,6,3,.62) 70%);touch-action:none;cursor:pointer}
.bw-pad-stick::before,.bw-pad-stick::after{content:"";position:absolute;background:rgba(197,154,82,.22);pointer-events:none}
.bw-pad-stick::before{left:50%;top:14px;bottom:14px;width:1px;transform:translateX(-50%)}
.bw-pad-stick::after{top:50%;left:14px;right:14px;height:1px;transform:translateY(-50%)}
.bw-pad-knob{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;box-sizing:border-box;border:2px solid #f0c97a;background:linear-gradient(180deg,#f4cf7e,#b8862f);box-shadow:0 2px 0 #000;pointer-events:none;transition:transform 90ms ease-out}
.bw-pad-stick[data-live="true"] .bw-pad-knob{transition:none}
.bw-pad-turns{display:grid;grid-template-columns:repeat(2,40px);grid-template-rows:repeat(2,40px);gap:6px}
.bw-pad-btn{display:grid;place-items:center;width:40px;height:40px;margin:0;padding:0;box-sizing:border-box;border:2px solid #b8862f;border-radius:0;background:rgba(29,22,11,.92);color:#f0c97a;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent}
.bw-pad-btn svg{width:18px;height:18px;display:block;pointer-events:none}
.bw-pad-btn[data-held="true"]{background:#f2c14e;border-color:#f2c14e;color:#1d160b}
.bw-pad-btn:focus-visible{outline:2px solid #f4e4b8;outline-offset:2px}
@media (pointer:coarse),(max-width:900px){
  .bw-pad{display:flex}
}
`;

const ICON = {
    left: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M11 3 5 9l6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="miter"/></svg>',
    right: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M7 3l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="miter"/></svg>',
    plus: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="2.4"/></svg>',
    minus: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h12" stroke="currentColor" stroke-width="2.4"/></svg>',
};

// Rates. The pan speed scales with the camera distance, so the map crosses the island at the same pace at any zoom.
const PAN_PER_DISTANCE = 0.7; // ground units per second per unit of distance, at full stick
const TURN_RATE = 1.5; // radians per second
const ZOOM_RATE = 1.2; // 1/s, in log terms

function ensureStyle(doc: Document) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.appendChild(style);
}

export function createTouchPad(opts: TouchPadOptions): TouchPad {
    const doc = opts.container.ownerDocument;
    ensureStyle(doc);
    opts.container.classList.add("bw-touch-host");

    const el = doc.createElement("div");
    el.className = "bw-pad";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", "Camera controls");

    const stick = doc.createElement("div");
    stick.className = "bw-pad-stick";
    stick.setAttribute("role", "slider");
    stick.setAttribute("aria-label", "Move the camera. Drag the stick to pan the map.");
    const knob = doc.createElement("div");
    knob.className = "bw-pad-knob";
    stick.appendChild(knob);
    el.appendChild(stick);

    const turns = doc.createElement("div");
    turns.className = "bw-pad-turns";
    el.appendChild(turns);

    // Held state. Each button sets one of these while its pointer is down.
    let sx = 0;
    let sy = 0;
    let turn = 0;
    let zoom = 0;

    const setKnob = (x: number, y: number) => {
        knob.style.transform = `translate(${(x * 30).toFixed(1)}px, ${(y * 30).toFixed(1)}px)`;
    };

    const stickAt = (e: PointerEvent) => {
        const r = stick.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const half = Math.max(1, r.width / 2 - 24);
        const x = Math.max(-1, Math.min(1, (e.clientX - cx) / half));
        const y = Math.max(-1, Math.min(1, (e.clientY - cy) / half));
        sx = x;
        sy = y;
        setKnob(x, y);
    };
    const stickEnd = () => {
        sx = 0;
        sy = 0;
        setKnob(0, 0);
        stick.removeAttribute("data-live");
    };
    const onStickDown = (e: PointerEvent) => {
        e.preventDefault();
        try { stick.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        stick.setAttribute("data-live", "true");
        stickAt(e);
    };
    const onStickMove = (e: PointerEvent) => {
        if (!stick.hasPointerCapture(e.pointerId)) return;
        stickAt(e);
    };
    stick.addEventListener("pointerdown", onStickDown);
    stick.addEventListener("pointermove", onStickMove);
    stick.addEventListener("pointerup", stickEnd);
    stick.addEventListener("pointercancel", stickEnd);

    // A button is held while its pointer is down. Releasing anywhere ends the hold.
    const btn = (icon: keyof typeof ICON, name: string, onHold: (on: boolean) => void, tip?: string) => {
        const b = doc.createElement("button");
        b.type = "button";
        b.className = "bw-pad-btn";
        b.setAttribute("aria-label", name);
        if (tip) b.title = tip;
        b.innerHTML = ICON[icon];
        const down = (e: PointerEvent) => {
            e.preventDefault();
            try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            b.setAttribute("data-held", "true");
            onHold(true);
        };
        const up = () => {
            b.removeAttribute("data-held");
            onHold(false);
        };
        b.addEventListener("pointerdown", down);
        b.addEventListener("pointerup", up);
        b.addEventListener("pointercancel", up);
        b.addEventListener("lostpointercapture", up);
        return b;
    };

    turns.appendChild(btn("left", "Turn the camera left", (on) => (turn = on ? 1 : 0)));
    turns.appendChild(btn("right", "Turn the camera right", (on) => (turn = on ? -1 : 0)));
    turns.appendChild(btn("plus", "Zoom in", (on) => (zoom = on ? 1 : 0)));
    turns.appendChild(btn("minus", "Zoom out", (on) => (zoom = on ? -1 : 0)));

    opts.container.appendChild(el);
    return {
        el,
        update(dt: number) {
            const step = Math.min(dt, 0.1);
            if (sx !== 0 || sy !== 0) {
                const k = PAN_PER_DISTANCE * opts.camera.pose().distance * step;
                // Up on the stick walks forward, right walks right.
                opts.camera.panWorld(-sy * k, sx * k);
            }
            if (turn !== 0) opts.camera.rotate(turn * TURN_RATE * step);
            if (zoom !== 0) opts.camera.zoom(Math.exp(-zoom * ZOOM_RATE * step));
        },
        destroy() {
            el.remove();
            opts.container.classList.remove("bw-touch-host");
        },
    };
}
