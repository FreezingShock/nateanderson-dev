import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Creations by Nate Anderson";

export default async function Image() {
    return new ImageResponse(
        naosCard({
            label: "creations",
            title: "creations",
            lead: "Games you can play here, coding projects, renovation studies of real places, and the artwork around it all.",
            path: "/creations",
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
