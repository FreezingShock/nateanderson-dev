"use client";

import { useEffect, useState } from "react";
import { KEY_DATES, daysUntil } from "@/lib/timeline-data";

const TIMEZONE = "America/Los_Angeles";

// Sticky bar under the naOS top strip: today's date, the days left to Graduation Day, and jumps to the three
// Timeline sections (desktop only; phones keep the date line). The clock starts from the server's reading so the
// first paint matches, then refreshes every minute, the same way the countdown panels do.
export function TimelineTodayBar({ nowMs }: { nowMs: number }) {
    const [now, setNow] = useState(nowMs);
    useEffect(() => {
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    const dateLabel = new Intl.DateTimeFormat("en-US", {
        timeZone: TIMEZONE,
        month: "short",
        day: "numeric",
    }).format(now);

    const days = daysUntil(KEY_DATES.graduation, now);
    const countLabel =
        days > 0
            ? `${days} ${days === 1 ? "day" : "days"} to graduation`
            : days === 0
              ? "Graduation day"
              : "Graduated";

    return (
        <div className="tl-today">
            <p className="tl-today-now">
                <span>Today</span>
                <b>{dateLabel}</b>
                <span className="tl-today-sep" aria-hidden="true">/</span>
                <span>{countLabel}</span>
            </p>
            <nav className="tl-today-jump" aria-label="Jump to a Timeline section">
                <a href="#overview"><span>01</span>Route</a>
                <a href="#phases"><span>02</span>Phases</a>
                <a href="#horizons"><span>03</span>Horizons</a>
            </nav>
        </div>
    );
}
