/**
 * Site load sequence (server-rendered, pure CSS). It only appears when the inline script in <head> sets
 * html[data-boot]; with scripts off or reduced motion it never shows. Two shutters close over the page, a
 * mono readout types and counts, a scan line fires, and the shutters open to the page.
 * `full` = first visit this session, `quick` = reload or return visit.
 */
export function Boot() {
    return (
        <div className="cm-boot" aria-hidden="true">
            <i className="pt" />
            <i className="pb" />
            <div className="read">
                <span className="cm-lbl l1">Nate Anderson / Portfolio</span>
                <span className="cm-lbl l2 full">Establishing link</span>
                <span className="cm-lbl l2 quick">Re-syncing</span>
                <b className="pct" />
                <span className="track">
                    <i />
                </span>
            </div>
            <i className="scan" />
        </div>
    );
}

// Runs before first paint. Chooses the boot variant and schedules the end of the gate on its own timer, so a slow
// hydration can never leave the page hidden. Back/forward restores and reduced motion skip it entirely.
export const BOOT_SCRIPT = `(function(){try{var d=document.documentElement;
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var n=performance.getEntriesByType('navigation')[0];
if(n&&n.type==='back_forward')return;
var seen=sessionStorage.getItem('cm-boot');
sessionStorage.setItem('cm-boot','1');
var full=!seen&&!(n&&n.type==='reload');
d.setAttribute('data-boot',full?'full':'quick');
var ms=full?1650:780;
setTimeout(function(){d.setAttribute('data-boot','done')},Math.max(0,ms-performance.now()));
}catch(e){}})();`;
