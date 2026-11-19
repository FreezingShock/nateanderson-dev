import { Suspense } from "react";
import { REPO, fetchRecentCommits } from "@/lib/github";
import { RelativeTime } from "@/components/relative-time";

// The naOS status panel's live line. It reads the same first-parent chain /history reads (fetchSiteChain, cached
// 5 minutes and shared with the home stats), so it adds no GitHub calls of its own. It sits in its own Suspense
// boundary, so a slow or failed GitHub call never delays the hero.
async function LatestCommit() {
    const [latest] = await fetchRecentCommits(1);
    if (!latest) {
        return (
            <>
                <span className="hs-commit-when">Offline</span>
                <span className="hs-commit-link">
                    <span className="hs-commit-subject">GitHub is not reachable right now</span>
                </span>
            </>
        );
    }
    return (
        <>
            <RelativeTime className="hs-commit-when" iso={latest.date} />
            <a
                className="hs-commit-link"
                href={`https://github.com/${REPO}/commit/${latest.sha}`}
                target="_blank"
                rel="noreferrer"
                title={latest.subject}
            >
                <span className="hs-commit-hash">{latest.hash}</span>
                <span className="hs-commit-subject">{latest.subject}</span>
            </a>
        </>
    );
}

export function LastCommitLine() {
    return (
        <div className="hs-commit">
            <span className="hs-commit-k">Last commit</span>
            <Suspense
                fallback={
                    <>
                        <span className="hs-commit-when">Checking</span>
                        <span className="hs-commit-link">
                            <span className="hs-commit-subject">Reading GitHub</span>
                        </span>
                    </>
                }
            >
                <LatestCommit />
            </Suspense>
        </div>
    );
}
