import { notFound } from "next/navigation";
import VoxelIslandBench from "@/lib/automation/render/bench";

// Renderer test page. Hidden in production builds unless VOXEL_BENCH=1 is set for a timing run.
export const metadata = { robots: { index: false, follow: false } };

export default function VoxelIslandPage() {
  if (process.env.NODE_ENV === "production" && process.env.VOXEL_BENCH !== "1") notFound();
  return <VoxelIslandBench />;
}
