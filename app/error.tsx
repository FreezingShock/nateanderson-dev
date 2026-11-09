"use client";

import Link from "next/link";
import { PageHead } from "@/components/cm/ui";
import { SystemCard } from "@/components/system-card";
import "./system/system-naos.css";

// Route-level error boundary. Renders inside the root layout, so the bar and dock stay usable.
export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="ctos">
            <div className="sys-head">
                <PageHead
                    label="Fault / naOS"
                    title={["system", "fault."]}
                    lead={
                        <>
                            Something broke while this page was loading. Retry,
                            or head back to the start.
                        </>
                    }
                />
            </div>
            <div className="cm-wrap sys-body">
                <SystemCard
                    channel="fault"
                    live="fault"
                    code="ERR"
                    rows={[
                        { k: "Status", v: "Fault" },
                        { k: "Digest", v: error.digest ?? "none" },
                        { k: "Action", v: "Retry or go home" },
                    ]}
                    foot="Signal lost / fault"
                    actions={
                        <>
                            <button
                                type="button"
                                className="cm-btn solid"
                                onClick={() => reset()}
                            >
                                Retry
                            </button>
                            <Link className="cm-btn" href="/">
                                Home
                            </Link>
                        </>
                    }
                />
            </div>
        </div>
    );
}
