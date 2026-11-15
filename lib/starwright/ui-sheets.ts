// The art thread's PNG sheets (public/starwright/manifest.json). The GUI prefers a sheet when the manifest lists it and falls
// back to the stand-in drawn in ui-art.ts otherwise. Client only.
import { fetchManifest } from "./manifest";
interface Sheet { src: string; w: number; h: number; frames: number; fps: number }
let sheets: Record<string, Sheet> | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadSheets(): Promise<void> {
    if (!pending) {
        pending = fetchManifest()
            .then((m0) => {
                const m = m0 as { sheets?: Record<string, Sheet>; v?: number } | null;
                if (m?.sheets) {
                    const v = m.v ?? 1;
                    sheets = Object.fromEntries(Object.entries(m.sheets).map(([k, s]) => [k, { ...s, src: `${s.src}?v=${v}` }]));
                }
                listeners.forEach((f) => f());
            })
            .catch(() => undefined);
    }
    return pending;
}
/** The sheet's URL, or null when it is not in the manifest (yet). */
export const sheetUrl = (id: string): string | null => sheets?.[id]?.src ?? null;
export const sheetInfo = (id: string): Sheet | null => sheets?.[id] ?? null;
export const onSheets = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
