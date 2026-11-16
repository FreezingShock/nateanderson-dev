"use client";

// A number that counts to its new value over about 0.4 s instead of jumping. Used on small leaf readouts only, so the
// per-frame state stays in that one span and never re-renders the game. Reduced motion shows the value at once.
import { useEffect, useRef, useState, type CSSProperties } from "react";

const DUR = 420;

export function Ticked({ value, format, className, style }: { value: number; format: (n: number) => string; className?: string; style?: CSSProperties }) {
  const [shown, setShown] = useState(value);
  // where the next tween starts: the last value actually drawn, so an interrupted tween does not jump back
  const from = useRef(value);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(value) || value === from.current) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / DUR);
      const e = 1 - (1 - k) ** 3;
      const now = k < 1 ? start + (value - start) * e : value;
      from.current = now;
      setShown(now);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <span className={className} style={style}>{format(shown)}</span>;
}
