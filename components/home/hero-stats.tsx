import { CountUp } from "@/components/cm/reveal";
import { getProjects, getRecentRenovations } from "@/lib/content";

// The three hero counts. Projects and renovations come from Supabase, so this streams behind a Suspense boundary;
// the playable count is computed from local data and passed in. The markup matches the original stats block.
function Stat({ label, value }: { label: string; value: number | null }) {
    return (
        <div>
            <div className="cm-lbl">{label}</div>
            {value === null ? (
                <span className="big none" aria-hidden="true">—</span>
            ) : value > 0 ? (
                <CountUp className="big" value={value} />
            ) : (
                <span className="big none" aria-label="None yet">—</span>
            )}
        </div>
    );
}

export async function HeroStats({ playable }: { playable: number }) {
    const [projects, renovations] = await Promise.all([getProjects(), getRecentRenovations()]);
    return (
        <>
            <Stat label="Projects" value={projects.length} />
            <Stat label="Renovations" value={renovations.length} />
            <Stat label="Playable games" value={playable} />
        </>
    );
}

/** Same three cells while the Supabase counts load; the playable count is already known. */
export function HeroStatsFallback({ playable }: { playable: number }) {
    return (
        <>
            <Stat label="Projects" value={null} />
            <Stat label="Renovations" value={null} />
            <Stat label="Playable games" value={playable} />
        </>
    );
}
