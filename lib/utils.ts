import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Map project slugs to their accent colors
export function getProjectAccentColor(slug: string): string {
    const colorMap: Record<string, string> = {
    };
    return colorMap[slug] || "var(--cm-amber)";
}
