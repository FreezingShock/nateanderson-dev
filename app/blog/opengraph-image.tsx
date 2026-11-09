import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Blog by Nate Anderson";

export default async function Image() {
    return new ImageResponse(
        naosCard({
            label: "blog",
            title: "blog",
            lead: "Notes on systems design, game dev, philosophy, and whatever else is worth writing down.",
            path: "/blog",
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
