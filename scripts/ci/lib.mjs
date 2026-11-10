// Shared helpers for the PR checks: wait for a server, get past the password gate.
export const PASSWORD = process.env.SITE_PASSWORD || "ci-password";

export async function waitFor(base, tries = 60) {
    for (let i = 0; i < tries; i++) {
        try {
            const r = await fetch(base, { redirect: "manual" });
            if (r.status) return;
        } catch {}
        await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`Server at ${base} never came up`);
}

/** Returns the signed unlock cookie as "name=value". */
export async function unlock(base) {
    const r = await fetch(`${base}/api/gate`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify({ password: PASSWORD }),
    });
    if (!r.ok) throw new Error(`Gate unlock failed (${r.status}). Is SITE_PASSWORD set for the server?`);
    const c = r.headers.getSetCookie().find((s) => s.startsWith("site_unlock="));
    if (!c) throw new Error("Gate gave no site_unlock cookie");
    return c.split(";")[0];
}
