import { ImageResponse } from "next/og";
import { getAllProjectSlugs, getProjectBySlug } from "@/lib/content";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Creation by Nate Anderson";

/** Cut at a word boundary so the lead never ends mid-word. */
function clip(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.lastIndexOf(" ", max - 1);
    return `${text.slice(0, cut > 0 ? cut : max).trimEnd()}…`;
}

export async function generateStaticParams() {
    const slugs = await getAllProjectSlugs();
    return slugs.map((slug) => ({ slug }));
}

export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    const title = project?.title ?? "Creation";
    const lead = project?.description ?? "";
    return new ImageResponse(
        naosCard({
            label: "creations",
            title,
            lead: clip(lead, 170),
            path: `/creations/${slug}`,
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
