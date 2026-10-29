"use client";

import dynamic from "next/dynamic";

// The profile views import the whole Fractured Idle lib, whose modules form import cycles that throw
// ("Cannot access ... before initialization") when evaluated on the server. Client-only avoids that.
export const ProfileRedirect = dynamic(() => import("@/components/profile-route").then((m) => m.ProfileRedirect), { ssr: false });
export const ProfileRoute = dynamic(() => import("@/components/profile-route").then((m) => m.ProfileRoute), { ssr: false });
