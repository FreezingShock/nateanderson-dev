// Inline script that sets `ctos-on` on <body> while the HTML is still being parsed, so a naOS page is styled correctly
// from its first paint. Without it the class only arrives after hydration (see components/cm/ctos-body.tsx), and the
// naOS footer arrows, footer rules and page background all snap in after the page has already been painted.
// Kept in a plain module (not a "use client" file) so the layout can render the string on the server.
export const CTOS_BODY_SCRIPT = 'document.body.classList.toggle("ctos-on",document.querySelector(".ctos")!==null);';
