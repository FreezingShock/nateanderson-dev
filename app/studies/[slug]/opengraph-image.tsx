import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { courseBySlug, courses } from "@/lib/studies-data";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Class by Nate Anderson";

export function generateStaticParams() {
    return courses.map((c) => ({ slug: c.slug }));
}

export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const course = courseBySlug[slug];
    if (!course) notFound();
    return new ImageResponse(
        naosCard({
            label: "studies",
            title: course.title,
            lead: course.description,
            path: `/studies/${slug}`,
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
