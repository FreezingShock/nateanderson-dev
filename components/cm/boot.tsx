/**
 * naOS load sequence (server-rendered, pure CSS, visuals in app/camino/motion.css section 6).
 * The inline script in <head> sets html[data-boot] before first paint:
 *   full  = first load of the session: a short system boot (log lines, title card, counter, shutters open).
 *   quick = any later load in the same session (reload, typed URL): a white title card sweeps across and off.
 *   done  = finished, or skipped by a tap or key press. Reduced motion never shows either.
 */
export function Boot() {
    return (
        <div className="cm-boot" aria-hidden="true">
            <div className="cm-boot-full">
                <i className="pt" />
                <i className="pb" />
                <i className="grid" />
                <div className="log">
                    <span className="ln l1">naOS 2.0 // cold start</span>
                    <span className="ln l2">mount /portfolio ........ ok</span>
                    <span className="ln l3">gate ................. sealed</span>
                    <span className="ln l4">link nateanderson.dev ... up</span>
                </div>
                <div className="title">
                    <span className="word">naOS</span>
                    <span className="sub">nate anderson</span>
                </div>
                <b className="pct" />
                <span className="track">
                    <i />
                </span>
                <span className="skip">tap or press any key to skip</span>
                <i className="scan" />
            </div>
            <div className="cm-boot-quick">
                <span className="word">re-syncing</span>
            </div>
        </div>
    );
}

// Runs before first paint. Chooses the variant, schedules the end on its own timer (a slow hydration can never leave
// the page hidden) and wires tap/key skip on the document. Back/forward restores and reduced motion skip it entirely.
export const BOOT_SCRIPT = `(function(){try{var d=document.documentElement;
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var n=performance.getEntriesByType('navigation')[0];
if(n&&n.type==='back_forward')return;
var seen=sessionStorage.getItem('cm-boot');
sessionStorage.setItem('cm-boot','1');
var full=!seen;
d.setAttribute('data-boot',full?'full':'quick');
var ms=full?1600:800;
var end=function(){d.setAttribute('data-boot','done');off()};
var t=setTimeout(end,Math.max(0,ms-performance.now()));
var off=function(){clearTimeout(t);['pointerdown','keydown','touchstart'].forEach(function(e){document.removeEventListener(e,end,true)})};
if(full){['pointerdown','keydown','touchstart'].forEach(function(e){document.addEventListener(e,end,true)})}
}catch(e){}})();`;
