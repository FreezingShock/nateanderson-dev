import { px, type PixelComponent } from "@/components/cm/pixel-icons";
import type { AboutIconName } from "@/lib/about-data";

// Data stores icon names; this resolves them (plain strings cross the server → client boundary, component functions don't).
export const ABOUT_ICONS: Record<AboutIconName, PixelComponent> = {
    Brain: px("brain"),
    Code2: px("code"),
    Footprints: px("footprints"),
    Gamepad2: px("gamepad"),
    Globe: px("globe"),
    GraduationCap: px("studies"),
    Layers: px("layers"),
    Leaf: px("leaf"),
    Palette: px("palette"),
    Settings: px("settings"),
    Users: px("users"),
    Zap: px("zap"),
};
