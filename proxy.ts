import { NextResponse, type NextRequest } from "next/server";
import { GATE } from "@/lib/gate/config";
import { gateHtml } from "@/lib/gate/page";
import { verifyToken } from "@/lib/gate/token";

// Sitewide password gate. Runs on the server before any page, asset or API route, so a locked
// visitor receives only the tiny password page below and never any of the site. The unlock
// cookie is HttpOnly and signed, so it cannot be read, forged or removed-to-bypass from the console.
export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;
    if (pathname === GATE.unlockPath) return NextResponse.next();
    // The Brasswork HUD preview is for `next dev` only. A real 404 status here, whatever the env says.
    if (process.env.NODE_ENV === "production" && pathname === "/automation-preview") {
        return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex, nofollow" } });
    }
    if (await verifyToken(req.cookies.get(GATE.cookie)?.value)) return NextResponse.next();

    const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
    const wantsPage = (req.method === "GET" || req.method === "HEAD") && (req.headers.get("accept") ?? "").includes("text/html");
    if (wantsPage) return new NextResponse(gateHtml(), { status: 401, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
    return NextResponse.json({ error: "locked" }, { status: 401, headers });
}

export const config = { matcher: "/:path*" };
