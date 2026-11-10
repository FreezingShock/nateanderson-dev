import {
    Brain,
    Code2,
    Footprints,
    Gamepad2,
    Globe,
    GraduationCap,
    Layers,
    Leaf,
    Palette,
    Settings,
    Users,
    Zap,
    type LucideIcon,
} from "lucide-react";
import type { AboutIconName } from "@/lib/about-data";

// Data stores icon names; this resolves them (plain strings cross the server → client boundary, component functions don't).
export const ABOUT_ICONS: Record<AboutIconName, LucideIcon> = {
    Brain,
    Code2,
    Footprints,
    Gamepad2,
    Globe,
    GraduationCap,
    Layers,
    Leaf,
    Palette,
    Settings,
    Users,
    Zap,
};
