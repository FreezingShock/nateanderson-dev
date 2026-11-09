export const NAV_EVENT = "cm:navigate";

/** Navigate with the page curtain (falls back to a plain push if the curtain is busy or reduced motion is on). */
export function navigateWithCurtain(href: string) {
    window.dispatchEvent(new CustomEvent<string>(NAV_EVENT, { detail: href }));
}
