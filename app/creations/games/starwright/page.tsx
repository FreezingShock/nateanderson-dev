import { Starwright } from "@/components/starwright/starwright";
import { gameMetadata } from "@/lib/games/registry";

export const metadata = gameMetadata("starwright");

export default function StarwrightPage() {
    return <Starwright />;
}
