"use client";

import { useRef, type ReactNode } from "react";

/**
 * Render gate for parts of the board that nobody can see or read closely.
 * The game state is one mutable object and the page re-renders ten times a second, so every component under it re-renders
 * too. While `live` is false this keeps returning the last element it was given (React skips an unchanged element
 * entirely) until `k` changes. Pass `live` for "on screen right now" and a coarse `k` (a slow tick plus whatever the
 * user just did) for how often the hidden copy may refresh. When `live` flips back to true it renders fresh on that same pass.
 */
export function Hold({ live, k, children }: { live: boolean; k: string | number; children: ReactNode }) {
    const keep = useRef<{ k: string | number; c: ReactNode } | null>(null);
    if (!keep.current || live || keep.current.k !== k) keep.current = { k, c: children };
    return <>{keep.current.c}</>;
}
