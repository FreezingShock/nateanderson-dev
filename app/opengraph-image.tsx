import { ImageResponse } from "next/og";
import { identity } from "@/lib/content";
import { OG_CONTENT_TYPE, OG_SIZE, naosCard, naosFonts } from "@/lib/og/card";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Nate Anderson, portfolio";

export default async function OpengraphImage() {
    return new ImageResponse(
        naosCard({
            label: "portfolio",
            title: `${identity.name} ${identity.lastName}`.toLowerCase(),
            subtitle: "games, renders, systems.",
            lead: identity.tagline,
            path: "/",
        }),
        { ...OG_SIZE, fonts: await naosFonts() }
    );
}
