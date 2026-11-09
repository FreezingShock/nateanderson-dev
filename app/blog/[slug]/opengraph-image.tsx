import { ImageResponse } from "next/og";
import { getPost, getPostRoutes } from "@/lib/blog";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Post by Nate Anderson";

export function generateStaticParams() {
    return getPostRoutes().map((r) => ({ slug: r.slug }));
}

export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = getPost(slug)?.post;
    return new ImageResponse(
        naosCard({
            label: "blog",
            title: post?.title ?? "Blog",
            lead: post?.excerpt,
            path: `/blog/${slug}`,
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
