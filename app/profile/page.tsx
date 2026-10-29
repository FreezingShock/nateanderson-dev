import type { Metadata } from "next";
import { ProfileRedirect } from "@/components/profile-route-lazy";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

// Your profile lives at your own link (/u/yourhandle). This address, and /account when you are signed in,
// just take you there, so old links and bookmarks keep working.
export default function ProfilePage() {
    return (
        <div className="pointer-events-auto mx-auto w-full max-w-5xl px-4 pb-24 pt-24">
            <ProfileRedirect />
        </div>
    );
}
