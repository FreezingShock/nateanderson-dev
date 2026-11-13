import { notFound } from "next/navigation";
import ModelPreview from "@/lib/automation/models/preview";

// Model preview page. Hidden in production builds unless VOXEL_BENCH=1 is set.
export const metadata = { robots: { index: false, follow: false } };

export default function VoxelModelPage() {
    if (
        process.env.NODE_ENV === "production" &&
        process.env.VOXEL_BENCH !== "1"
    )
        notFound();
    return <ModelPreview />;
}
