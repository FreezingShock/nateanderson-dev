import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "History of this website";

export default async function Image() {
    return new ImageResponse(
        naosCard({
            label: "history",
            title: "history",
            lead: "This website's own changelog, pulled live from the GitHub API, not written by hand.",
            path: "/history",
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
