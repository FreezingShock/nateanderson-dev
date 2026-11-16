// Shared plumbing for the game checks: the browser, the password gate, the result report and small page helpers.
// Playwright and pixelmatch come from scripts/ci/node_modules (cd scripts/ci && npm install).
// CHROMIUM_PATH picks a browser binary by hand, for machines where Playwright's own download is missing.
import { createRequire } from "node:module";
import { unlock } from "../lib.mjs";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

export async function launch(options = {}) {
    const executable = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
    return chromium.launch({ ...executable, ...options });
}

/** The site password gate, as the cookie a page needs: { name, value }. */
export async function gateCookie(base) {
    const [name, ...value] = (await unlock(base)).split("=");
    return { name, value: value.join("=") };
}

/** Collects every assertion from every suite, so the runner can print one total and write one summary. */
export class Report {
    constructor() {
        this.items = [];
    }

    check(suite, ok, msg) {
        this.items.push({ suite, ok: !!ok, msg });
        console.log(ok ? "PASS" : "FAIL", msg);
        return !!ok;
    }

    /** A skipped assertion prints a line but does not count, as before. */
    skip(msg) {
        console.log("SKIP", msg);
    }

    get failed() {
        return this.items.filter((i) => !i.ok);
    }
}

/** Bounding box of the first element matching sel, or null. */
export const rectOf = (page, sel) =>
    page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
    }, sel);

/** A new browser context with the gate cookie already set. */
export async function gatedContext(browser, base, cookie, options = {}) {
    const context = await browser.newContext(options);
    await context.addCookies([{ name: cookie.name, value: cookie.value, url: base }]);
    return context;
}
