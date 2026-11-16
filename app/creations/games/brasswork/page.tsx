import { BrassworkHost } from "@/components/brasswork/brasswork-host";
import { gameMetadata } from "@/lib/games/registry";

export const metadata = gameMetadata("brasswork");

export default function BrassworkPage() {
    return <BrassworkHost />;
}
