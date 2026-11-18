// Password gate token and password tests (run with npm run test:nodefarm). Loads the real lib/gate modules under node.
import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(spec, ctx, next) { try { return next(spec, ctx); } catch (e) { if (spec.startsWith(".")) return next(spec + ".ts", ctx); throw e; } } });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const url = (rel) => pathToFileURL(resolve(root, rel)).href;
const { GATE } = await import(url("lib/gate/config.ts"));
const { checkPassword, makeToken, verifyToken } = await import(url("lib/gate/token.ts"));

const ENV_KEYS = ["SITE_PASSWORD", "SITE_PASSWORD_SHA256", "SITE_GATE_SECRET"];
const PASSWORD = "correct horse battery";
const sha = (s) => createHash("sha256").update(s).digest("hex");
const MAX_AGE_MS = GATE.maxAgeSeconds * 1000;

let saved;
let clock;

beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.SITE_PASSWORD = PASSWORD;
    process.env.SITE_GATE_SECRET = "test-secret-one";
    clock = 1_800_000_000_000;
    mock.method(Date, "now", () => clock);
});

afterEach(() => {
    mock.restoreAll();
    for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
});

describe("unlock token", () => {
    test("a token made now verifies", async () => {
        const token = await makeToken();
        assert.equal(await verifyToken(token), true);
    });

    test("the expiry is 400 days from now, as the cookie max-age", async () => {
        const token = await makeToken();
        const exp = Number(token.slice(0, token.indexOf(".")));
        assert.equal(exp, clock + MAX_AGE_MS);
        assert.equal(GATE.maxAgeSeconds, 400 * 24 * 60 * 60);
    });

    test("is still valid right up to its expiry instant", async () => {
        const token = await makeToken();
        clock += MAX_AGE_MS;
        assert.equal(await verifyToken(token), true);
    });

    test("is rejected one millisecond after expiry", async () => {
        const token = await makeToken();
        clock += MAX_AGE_MS + 1;
        assert.equal(await verifyToken(token), false);
    });

    test("missing, empty and malformed tokens are rejected", async () => {
        assert.equal(await verifyToken(undefined), false);
        assert.equal(await verifyToken(""), false);
        assert.equal(await verifyToken("no-dot-here"), false);
        assert.equal(await verifyToken(".abcdef"), false);
        assert.equal(await verifyToken("not-a-number.abcdef"), false);
    });

    test("a tampered expiry is rejected even though it is still in the future", async () => {
        const token = await makeToken();
        const i = token.indexOf(".");
        const later = Number(token.slice(0, i)) + 1000;
        assert.equal(await verifyToken(`${later}${token.slice(i)}`), false);
    });

    test("a tampered signature is rejected", async () => {
        const token = await makeToken();
        const last = token.at(-1);
        const flipped = token.slice(0, -1) + (last === "0" ? "1" : "0");
        assert.equal(await verifyToken(flipped), false);
    });

    test("a truncated signature is rejected", async () => {
        const token = await makeToken();
        assert.equal(await verifyToken(token.slice(0, -4)), false);
    });

    test("a token signed with another secret is rejected", async () => {
        const token = await makeToken();
        process.env.SITE_GATE_SECRET = "test-secret-two";
        assert.equal(await verifyToken(token), false);
    });

    test("changing the password revokes every token", async () => {
        const token = await makeToken();
        process.env.SITE_PASSWORD = "a different password";
        assert.equal(await verifyToken(token), false);
    });

    test("with no password configured, makeToken throws and verifyToken refuses", async () => {
        const token = await makeToken();
        delete process.env.SITE_PASSWORD;
        await assert.rejects(makeToken(), /no password configured/);
        assert.equal(await verifyToken(token), false);
    });

    test("a token made from SITE_PASSWORD_SHA256 verifies, and matches a token made from the plain password", async () => {
        const plain = await makeToken();
        delete process.env.SITE_PASSWORD;
        process.env.SITE_PASSWORD_SHA256 = sha(PASSWORD).toUpperCase();
        assert.equal(await verifyToken(plain), true);
        const hashed = await makeToken();
        assert.equal(await verifyToken(hashed), true);
    });
});

describe("checkPassword", () => {
    test("the right password is accepted", async () => {
        assert.equal(await checkPassword(PASSWORD), true);
    });

    test("a wrong password of the same length is rejected", async () => {
        assert.equal(await checkPassword("xxxxxxxxxxxxxxxxxxxx"), false);
    });

    test("a case change is rejected", async () => {
        assert.equal(await checkPassword(PASSWORD.toUpperCase()), false);
    });

    test("a prefix or a superset of the password is rejected", async () => {
        assert.equal(await checkPassword(PASSWORD.slice(0, -1)), false);
        assert.equal(await checkPassword(PASSWORD + " "), false);
        assert.equal(await checkPassword(PASSWORD + PASSWORD), false);
    });

    test("the empty string is rejected when a password is set", async () => {
        assert.equal(await checkPassword(""), false);
    });

    test("very long input is rejected without throwing", async () => {
        assert.equal(await checkPassword("x".repeat(10_000)), false);
    });

    test("multi-byte input is compared correctly", async () => {
        process.env.SITE_PASSWORD = "pässwörd";
        assert.equal(await checkPassword("pässwörd"), true);
        assert.equal(await checkPassword("passwort"), false);
        assert.equal(await checkPassword("pässwörd "), false);
    });

    test("with no password configured, every input is refused, including the empty string", async () => {
        delete process.env.SITE_PASSWORD;
        const logged = mock.method(console, "error", () => {});
        assert.equal(await checkPassword(""), false);
        assert.equal(await checkPassword(PASSWORD), false);
        assert.equal(logged.mock.callCount(), 2);
    });

    test("SITE_PASSWORD_SHA256 alone checks the hash, in either letter case", async () => {
        delete process.env.SITE_PASSWORD;
        process.env.SITE_PASSWORD_SHA256 = sha(PASSWORD);
        assert.equal(await checkPassword(PASSWORD), true);
        assert.equal(await checkPassword("wrong"), false);
        process.env.SITE_PASSWORD_SHA256 = sha(PASSWORD).toUpperCase();
        assert.equal(await checkPassword(PASSWORD), true);
    });

    test("SITE_PASSWORD_SHA256 takes precedence over SITE_PASSWORD when both are set", async () => {
        process.env.SITE_PASSWORD_SHA256 = sha("the hashed one");
        assert.equal(await checkPassword("the hashed one"), true);
        assert.equal(await checkPassword(PASSWORD), false);
    });
});
