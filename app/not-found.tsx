import Link from "next/link";
import { PageHead } from "@/components/cm/ui";
import { SystemCard, SYSTEM_JUMP } from "@/components/system-card";
import "./system/system-naos.css";

export const metadata = { title: "Signal lost" };

export default function NotFound() {
    return (
        <div className="ctos">
            <div className="sys-head">
                <PageHead
                    label="Error 404 / naOS"
                    title={["signal", "lost."]}
                    lead={
                        <>
                            This route is not on the network. It may have moved,
                            or it may never have existed.
                        </>
                    }
                />
            </div>
            <div className="cm-wrap sys-body">
                <SystemCard
                    channel="route"
                    live="no signal"
                    code="404"
                    rows={[
                        { k: "Status", v: "Not found" },
                        { k: "Route", v: "Unresolved" },
                        { k: "Next", v: "Pick a channel below" },
                    ]}
                    foot="Signal lost / 404"
                />
                <nav
                    className="cm-row cta sys-jump"
                    aria-label="Go somewhere else"
                >
                    {SYSTEM_JUMP.map((item, i) => (
                        <Link
                            key={item.href}
                            className="cta-b"
                            href={item.href}
                        >
                            <i>{String(i + 1).padStart(2, "0")}</i>
                            <span>{item.label}</span>
                            <em aria-hidden="true">→</em>
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    );
}
