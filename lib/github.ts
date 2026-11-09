// Shared by app/history/page.tsx (server-rendered first page), app/api/commits/route.ts (the client's pagination),
// and the home page's stats and ticker, so every number on the site comes from the same branch and the same walk.
export const REPO = "FreezingShock/nateanderson-dev";

// The branch the live site is built from. Vercel sets VERCEL_GIT_COMMIT_REF for every deployment, so production
// follows whatever branch it ships (today: integration) and a preview shows its own branch. Local `npm run dev` has
// no Vercel variables, so it falls back to SITE_BRANCH, then to "integration".
export const SITE_BRANCH = process.env.VERCEL_GIT_COMMIT_REF || process.env.SITE_BRANCH || "integration";

// Unauthenticated GitHub REST calls are capped at 60/hour PER IP.
// GITHUB_TOKEN is entirely optional: if set (a fine-grained PAT with public
// read access is enough), authenticated requests get 5,000/hour instead.
export function githubHeaders(): HeadersInit {
    const headers: HeadersInit = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
}

export interface CommitEntry {
    hash: string;
    date: string;
    subject: string;
    // null (rather than 0) means "couldn't be fetched" so the UI can hide
    // the diff badge instead of confidently showing +0/-0 for a commit
    // whose stats call failed or is still loading.
    additions: number | null;
    deletions: number | null;
}

interface GhCommit {
    sha: string;
    parents: { sha: string }[];
    commit: {
        author: { date: string } | null;
        message: string;
    };
}

interface GhCommitDetail extends GhCommit {
    stats?: { additions: number; deletions: number; total: number };
}

// A commit's diff stats are content-addressed and immutable — the sha can
// never point to a different diff — so this is cached far longer (30 days)
// than the list endpoint (which does need to notice new commits). Once any
// visitor has ever loaded a given commit's stats, every later view of it
// (any page, any per_page grouping, anyone) reuses that one cached call for
// the rest of the month instead of re-spending rate-limit budget on data
// that was never going to change.
async function fetchStats(
    sha: string,
    headers: HeadersInit
): Promise<{ additions: number; deletions: number } | null> {
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${sha}`, {
            headers,
            next: { revalidate: 60 * 60 * 24 * 30 },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as GhCommitDetail;
        if (!data.stats) return null;
        return { additions: data.stats.additions, deletions: data.stats.deletions };
    } catch {
        return null;
    }
}

// One entry per change. The site's history is the first-parent chain of SITE_BRANCH: a squash-merged PR is one commit,
// and a merge-commit PR is one merge commit whose branch commits sit behind it and are skipped. Walking that chain
// (instead of counting every commit) means no change is counted twice. The list is fetched in pages of 100 and walked
// in memory, so the whole chain is known and pagination is exact. MAX_LIST_PAGES caps it at 1,000 commits.
const LIST_PER_PAGE = 100;
const MAX_LIST_PAGES = 10;

type ChainCommit = GhCommit;

export async function fetchSiteChain(revalidate = 3600, headers: HeadersInit = githubHeaders()): Promise<ChainCommit[] | null> {
    const all: GhCommit[] = [];
    for (let page = 1; page <= MAX_LIST_PAGES; page++) {
        const res = await fetch(
            `https://api.github.com/repos/${REPO}/commits?sha=${encodeURIComponent(SITE_BRANCH)}&per_page=${LIST_PER_PAGE}&page=${page}`,
            { headers, next: { revalidate } }
        );
        if (!res.ok) {
            const remaining = res.headers.get("x-ratelimit-remaining");
            console.error(`GitHub API error listing ${SITE_BRANCH}: ${res.status} (rate-limit remaining: ${remaining})`);
            return null;
        }
        const raw = (await res.json()) as GhCommit[];
        all.push(...raw);
        if (raw.length < LIST_PER_PAGE) break;
    }
    if (all.length === 0) return [];

    // Walk parents[0] from the branch tip. Every commit on the chain is in `all` unless the branch is longer than the cap.
    const bySha = new Map(all.map((c) => [c.sha, c]));
    const chain: ChainCommit[] = [];
    let cur: GhCommit | undefined = all[0];
    while (cur) {
        chain.push(cur);
        const parent: string | undefined = cur.parents?.[0]?.sha;
        cur = parent ? bySha.get(parent) : undefined;
    }
    return chain;
}

function toEntry(c: GhCommit, stats: { additions: number; deletions: number } | null): CommitEntry {
    return {
        hash: c.sha.slice(0, 7),
        date: c.commit.author?.date ?? "",
        subject: c.commit.message.split("\n")[0],
        additions: stats?.additions ?? null,
        deletions: stats?.deletions ?? null,
    };
}

// One page of the site's history, newest first, with diff stats for just that page's commits (each stats call is
// cached 30 days by sha, so a commit is only ever looked up once). Returns null if GitHub could not be reached.
export async function fetchSitePage(
    page: number,
    perPage: number,
    headers: HeadersInit = githubHeaders()
): Promise<{ commits: CommitEntry[]; total: number } | null> {
    const chain = await fetchSiteChain(3600, headers);
    if (chain === null) return null;
    const slice = chain.slice((page - 1) * perPage, page * perPage);
    const commits = await Promise.all(slice.map(async (c) => toEntry(c, await fetchStats(c.sha, headers))));
    return { commits, total: chain.length };
}

export interface RecentCommit {
    sha: string;
    hash: string;
    date: string;
    subject: string;
}

// Latest entries on the site branch for the landing page's latest-commit card and ticker. Cached 5 minutes so
// "latest commit" stays fresh. Uses the same chain as the history page, so the two always agree.
export async function fetchRecentCommits(count = 8): Promise<RecentCommit[]> {
    const chain = await fetchSiteChain(300);
    if (!chain) return [];
    return chain.slice(0, count).map((c) => ({
        sha: c.sha,
        hash: c.sha.slice(0, 7),
        date: c.commit.author?.date ?? "",
        subject: c.commit.message.split("\n")[0],
    }));
}
