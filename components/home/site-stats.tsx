import { REPO, fetchRecentCommits } from "@/lib/github";
import { getRepoStats, getTotalCommitCount } from "@/lib/site-stats";
import { Section } from "@/components/cm/ui";
import { CountUp } from "@/components/cm/reveal";
import { RelativeTime } from "@/components/relative-time";

// Server component: the same numbers as /history, through the same cached GitHub calls. It sits inside
// <Suspense> on the home page, so a cold GitHub cache never delays the hero.
export async function SiteStats() {
    const [commitCount, { fileCount, linesOfCode }, recent] = await Promise.all([
        getTotalCommitCount(),
        getRepoStats(),
        fetchRecentCommits(7),
    ]);
    const rows = [
        { layer: "Commits", note: "Every change to this site, saved one small step at a time.", n: commitCount },
        { layer: "Lines of code", note: "Hand-written TypeScript, CSS and content behind every page.", n: linesOfCode },
        { layer: "Files", note: "Pages, components and assets that make up the project.", n: fileCount },
    ];
    return (
        <Section
            ctos
            id="stats"
            no="03"
            label="Site statistics"
            title="Read live from GitHub."
            blurb="This site is never finished, so these numbers climb every time something new ships."
            more={{ href: "/history", label: "Full history" }}
        >
            <div className="cm-split even">
                <table className="cm-table">
                    <thead>
                        <tr>
                            <th>Layer</th>
                            <th>What it counts</th>
                            <th className="n">Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.layer}>
                                <td>{r.layer}</td>
                                <td style={{ color: "var(--cm-mute)" }}>{r.note}</td>
                                <td className="n">{r.n > 0 ? <CountUp value={r.n} /> : "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="cm-panel">
                    <div className="cm-hbar">
                        <span className="live">Activity</span>
                        <span>{recent.length > 0 ? "Live" : "Offline"}</span>
                    </div>
                    {recent.length > 0 ? (
                        <ol className="cm-stream">
                            {recent.map((c) => (
                                <li key={c.sha}>
                                    <b><RelativeTime iso={c.date} /></b>{" "}
                                    <a
                                        className="k"
                                        style={{ textDecoration: "none" }}
                                        href={`https://github.com/${REPO}/commit/${c.sha}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {c.hash}
                                    </a>{" "}
                                    {c.subject}
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="cm-body-pad cm-note">Couldn&apos;t reach the GitHub API right now. Check back shortly.</p>
                    )}
                </div>
            </div>
        </Section>
    );
}

export function SiteStatsSkeleton() {
    return (
        <Section id="stats" no="03" label="Site statistics" title="Read live from GitHub.">
            <div className="cm-panel" style={{ height: 180 }} aria-hidden="true" />
        </Section>
    );
}
