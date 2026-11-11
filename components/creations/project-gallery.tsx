"use client";

import { useRef, useState } from "react";
import type { ProjectShot } from "@/lib/creations-data";

// Screenshot gallery for a project page. Each frame opens a full-size view in a native <dialog>, so Escape, focus
// trapping and the backdrop close all come from the browser. Arrow keys step through the set.
export function ProjectGallery({ shots }: { shots: ProjectShot[] }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [active, setActive] = useState<number | null>(null);

    const openAt = (i: number) => {
        setActive(i);
        dialogRef.current?.showModal();
    };
    const close = () => dialogRef.current?.close();
    const step = (dir: 1 | -1) =>
        setActive((i) => (i === null ? 0 : (i + dir + shots.length) % shots.length));

    const current = active !== null ? shots[active] : null;

    return (
        <>
            <div className={shots.length > 1 ? "cr-case-grid is-multi" : "cr-case-grid"}>
                {shots.map((shot, i) => (
                    <figure key={shot.src} className="cr-case-shot">
                        <button type="button" className="cr-shot-btn" onClick={() => openAt(i)} aria-label={`Open image ${i + 1} full size`}>
                            <img src={shot.src} alt={shot.alt} width={1600} height={1000} loading="lazy" decoding="async" />
                        </button>
                        <figcaption>{shot.caption}</figcaption>
                    </figure>
                ))}
            </div>

            <dialog
                ref={dialogRef}
                className="cr-lb"
                onClose={() => setActive(null)}
                onClick={(e) => {
                    if (e.target === e.currentTarget) close();
                }}
                onKeyDown={(e) => {
                    if (e.key === "ArrowRight") step(1);
                    if (e.key === "ArrowLeft") step(-1);
                }}
            >
                {current && (
                    <div className="cr-lb-body">
                        <div className="cr-lb-bar">
                            <button type="button" className="cr-lb-x" onClick={close} aria-label="Close">
                                ×
                            </button>
                        </div>
                        <figure className="cr-lb-fig">
                            <img src={current.src} alt={current.alt} decoding="async" />
                            <figcaption>{current.caption}</figcaption>
                        </figure>
                        {shots.length > 1 && (
                            <div className="cr-lb-nav">
                                <button type="button" onClick={() => step(-1)} aria-label="Previous image">←</button>
                                <span className="cm-lbl">
                                    {(active ?? 0) + 1} / {shots.length}
                                </span>
                                <button type="button" onClick={() => step(1)} aria-label="Next image">→</button>
                            </div>
                        )}
                    </div>
                )}
            </dialog>
        </>
    );
}
