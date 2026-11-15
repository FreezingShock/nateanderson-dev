import { notFound } from "next/navigation";
import Preview from "@/components/groundbreak-art/preview";

// Groundbreak art preview: /dev/groundbreak-art?job=clinic&frac=0.6&z=1&built=house,deck
// Hidden in production builds unless VOXEL_BENCH=1 is set.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default function GroundbreakArtPage() {
    if (process.env.NODE_ENV === "production" && process.env.VOXEL_BENCH !== "1") notFound();
    return <Preview />;
}
