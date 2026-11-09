import { SystemCard } from "@/components/system-card";
import "./system/system-naos.css";

// Route loading fallback. The card is invisible for the first 450ms (see .sys-load in system-naos.css), so fast
// page changes, and the page-change curtain in components/cm/motion-root.tsx, never show it. Nothing here animates
// the page itself, so it does not double up with the boot sequence or the transitions.
export default function Loading() {
    return (
        <div
            className="ctos sys-load"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <span className="sr-only">Loading</span>
            <div className="cm-wrap sys-body">
                <SystemCard
                    channel="link"
                    live="syncing"
                    code="..."
                    rows={[
                        { k: "State", v: "Acquiring signal" },
                        { k: "Channel", v: "Route" },
                        { k: "Mode", v: "Streaming" },
                    ]}
                    foot="Syncing"
                >
                    <div className="sys-track" aria-hidden="true">
                        <i />
                    </div>
                </SystemCard>
            </div>
        </div>
    );
}
