import { ImageResponse } from "next/og";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Timeline of Nate Anderson's plans";

export default async function Image() {
    return new ImageResponse(
        naosCard({
            label: "timeline",
            title: "timeline",
            lead: "The pathway from senior year to graduation in 2031, with real dates, live countdowns and every milestone in between.",
            path: "/timeline",
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
