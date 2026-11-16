import { GATE, gatePassword, gateSecret } from "./config";

// Signed, expiring unlock token. Web Crypto only, so it runs anywhere.
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

async function sha256(text: string): Promise<string> {
    return hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

async function hmac(data: string): Promise<string> {
    const key = await crypto.subtle.importKey("raw", enc.encode(gateSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return hex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Hash of the current password; folded into every token so a password change revokes them all. */
const passwordDigest = async () => process.env.SITE_PASSWORD_SHA256?.toLowerCase() || (await sha256(gatePassword()));

function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
    return safeEqual(await sha256(input), await passwordDigest());
}

export async function makeToken(): Promise<string> {
    const exp = Date.now() + GATE.maxAgeSeconds * 1000;
    return `${exp}.${await hmac(`gate|${exp}|${await passwordDigest()}`)}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    const i = token.indexOf(".");
    if (i < 1) return false;
    const exp = Number(token.slice(0, i));
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    return safeEqual(token.slice(i + 1), await hmac(`gate|${exp}|${await passwordDigest()}`));
}
