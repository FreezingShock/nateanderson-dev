import { Groundbreak } from "@/components/groundbreak/groundbreak";
import { gbFontClass } from "@/lib/groundbreak-fonts/fonts";
import { gameMetadata } from "@/lib/games/registry";

export const metadata = gameMetadata("groundbreak");

export default function GroundbreakPage() {
    return (
        <div className={gbFontClass}>
            <Groundbreak />
        </div>
    );
}
