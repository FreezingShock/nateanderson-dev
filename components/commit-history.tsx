"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommitEntry } from "@/lib/github";
import styles from "@/app/history/history.module.css";

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;

// "September 28, 2026" — month spelled out, no leading zero on the day
// (Intl's `day: "numeric"` never adds one). `timeZone: "UTC"` keeps this in
// sync with the ISO date GitHub returns instead of drifting a day depending
// on the viewer's local timezone.
function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

// "10 hours ago" / "3 days ago" / "just now". `now` is passed in (rather
// than read via Date.now() inline) so the caller controls when this is
// allowed to run at all — see the `now` state below, which stays null until
// after mount specifically to dodge a server/client render mismatch.
function formatRelativeTime(iso: string, now: number): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const diff = Math.max(0, now - then);

    if (diff < MINUTE) return "just now";
    if (diff < HOUR) {
        const n = Math.round(diff / MINUTE);
        return `${n} minute${n === 1 ? "" : "s"} ago`;
    }
    if (diff < DAY) {
        const n = Math.round(diff / HOUR);
        return `${n} hour${n === 1 ? "" : "s"} ago`;
    }
    if (diff < WEEK) {
        const n = Math.round(diff / DAY);
        return `${n} day${n === 1 ? "" : "s"} ago`;
    }
    if (diff < MONTH) {
        const n = Math.round(diff / WEEK);
        return `${n} week${n === 1 ? "" : "s"} ago`;
    }
    if (diff < YEAR) {
        const n = Math.round(diff / MONTH);
        return `${n} month${n === 1 ? "" : "s"} ago`;
    }
    const n = Math.round(diff / YEAR);
    return `${n} year${n === 1 ? "" : "s"} ago`;
}

// Clamp helper used in a few places below so "page" can never end up outside
// [1, totalPages] no matter what triggered the change — a stale prop, a
// totalCommits of 0, a page-size change that shrinks the page count out from
// under the current page, etc.
function clampPage(page: number, totalPages: number): number {
    if (!Number.isFinite(page)) return 1;
    return Math.min(Math.max(1, page), Math.max(1, totalPages));
}

export function CommitHistory({
    repo,
    totalCommits,
    initialCommits,
    initialPerPage,
}: {
    repo: string;
    totalCommits: number;
    initialCommits: CommitEntry[];
    initialPerPage: number;
}) {
    const [perPage, setPerPage] = useState(initialPerPage);
    const [page, setPage] = useState(1);
    const [commits, setCommits] = useState(initialCommits);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    // Stays null through the server render and the very first client render
    // so "10 hours ago" never disagrees between server and client (a
    // hydration mismatch) — it fills in a tick after mount instead, then
    // keeps itself fresh every minute so the relative times don't go stale
    // on a long-open tab.
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), MINUTE);
        return () => clearInterval(id);
    }, []);

    const totalPages = Math.max(1, Math.ceil(totalCommits / perPage));

    // Guards against every source of staleness at once:
    // - `isMounted`: skip exactly one fetch — the very first render, whose
    //   data the server already sent as `initialCommits`. Everything after
    //   that always fetches, so navigating back to page 1 / the default
    //   page size re-fetches instead of silently reusing whatever the OLD
    //   effect run last set (the previous bug: it compared page/perPage
    //   back to their initial VALUES, which recur — page 1 and the default
    //   page size are both things a user returns to — so the effect kept
    //   bailing out and leaving stale commits on screen with a page number
    //   that no longer matched what was rendered).
    // - `requestId`: every effect run stamps a ticket; a response only ever
    //   commits to state if its ticket is still the latest one. Two
    //   in-flight requests (e.g. someone double-clicking Next) can now only
    //   ever have the newer one win, regardless of which resolves first —
    //   the AbortController below also cancels the network request itself,
    //   but this is the guard that actually matters for correctness.
    const isMounted = useRef(false);
    const requestId = useRef(0);

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }

        const thisRequest = ++requestId.current;
        const controller = new AbortController();
        setLoading(true);
        setError(false);

        // Same-origin API route instead of hitting api.github.com straight
        // from the browser: GitHub's unauthenticated REST API is capped at
        // 60 requests/HOUR PER IP, and every page/page-size click used to
        // spend one of those directly — a handful of clicks (or a shared
        // office/school IP) could exhaust it and surface as "Couldn't reach
        // the GitHub API" even though GitHub itself was fine. The route
        // (app/api/commits/route.ts) fetches server-side with an hour-long
        // cache, so many visitors paging around the same page/size combo
        // share one real GitHub call instead of each spending their own.
        fetch(`/api/commits?per_page=${perPage}&page=${page}`, {
            signal: controller.signal,
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Commit API error: ${res.status}`);
                return res.json();
            })
            .then((data: CommitEntry[]) => {
                if (requestId.current !== thisRequest) return; // superseded — ignore
                setCommits(data);
            })
            .catch((err) => {
                if (requestId.current !== thisRequest) return;
                if (err?.name !== "AbortError") setError(true);
            })
            .finally(() => {
                if (requestId.current === thisRequest) setLoading(false);
            });

        return () => controller.abort();
    }, [page, perPage]);

    // Defensive clamp: if totalCommits ever changes (a revalidated server
    // fetch handing this component new props) or perPage changes in a way
    // that shrinks totalPages below the current page, snap back into range
    // instead of leaving `page` pointing past the end — the direct cause of
    // the negative commit numbers, since a too-high page makes
    // `(page - 1) * perPage` exceed totalCommits.
    useEffect(() => {
        setPage((p) => clampPage(p, totalPages));
    }, [totalPages]);

    function handlePerPageChange(next: number) {
        setPerPage(next);
        setPage(1);
    }

    function goToPage(next: number) {
        setPage(clampPage(next, totalPages));
    }

    // Belt-and-suspenders against the exact symptom reported (negative
    // numbers on mobile): even if `page`/`perPage` ever momentarily
    // disagree with totalCommits between renders, neither the start number
    // nor each row's number can go below 1.
    const startNumber = Math.max(1, totalCommits - (page - 1) * perPage);
    const busy = loading;

    const controls = (
        <div className={`cm-row ${styles.controls}`}>
            <button type="button" className="cm-btn" disabled={busy || page <= 1} onClick={() => goToPage(1)} aria-label="First page">
                <ChevronsLeft className="cm-ico" />
            </button>
            <button type="button" className="cm-btn" disabled={busy || page <= 1} onClick={() => goToPage(page - 1)} aria-label="Previous page">
                <ChevronLeft className="cm-ico" />
            </button>
            <span className={`cm-coord ${styles.range}`} aria-live="polite">
                Page {page} of {totalPages}
            </span>
            <button type="button" className="cm-btn" disabled={busy || page >= totalPages} onClick={() => goToPage(page + 1)} aria-label="Next page">
                <ChevronRight className="cm-ico" />
            </button>
            <button type="button" className="cm-btn" disabled={busy || page >= totalPages} onClick={() => goToPage(totalPages)} aria-label="Last page">
                <ChevronsRight className="cm-ico" />
            </button>
        </div>
    );

    return (
        <div className="cm-panel">
            <div className="cm-hbar">
                <span className="live">Changelog</span>
                <span>{totalCommits.toLocaleString("en-US")} commits</span>
            </div>
            {/* Top bar: page-size selector + the same first/prev/next/last controls that repeat at the bottom. */}
            <div className={`cm-body-pad cm-row ${styles.topbar}`}>
                <label className="cm-row cm-lbl" style={{ gap: 8 }}>
                    Show
                    <select
                        value={perPage}
                        disabled={busy}
                        onChange={(e) => handlePerPageChange(Number(e.target.value))}
                        className={`cm-select ${styles.select}`}
                        aria-label="Commits per page"
                    >
                        {PAGE_SIZE_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                    per page
                </label>
                {controls}
            </div>

            <ol
                className={cn("cm-rail", loading && "opacity-50")}
                aria-live="polite"
                style={{ margin: 0, padding: "18px 14px 18px 36px", listStyle: "none" }}
                aria-busy={loading}
            >
                {error ? (
                    <li><p className="cm-note">Couldn&apos;t reach the GitHub API right now. Check back shortly.</p></li>
                ) : (
                    commits.map((entry, i) => {
                        const hasDiff = entry.additions !== null && entry.deletions !== null;
                        return (
                            <li key={entry.hash} className={page === 1 && i === 0 ? "now" : ""}>
                                <p className="cm-row" style={{ gap: 10, margin: 0 }}>
                                    <span className="cm-num" style={{ color: "var(--cm-cyan)" }}>#{Math.max(1, startNumber - i)}</span>
                                    <span className="cm-lbl">{formatDate(entry.date)}</span>
                                    {now !== null && <span className="cm-coord">{formatRelativeTime(entry.date, now)}</span>}
                                    <a
                                        href={`https://github.com/${repo}/commit/${entry.hash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="cm-coord"
                                        title={entry.hash}
                                    >
                                        {entry.hash.slice(0, 7)}
                                    </a>
                                </p>
                                <h3 className="cm-sub" style={{ marginTop: 4 }}>{entry.subject}</h3>
                                {hasDiff && (
                                    <p className="cm-coord" style={{ margin: "4px 0 0" }}>
                                        <span style={{ color: "var(--cm-good)" }}>+{entry.additions}</span>
                                        {" / "}
                                        <span style={{ color: "var(--cm-alert)" }}>-{entry.deletions}</span>
                                    </p>
                                )}
                            </li>
                        );
                    })
                )}
            </ol>

            <div className="cm-body-pad" style={{ borderTop: "1px solid var(--cm-hair)" }}>
                {controls}
            </div>
        </div>
    );
}
