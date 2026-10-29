import type { Metadata } from "next";
import { ProfileRoute } from "@/components/profile-route-lazy";
import type { PublicData } from "@/components/public-profile";
import { anon } from "@/lib/account/server";

// A profile, opened by handle or id. Visitors get it only if the owner shares it (the database function returns
// nothing otherwise); the owner always gets their own page, with the editing tools, decided in the browser from
// their session. Either way the page is never cached.
export const dynamic = "force-dynamic";

async function load(key: string): Promise<PublicData | null> {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(key)) return null;
    const { data } = await anon().rpc("get_public_profile", { p_key: key });
    return (data as PublicData | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
    const p = await load((await params).key);
    return { title: p ? `${p.name} · Profile` : "Profile", robots: { index: false } };
}

export default async function ProfilePage({ params }: { params: Promise<{ key: string }> }) {
    const key = (await params).key;
    const p = await load(key);
    return (
        <div className="pointer-events-auto mx-auto w-full max-w-5xl px-4 pb-24 pt-24">
            <ProfileRoute keyParam={key} initial={p} />
        </div>
    );
}
