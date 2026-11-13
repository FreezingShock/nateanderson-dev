import { BrassworkHost } from "@/components/brasswork/brasswork-host";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
    title: "Brasswork",
    description: "A 3D automation game in development: a clockwork workshop on a voxel island.",
    path: "/creations/games/brasswork",
    image: "/creations/opengraph-image",
});

export default function BrassworkPage() {
    return <BrassworkHost />;
}
