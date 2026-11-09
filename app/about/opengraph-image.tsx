import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "About Nate Anderson";

export default async function Image() {
    return new ImageResponse(
        naosCard({
            label: "about",
            title: "about",
            lead: "Student, runner and Roblox developer. Designs game systems, models real places in 3D, and is heading into construction management.",
            path: "/about",
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
