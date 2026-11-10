import { REPO, SITE_BRANCH, fetchSiteChain, githubHeaders } from "@/lib/github";

// Shared by /history and the landing page's Site Statistics section so both
// read the same numbers through the same (cached) GitHub calls.

interface GhTreeEntry {
    path: string;
    type: "blob" | "tree" | "commit";
    size?: number;
}

// Extensions that are text source we actually want counted as "lines of
// code" — everything else (images, fonts, lockfile binaries, etc.) is
// skipped so a handful of PNGs in public/ can't inflate the number.
const CODE_EXTENSIONS = new Set([
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "css", "scss", "json", "md",
    "mdx", "html", "sql", "yml", "yaml", "sh", "toml", "txt",
]);

// File count + lines of code, both computed from the same tree walk so
// there's one source of truth instead of two flaky external calls: the
// tree API's `?recursive=1` returns every blob (file) in the repo in one
// request, no cloning needed. Lines of code used to come from
// api.codetabs.com/v1/loc, a third-party "clone + cloc" service — dropped
// after it started intermittently 522ing (Cloudflare timeout) even on a
// repo this small. Fetching each blob's raw text directly from
// raw.githubusercontent.com (uncached CDN, no api.github.com rate limit)
// and counting newlines ourselves has no external dependency beyond GitHub
// itself, which the rest of this page already trusts.
export async function getRepoStats(): Promise<{ fileCount: number; linesOfCode: number }> {
    const headers = githubHeaders();
    try {
        // Same branch as the commit history (see SITE_BRANCH), so the numbers describe what is actually on the site.
        const treeRes = await fetch(
            `https://api.github.com/repos/${REPO}/git/trees/${encodeURIComponent(SITE_BRANCH)}?recursive=1`,
            { headers, next: { revalidate: 3600 } }
        );
        if (!treeRes.ok) return { fileCount: 0, linesOfCode: 0 };
        const { tree } = (await treeRes.json()) as { tree: GhTreeEntry[] };
        const files = tree.filter((entry) => entry.type === "blob");

        const codeFiles = files.filter((f) => {
            const ext = f.path.split(".").pop()?.toLowerCase();
            return ext && CODE_EXTENSIONS.has(ext);
        });

        const lineCounts = await Promise.all(
            codeFiles.map(async (f) => {
                try {
                    const raw = await fetch(
                        `https://raw.githubusercontent.com/${REPO}/${SITE_BRANCH}/${f.path}`,
                        { next: { revalidate: 3600 } }
                    );
                    if (!raw.ok) return 0;
                    const text = await raw.text();
                    return text === "" ? 0 : text.split("\n").length;
                } catch {
                    return 0;
                }
            })
        );

        return {
            fileCount: files.length,
            linesOfCode: lineCounts.reduce((sum, n) => sum + n, 0),
        };
    } catch {
        return { fileCount: 0, linesOfCode: 0 };
    }
}

// Total entries on the site branch, one per change (see fetchSiteChain). Same number the history page shows.
export async function getTotalCommitCount(fallback = 0): Promise<number> {
    const chain = await fetchSiteChain();
    return chain ? chain.length : fallback;
}
