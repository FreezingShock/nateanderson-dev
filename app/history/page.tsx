import { PageHead } from "@/components/cm/ui";
import { CountUp } from "@/components/cm/reveal";
import { CommitHistory } from "@/components/commit-history";
import { REPO, githubHeaders, fetchCommitsPage, type CommitEntry } from "@/lib/github";
import { getRepoStats } from "@/lib/site-stats";
import styles from "./history.module.css";

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
async function getCommits(): Promise<{ commits: CommitEntry[]; totalCommits: number; failed: boolean }> {
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
        return { commits: [], totalCommits: 0, failed: true };
    }

    let totalCommits = commits.length;
    const link = countRes.headers.get("Link");
    const lastPageMatch = link?.match(/[?&]page=(\d+)>;\s*rel="last"/);
    if (lastPageMatch) totalCommits = Number(lastPageMatch[1]);

    return { commits, totalCommits, failed: false };
}

export const revalidate = 3600; // re-check GitHub for new commits every hour

export default async function HistoryPage() {
    const [{ commits, totalCommits, failed }, { fileCount, linesOfCode }] = await Promise.all([
        getCommits(),
        getRepoStats(),
    ]);

    const stats = [
        { label: "Commits", value: totalCommits, note: "On the default branch" },
        { label: "Lines of code", value: linesOfCode, note: "Text source files" },
        { label: "File count", value: fileCount, note: "Tracked in the repo" },
    ];
    const latest = commits[0];
    const latestDate = latest
        ? new Date(latest.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
        : null;

    return (
        <>
            <PageHead
                label="Meta / Changelog"
                title={["Site History"]}
                lead="This website's own changelog, pulled live from the GitHub API, not written by hand or regenerated manually."
            />
            <section className="cm-section" id="log">
                <div className="cm-wrap" data-mx-stagger="" style={{ display: "grid", gap: "var(--cm-s5)" }}>
                    <dl className={`cm-panel tick cm-kv ${styles.kv}`} style={{ ["--cols" as string]: 3 }}>
                        {stats.map((stat) => (
                            <div key={stat.label}>
                                <dt>{stat.label}</dt>
                                <dd>
                                    {stat.value > 0 ? <CountUp value={stat.value} /> : "—"}
                                    <span className={`cm-coord ${styles.note}`}>{stat.note}</span>
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {latest && (
                        <div className="cm-panel live">
                            <div className="cm-hbar">
                                <span className="live">Latest commit</span>
                                <span>{latestDate}</span>
                            </div>
                            <div className={styles.latest}>
                                <h2 className={styles.latestSubject}>{latest.subject}</h2>
                                <p className={`cm-coord ${styles.latestMeta}`} style={{ margin: 0 }}>
                                    <a href={`https://github.com/${REPO}/commit/${latest.hash}`} target="_blank" rel="noreferrer">
                                        {latest.hash.slice(0, 7)}
                                    </a>
                                    {latest.additions !== null && latest.deletions !== null && (
                                        <span>
                                            <span style={{ color: "var(--cm-good)" }}>+{latest.additions}</span>
                                            {" / "}
                                            <span style={{ color: "var(--cm-alert)" }}>-{latest.deletions}</span>
                                        </span>
                                    )}
                                    <a href={`https://github.com/${REPO}`} target="_blank" rel="noreferrer">
                                        {REPO}
                                    </a>
                                </p>
                            </div>
                        </div>
                    )}
                    {failed ? (
                        <div className="cm-panel cm-hatch" style={{ padding: 24 }}>
                            <span className="cm-read warm">Couldn&apos;t reach the GitHub API right now. Check back shortly.</span>
                        </div>
                    ) : totalCommits === 0 ? (
                        <div className="cm-panel cm-hatch" style={{ padding: 24 }}>
                            <span className="cm-read">No commits yet.</span>
                        </div>
                    ) : (
                        <CommitHistory
                            repo={REPO}
                            totalCommits={totalCommits}
                            initialCommits={commits}
                            initialPerPage={INITIAL_PER_PAGE}
                        />
                    )}
                    <p className={styles.footnote}>
                        Counts and commits are read from the GitHub API and refreshed about once an hour. Diff stats (+/−) are cached per commit.
                    </p>
                </div>
            </section>
        </>
    );
}

export const metadata = { title: "Site History" };
