import { NextRequest, NextResponse } from "next/server";
import { fetchSitePage } from "@/lib/github";

const MAX_PER_PAGE = 20;

// Server-side proxy for paginated commit fetches, so the browser never talks
// to api.github.com directly. Unauthenticated GitHub REST calls are capped
// at 60/hour PER IP — CommitHistory used to fetch straight from the client
// on every page/page-size change, so a handful of clicks during testing (or
// any one visitor paging around) could exhaust that budget entirely, which
// surfaced as "Couldn't reach the GitHub API" even though GitHub itself was
// fine. Routing through this route instead means:
// - Next's fetch cache (see lib/github.ts) shares one real GitHub call
//   across every visitor hitting the same page/per_page combo within the
//   window, instead of each browser spending its own quota per click. Each
//   commit's diff stats are cached separately, by sha, for 30 days — they
//   can never change, so that cost is paid at most once per commit ever.
// - If GITHUB_TOKEN is ever set in the environment, authenticated requests
//   get a 5,000/hour ceiling instead of 60 — optional, not required.
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPageRaw = Number(searchParams.get("per_page")) || 10;
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, perPageRaw));

    try {
        const result = await fetchSitePage(page, perPage);
        if (result === null) {
            return NextResponse.json({ error: "Upstream GitHub API error" }, { status: 502 });
        }

        return NextResponse.json(result.commits, {
            headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
        });
    } catch (err) {
        console.error("Failed to reach GitHub API:", err);
        return NextResponse.json({ error: "Failed to reach GitHub API" }, { status: 502 });
    }
}
