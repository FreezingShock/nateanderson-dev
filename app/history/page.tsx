import { PageHead, Section } from "@/components/cm/ui";
import { CountUp } from "@/components/cm/reveal";
import { Scramble } from "@/components/cm/motion";
import { CommitHistory } from "@/components/commit-history";
import { REPO, SITE_BRANCH, githubHeaders, fetchSitePage, type CommitEntry } from "@/lib/github";
import { getRepoStats } from "@/lib/site-stats";
import styles from "./history.module.css";
import { pageMeta } from "@/lib/seo";

import { NaosBackdrop } from "@/components/cm/naos-art";
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
    // One walk of the site branch's first-parent chain gives both the page and the total, so they always agree.
    const page = await fetchSitePage(1, INITIAL_PER_PAGE, githubHeaders());
    if (page === null) return { commits: [], totalCommits: 0, failed: true };
    return { commits: page.commits, totalCommits: page.total, failed: false };
}

export const revalidate = 3600; // re-check GitHub for new commits every hour

export default async function HistoryPage() {
    const [{ commits, totalCommits, failed }, { fileCount, linesOfCode }] = await Promise.all([
        getCommits(),
        getRepoStats(),
    ]);

    const stats = [
        { label: "Commits", value: totalCommits, note: `On ${SITE_BRANCH}, one per change` },
        { label: "Lines of code", value: linesOfCode, note: "Text source files" },
        { label: "File count", value: fileCount, note: "Tracked in the repo" },
    ];
    const latest = commits[0];
    const latestDate = latest
        ? new Date(latest.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
        : null;
    const latestHasDiff = latest !== undefined && latest.additions !== null && latest.deletions !== null;

    // Recent churn: lines changed per commit for the last 12, oldest on the left, so the index panel shows movement.
    const recent = commits.slice(0, 12);
    const churnMax = Math.max(1, ...recent.map((c) => (c.additions ?? 0) + (c.deletions ?? 0)));
    const churn = recent
        .map((c) => ({
            hash: c.hash,
            pct: Math.max(10, Math.round((((c.additions ?? 0) + (c.deletions ?? 0)) / churnMax) * 100)),
        }))
        .reverse();

    return (
        <div className="ctos" data-entrance="log">
            <NaosBackdrop src="/naos/bg-history.webp" />
            <div className={styles.hero}>
                <PageHead
                    label="Meta / Changelog"
                    title={["site", "history"]}
                    lead="This website's own changelog, pulled live from the GitHub API, not written by hand or regenerated manually."
                >
                    <div className={styles.headStrip} aria-hidden="true">
                        <span className="id-live"><i />Feed live</span>
                        <span>source / github api</span>
                        <span>refresh / 1h</span>
                    </div>
                </PageHead>
            </div>

            <Section ctos id="stats" no="01" label="Index" title="The numbers behind the site.">
                <div className={styles.grid}>
                    <div className={`cm-panel ${styles.statsPanel}`} data-rx="slide">
                        <div className="cm-hbar"><span>Repo index</span><span>{REPO}</span></div>
                        <div className={`meta stats ${styles.stats}`}>
                            {stats.map((stat) => (
                                <div key={stat.label}>
                                    <div className="cm-lbl">{stat.label}</div>
                                    {stat.value > 0 ? <CountUp className="big" value={stat.value} /> : <span className="big none">—</span>}
                                    <div className={`cm-coord ${styles.note}`}>{stat.note}</div>
                                </div>
                            ))}
                        </div>
                        {churn.length > 0 && (
                            <div className={styles.churn}>
                                <div className={styles.churnHead}>
                                    <span className="cm-lbl">Recent churn</span>
                                    <span className="cm-coord">Lines changed, last {churn.length} commits</span>
                                </div>
                                <div className={styles.bars} role="img" aria-label={`Lines changed in the last ${churn.length} commits, oldest to newest`}>
                                    {churn.map((c, i) => (
                                        <i key={c.hash} style={{ height: `${c.pct}%`, animationDelay: `${0.5 + i * 0.05}s` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="p-foot" aria-hidden="true">
                            <span className="id-bars"><i /><i /><i /><i /><i /></span>
                            <span>index / 3 metrics</span>
                            <span>{totalCommits > 0 ? `${totalCommits.toLocaleString("en-US")} commits` : "no data"}</span>
                        </div>
                    </div>

                    {latest && (
                        <section className={`cm-panel ${styles.idCard}`} aria-label="Latest commit" data-rx="slide-r">
                            <div className="id-top">
                                <Scramble className="id-sys" replay text="naOS // latest commit" />
                                <span className="id-live"><i aria-hidden="true" />Live</span>
                            </div>
                            <div className="id-main">
                                <div className="id-badge" aria-hidden="true">
                                    <b>{latest.hash.slice(0, 2)}</b>
                                    <span>head</span>
                                </div>
                                <dl className="id-rows">
                                    <div>
                                        <dt>Subject</dt>
                                        <dd><Scramble replay text={latest.subject} /></dd>
                                    </div>
                                    <div>
                                        <dt>Date</dt>
                                        <dd>{latestDate}</dd>
                                    </div>
                                    <div>
                                        <dt>Commit</dt>
                                        <dd>
                                            <a href={`https://github.com/${REPO}/commit/${latest.hash}`} target="_blank" rel="noreferrer">
                                                {latest.hash.slice(0, 7)}
                                            </a>
                                        </dd>
                                    </div>
                                    {latestHasDiff && (
                                        <div>
                                            <dt>Diff</dt>
                                            <dd>
                                                <span style={{ color: "var(--cm-good)" }}>+{latest.additions}</span>
                                                {" / "}
                                                <span style={{ color: "var(--cm-alert)" }}>-{latest.deletions}</span>
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                            <div className="id-foot" aria-hidden="true">
                                <span className="id-bars"><i /><i /><i /><i /><i /></span>
                                <span>signal / strong</span>
                                <span>{REPO.split("/")[1]}</span>
                            </div>
                        </section>
                    )}
                </div>
            </Section>

            <Section ctos id="log" no="02" label="Changelog" title="Every change, in order.">
                {failed ? (
                    <div className={`cm-panel ${styles.notice}`}>
                        <span className="cm-read warm">Couldn&apos;t reach the GitHub API right now. Check back shortly.</span>
                        {process.env.NODE_ENV === "development" && (
                            <span className="cm-coord">
                                Local dev: GitHub allows 60 unauthenticated requests an hour. Set GITHUB_TOKEN in .env.local (a
                                fine-grained token with public read access is enough) for live data.
                            </span>
                        )}
                    </div>
                ) : totalCommits === 0 ? (
                    <div className={`cm-panel ${styles.notice}`}>
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
                <div className={`p-foot ${styles.footnote}`} aria-hidden="true">
                    <span className="id-bars"><i /><i /><i /><i /><i /></span>
                    <span>counts and commits refresh about hourly</span>
                    <span>diff stats cached per commit</span>
                </div>
            </Section>
        </div>
    );
}

export const metadata = pageMeta({
    title: "Site History",
    description: "This website's own changelog, pulled live from the GitHub API, not written by hand.",
    path: "/history",
});
