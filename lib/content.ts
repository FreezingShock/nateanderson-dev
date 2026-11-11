// Content now lives in Supabase (public.projects table).
// To add/edit a project: update the row directly, or ask Claude to run the SQL.
// No code change needed for new content — just new rows.

import { supabase } from "@/lib/supabase";

export type ProjectStatus = "active" | "planning" | "idea";

export interface Project {
    slug: string;
    title: string;
    category: string;
    status: ProjectStatus;
    description: string;
    tags: string[];
    href?: string;
}

export const statusLabel: Record<ProjectStatus, string> = {
    active: "In Development",
    planning: "Planning",
    idea: "Coming Soon",
};

export const identity = {
    name: "Nate",
    // Kept separate from `name` rather than folded into one "Nate Anderson"
    // string: tight UI spots (nav bubble, the initial-letter button) use
    // `name` alone, the hero/footer/metadata use both.
    lastName: "Anderson",
    tagline: "Building games, renders, and systems, and headed for a construction management degree.",
};

// Rows in any other section (for example "archived") are hidden from the lists and their detail pages 404.
const VISIBLE_SECTIONS = ["projects", "renovations"];

interface ProjectRow {
    slug: string;
    title: string;
    category: string;
    status: ProjectStatus;
    description: string;
    tags: string[];
    section: "projects" | "renovations";
    sort_order: number;
}

// A list read. `offline` means the fetch failed, which is different from an empty list: the pages show a "feed offline"
// state for it instead of "nothing here yet".
export interface Feed<T> {
    items: T[];
    offline: boolean;
}

async function fetchSection(section: "projects" | "renovations"): Promise<Feed<Project>> {
    const { data, error } = await supabase
        .from("projects")
        .select("slug, title, category, status, description, tags, section, sort_order")
        .eq("section", section)
        .order("sort_order", { ascending: true });

    if (error || !data) {
        console.error(`Failed to fetch "${section}" from Supabase:`, error?.message ?? "no data");
        return { items: [], offline: true };
    }

    return {
        items: (data as ProjectRow[]).map(({ slug, title, category, status, description, tags }) => ({
            slug,
            title,
            category,
            status,
            description,
            tags,
        })),
        offline: false,
    };
}

export function getProjects(): Promise<Feed<Project>> {
    return fetchSection("projects");
}

export function getRecentRenovations(): Promise<Feed<Project>> {
    return fetchSection("renovations");
}

// Per-project detail pages (/creations/[slug]) need the section too, to
// know which accent color and icon to theme the page with.
export interface ProjectWithSection extends Project {
    section: "projects" | "renovations";
}

// `project` is null for a real miss (a 404). `offline` means the read failed, which the page shows as a feed-offline
// state. The two are kept apart so a failed read never reads as "signal lost".
export async function lookupProject(slug: string): Promise<{ project: ProjectWithSection | null; offline: boolean }> {
    const { data, error } = await supabase
        .from("projects")
        .select("slug, title, category, status, description, tags, section")
        .eq("slug", slug)
        .in("section", VISIBLE_SECTIONS)
        .maybeSingle();

    if (error) {
        console.error(`Failed to fetch project "${slug}" from Supabase:`, error.message);
        return { project: null, offline: true };
    }
    return { project: (data as ProjectWithSection | null) ?? null, offline: false };
}

export async function getProjectBySlug(slug: string): Promise<ProjectWithSection | null> {
    return (await lookupProject(slug)).project;
}

export async function getAllProjectSlugs(): Promise<string[]> {
    const { data, error } = await supabase.from("projects").select("slug").in("section", VISIBLE_SECTIONS);
    if (error || !data) {
        if (error) console.error("Failed to fetch project slugs from Supabase:", error.message);
        return [];
    }
    return data.map((row: { slug: string }) => row.slug);
}
