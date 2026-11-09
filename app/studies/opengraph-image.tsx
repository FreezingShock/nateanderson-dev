import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Studies by Nate Anderson";

export default async function Image() {
    return new ImageResponse(
        naosCard({
            label: "studies",
            title: "studies",
            lead: "The pathway from this year's classes to a university specialization, plus the independent research running alongside it.",
            path: "/studies",
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
