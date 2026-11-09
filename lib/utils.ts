import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Map project slugs to their accent colors
export function getProjectAccentColor(slug: string): string {
    const colorMap: Record<string, string> = {
        "fractured-islands": "var(--cm-violet)",
        "topanga-willows": "var(--cm-cyan)",
        "blender-studies": "var(--cm-amber)",
    };
    return colorMap[slug] || "var(--cm-amber)";
}
