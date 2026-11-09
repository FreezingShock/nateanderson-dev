import { ImageResponse } from "next/og";
import { identity } from "@/lib/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Nate Anderson, portfolio";

// Camino card: near-black ground, hairline frame, paper plate, one cyan bar.
export default async function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "72px 84px",
                    background: "#040506",
                    color: "#e9eff1",
                    fontFamily: "sans-serif",
                    border: "1px solid #2b3236",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <svg width="56" height="56" viewBox="0 0 24 24">
                        <rect x="2" y="3" width="4.5" height="18" fill="#f2f3f1" />
                        <rect x="17.5" y="3" width="4.5" height="18" fill="#f2f3f1" />
                        <polygon points="6.5,3 11.5,3 17.5,21 12.5,21" fill="#2fd8e8" />
                    </svg>
                    <div style={{ fontSize: 24, letterSpacing: 7, textTransform: "uppercase", color: "#8a99a3" }}>
                        Portfolio / nateanderson.dev
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginTop: 44 }}>
                    <div style={{ display: "flex", fontSize: 92, fontWeight: 700, background: "#050607", color: "#f2f3f1", padding: "4px 24px 14px", letterSpacing: -3 }}>
                        {identity.name} {identity.lastName}
                    </div>
                    <div style={{ display: "flex", fontSize: 52, fontWeight: 700, background: "#2fd8e8", color: "#031417", padding: "4px 24px 12px", marginTop: 8, letterSpacing: -1.5 }}>
                        games, renders, systems.
                    </div>
                </div>
                <div style={{ display: "flex", fontSize: 28, marginTop: 40, color: "#8a99a3", maxWidth: 940 }}>
                    {identity.tagline}
                </div>
            </div>
        ),
        { ...size }
    );
}
