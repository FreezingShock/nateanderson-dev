// Sitewide password gate: every setting lives here.
//
// Change the password WITHOUT touching code by setting these in Vercel (Project > Settings > Environment Variables):
//   SITE_PASSWORD         the password in plain text (simplest)
//   SITE_PASSWORD_SHA256  or, instead, the hex SHA-256 of it, so the plain text is never stored anywhere
//   SITE_GATE_SECRET      a long random string that signs the unlock cookie (set this in production)
// With neither SITE_PASSWORD nor SITE_PASSWORD_SHA256 set, the gate refuses every password (it fails closed).
// Local dev: put SITE_PASSWORD in .env.local, which git ignores. CI sets its own password in the workflow.
// Changing the password (or the secret) signs every visitor out, because the cookie is derived from both.
// Nothing here is ever sent to the browser: this file is only imported by the proxy and API routes.

export const GATE = {
    cookie: "site_unlock",
    /** Browsers cap cookie lifetime at about 400 days, so this is "once and never again". */
    maxAgeSeconds: 60 * 60 * 24 * 400,
    /** The only path reachable without the cookie. */
    unlockPath: "/api/gate",
    /** Failed attempts allowed per IP in the window before it is locked out. */
    maxFailures: 8,
    windowMs: 10 * 60 * 1000,
    title: "Private",
    hint: "Enter the password to continue.",
};

/** The plain-text password, or "" when none is set. Empty means the gate refuses every password. */
export const gatePassword = () => process.env.SITE_PASSWORD || "";
export const gateSecret = () => process.env.SITE_GATE_SECRET || "fractured-gate-dev-secret-set-SITE_GATE_SECRET";
