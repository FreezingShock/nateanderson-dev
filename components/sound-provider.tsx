"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { armSound } from "@/lib/sound/engine";
import { sfx, type SfxName } from "@/lib/sound/sounds";
import { nfx } from "@/lib/nodefarm/sound";

// Site-wide interface sound. One delegated listener turns clicks on buttons, tabs, switches and menus into the naOS
// tones from lib/sound, and a mouse hover over any of them plays a quiet keypad tick, so no component needs wiring.
// Opt an element (and everything in it) out with data-snd="off", or force a specific sound with data-snd="granted"
// (any catalogue name). Buttons that open a panel (aria-haspopup) stay silent: the panel plays its own open scan.
// Internal links stay silent on click and the route change plays the "nav" packet instead. data-snd-hover adds a tick
// to any other element.

const HIT = 'button, a[href], summary, [role="tab"], [role="switch"], [role="checkbox"], [role="menuitem"], [role="option"], [role="radio"], input[type="checkbox"], input[type="radio"], [data-snd]';
const HOVER = `${HIT}, [data-snd-hover]`;

function pickSound(el: HTMLElement): SfxName | null {
    const forced = el.closest("[data-snd]")?.getAttribute("data-snd");
    if (forced === "off") return null;
    if (forced) return forced as SfxName;
    if (el.closest('[data-snd="off"]')) return null;
    if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return null;
    const popup = el.getAttribute("aria-haspopup");
    if (popup && popup !== "false") return null; // the panel it opens plays open/close
    const role = el.getAttribute("role");
    if (role === "tab") return "tab";
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) return el.checked ? "on" : "off";
    if (role === "switch" || role === "checkbox") return el.getAttribute("aria-checked") === "true" ? "off" : "on";
    const ex = el.getAttribute("aria-expanded");
    if (ex !== null) return ex === "true" ? "close" : "open";
    if (el instanceof HTMLAnchorElement) {
        const href = el.getAttribute("href") ?? "";
        const internal = el.origin === location.origin && el.target !== "_blank" && !el.hasAttribute("download");
        if (internal && !href.startsWith("#")) return null; // the route change plays the nav tone
    }
    return "tap";
}

// Taps, toggles and hovers inside Node Farm go through its "interface" volume (lib/nodefarm/sound.ts); everywhere else plays as before.
const play = (name: SfxName, el: Element) => (el.closest(".nf") ? nfx(name, undefined, "interface") : sfx(name));

export function SoundProvider() {
    const path = usePathname();
    const first = useRef(true);

    useEffect(() => {
        armSound();
        const onClick = (e: MouseEvent) => {
            if (!(e.target instanceof Element)) return;
            const el = e.target.closest<HTMLElement>(HIT);
            if (!el) return;
            const name = pickSound(el);
            if (name) setTimeout(() => play(name, el), 0); // after the click's own handlers, so a purchase can outrank the tap
        };
        let over: Element | null = null;
        const onOver = (e: PointerEvent) => {
            if (e.pointerType !== "mouse" || !(e.target instanceof Element)) return;
            const el = e.target.closest<HTMLElement>(HOVER);
            if (el === over) return;
            over = el;
            if (!el || el.closest('[data-snd="off"]')) return;
            if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
            play("hover", el);
        };
        document.addEventListener("click", onClick, true);
        document.addEventListener("pointerover", onOver, true);
        return () => {
            document.removeEventListener("click", onClick, true);
            document.removeEventListener("pointerover", onOver, true);
        };
    }, []);

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        sfx("nav");
    }, [path]);

    return null;
}
