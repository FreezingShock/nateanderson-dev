import { PageHead } from "@/components/cm/ui";
import { CountUp } from "@/components/cm/reveal";
import { CommitHistory } from "@/components/commit-history";
import { REPO, githubHeaders, fetchCommitsPage, type CommitEntry } from "@/lib/github";
import { getRepoStats } from "@/lib/site-stats";

const INITIAL_PER_PAGE = 10;

// Auto-updating changelog: reads straight from the GitHub REST API at
// request time instead of a locally-generated lib/changelog.json. That file
// (and `npm run changelog` / scripts/generate-changelog.mjs) needed someone
// to remember to re-run it after every push — this needs nothing. The
// earlier approach existed because Vercel's default git clone depth can't
// be trusted for a build-time `git log`, but that constraint only applies
// to reading LOCAL git history; hitting GitHub's own API instead sidesteps
// it entirely and updates itself on every request (subject to the
// `revalidate` window below).
async function getCommits(): Promise<{ commits: CommitEntry[]; totalCommits: number }> {
    const headers = githubHeaders();

    const [commits, countRes] = await Promise.all([
        fetchCommitsPage(1, INITIAL_PER_PAGE, headers),
        // The commits endpoint has no total-count field — the standard trick
        // is asking for 1-per-page and reading the last page number out of
        // the pagination Link header.
        fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`, {
            headers,
            next: { revalidate: 3600 },
        }),
    ]);

    if (commits === null) {
        return { commits: [], totalCommits: 0 };
    }

    let totalCommits = commits.length;
    const link = countRes.headers.get("Link");
    const lastPageMatch = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
    if (lastPageMatch) totalCommits = Number(lastPageMatch[1]);

    return { commits, totalCommits };
}

export const revalidate = 3600; // re-check GitHub for new commits every hour

export default async function HistoryPage() {
    const [{ commits, totalCommits }, { fileCount, linesOfCode }] = await Promise.all([
        getCommits(),
        getRepoStats(),
    ]);

    const stats = [
        { label: "Commits", value: totalCommits },
        { label: "Lines of code", value: linesOfCode },
        { label: "File count", value: fileCount },
    ];

    return (
        <>
            <PageHead
                label="Meta / Changelog"
                title={["Site History"]}
                lead="This website's own changelog, pulled live from the GitHub API, not written by hand or regenerated manually."
            />
            <section className="cm-section" id="log">
                <div className="cm-wrap" style={{ display: "grid", gap: "var(--cm-s5)" }}>
                    <dl className="cm-panel tick cm-kv" style={{ ["--cols" as string]: 3 }}>
                        {stats.map((stat) => (
                            <div key={stat.label}>
                                <dt>{stat.label}</dt>
                                <dd style={{ fontSize: 28 }}>{stat.value > 0 ? <CountUp value={stat.value} /> : "—"}</dd>
                            </div>
                        ))}
                    </dl>
                    {totalCommits === 0 ? (
                        <div className="cm-panel cm-hatch" style={{ padding: 24 }}>
                            <span className="cm-read warm">Couldn&apos;t reach the GitHub API right now. Check back shortly.</span>
                        </div>
                    ) : (
                        <CommitHistory
                            repo={REPO}
                            totalCommits={totalCommits}
                            initialCommits={commits}
                            initialPerPage={INITIAL_PER_PAGE}
                        />
                    )}
                </div>
            </section>
        </>
    );
}

export const metadata = { title: "Site History" };
