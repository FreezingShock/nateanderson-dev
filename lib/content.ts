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

async function fetchSection(section: "projects" | "renovations"): Promise<Project[]> {
    const { data, error } = await supabase
        .from("projects")
        .select("slug, title, category, status, description, tags, section, sort_order")
        .eq("section", section)
        .order("sort_order", { ascending: true });

    if (error) {
        console.error(`Failed to fetch "${section}" from Supabase:`, error.message);
        return [];
    }

    return (data as ProjectRow[]).map(
        ({ slug, title, category, status, description, tags }) => ({
            slug,
            title,
            category,
            status,
            description,
            tags,
        })
    );
}

export function getProjects() {
    return fetchSection("projects");
}

export function getRecentRenovations() {
    return fetchSection("renovations");
}

// Per-project detail pages (/creations/[slug]) need the section too, to
// know which accent color and icon to theme the page with.
export interface ProjectWithSection extends Project {
    section: "projects" | "renovations";
}

export async function getProjectBySlug(slug: string): Promise<ProjectWithSection | null> {
    const { data, error } = await supabase
        .from("projects")
        .select("slug, title, category, status, description, tags, section")
        .eq("slug", slug)
        .maybeSingle();

    if (error || !data) {
        if (error) console.error(`Failed to fetch project "${slug}" from Supabase:`, error.message);
        return null;
    }

    return data as ProjectWithSection;
}

export async function getAllProjectSlugs(): Promise<string[]> {
    const { data, error } = await supabase.from("projects").select("slug");
    if (error || !data) {
        if (error) console.error("Failed to fetch project slugs from Supabase:", error.message);
        return [];
    }
    return data.map((row: { slug: string }) => row.slug);
}
