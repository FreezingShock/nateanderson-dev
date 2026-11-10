import { px, type PixelComponent } from "@/components/cm/pixel-icons";
import type { TimelineIconName } from "@/lib/timeline-data";

// Data files store icon NAMES (plain strings survive the server → client
// boundary; component functions don't), and this resolves them. Typed as a
// full Record so adding a name to TimelineIconName without an icon here is a
// compile error, not a runtime crash. The art lives in components/cm/pixel-icons.tsx.
export const TIMELINE_ICONS: Record<TimelineIconName, PixelComponent> = {
    Award: px("award"),
    BookOpen: px("book"),
    Brain: px("brain"),
    Briefcase: px("briefcase"),
    CalendarCheck: px("calendarCheck"),
    CheckCircle: px("checkCircle"),
    Code2: px("code"),
    Compass: px("compass"),
    Flag: px("flag"),
    Footprints: px("footprints"),
    GraduationCap: px("studies"),
    Leaf: px("leaf"),
    Lightbulb: px("bulb"),
    Mountain: px("mountain"),
    Palette: px("palette"),
    PenLine: px("pen"),
    Rocket: px("rocket"),
    Send: px("send"),
    Smartphone: px("phone"),
    Sun: px("sun"),
    Target: px("target"),
    Trophy: px("trophy"),
    Users: px("users"),
    Zap: px("zap"),
};
