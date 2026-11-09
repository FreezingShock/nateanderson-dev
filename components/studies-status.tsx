import { Scramble } from "@/components/cm/motion";
import { AP_WINDOW, courses } from "@/lib/studies-data";
import { KEY_DATES, daysUntil } from "@/lib/timeline-data";

// naOS status card for the Studies index: the school year as an ID card. Server-rendered from the same
// dates as the countdowns, so the numbers always agree with the rest of the page.
export function StudyStatus({ nowMs }: { nowMs: number }) {
    const toAp = daysUntil(AP_WINDOW.start, nowMs);
    const toGrad = daysUntil(KEY_DATES.graduation, nowMs);
    const classes = courses.length;

    return (
        <aside className="st-id st-anim" aria-label="Studies status">
            <div className="id-top">
                <Scramble className="id-sys" replay text="naOS // studies" />
                <span className="id-live"><i aria-hidden="true" />Live</span>
            </div>
            <div className="st-id-main">
                <div className="id-badge" aria-hidden="true"><b>sr</b><span>2027</span></div>
                <dl className="id-rows">
                    <div className="st-anim"><dt>Term</dt><dd><Scramble replay text="Senior year, Sept 2026 to June 2027" /></dd></div>
                    <div className="st-anim"><dt>Next checkpoint</dt><dd><Scramble replay text={toAp > 0 ? `AP window in ${toAp} days` : "AP window is open"} /></dd></div>
                    <div className="st-anim"><dt>Graduation</dt><dd><Scramble replay text={toGrad > 0 ? `${toGrad} days out` : "Graduation day"} /></dd></div>
                    <div className="st-anim"><dt>Load</dt><dd><Scramble replay text={`${classes} classes, one capstone`} /></dd></div>
                </dl>
            </div>
            <div className="id-foot" aria-hidden="true">
                <span className="id-bars"><i className="st-anim" /><i className="st-anim" /><i className="st-anim" /><i className="st-anim" /><i className="st-anim" /></span>
                <span>signal / steady</span>
                <span>Class of 2027</span>
            </div>
        </aside>
    );
}
