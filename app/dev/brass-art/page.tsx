import { notFound } from "next/navigation";
import "@/components/brasswork-ui/brass-kit.css";
import { MilestoneArt, QuestCard, ResearchArt, SitePainting, ArtDivider, ArtGauge, ArtPanel, EmptyState, MachinePortrait, PanelTitle, RARITY_FRAMES, rarityOf } from "@/components/brasswork-art";
import { MILESTONE_ART, PORTRAITS, RESEARCH_ART, SITE_ART } from "@/lib/automation/art";

// Brasswork menu art reference. Hidden in production builds unless VOXEL_BENCH=1 is set.
export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
    if (process.env.NODE_ENV === "production" && process.env.VOXEL_BENCH !== "1") notFound();
    const ids = Object.keys(PORTRAITS);
    return (
        <main className="bw bw-root" style={{ background: "#1e140b", minHeight: "100vh", padding: 32 }}>
            <PanelTitle>Machines</PanelTitle>
            <ArtDivider />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 40, padding: 16 }}>
                {ids.map((id) => {
                    const r = rarityOf(id);
                    return (
                        <ArtPanel key={id} rarity={r}>
                            <div style={{ display: "grid", justifyItems: "center", gap: 6, padding: 4 }}>
                                <MachinePortrait id={id} label={id} />
                                <strong style={{ textTransform: "capitalize" }}>{id.replace("_", " ")}</strong>
                                <small style={{ opacity: 0.75 }}>{RARITY_FRAMES[r].label}</small>
                            </div>
                        </ArtPanel>
                    );
                })}
            </div>
            <ArtDivider />
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                <ArtGauge value={0.2} label="Charge" /><ArtGauge value={0.65} size={96} label="Wind" />
                <EmptyState scene="crate">Nothing in storage yet</EmptyState>
                <EmptyState scene="blueprint">No research ready</EmptyState>
                <EmptyState scene="idle">This machine is idle</EmptyState>
            </div>
            <ArtDivider />
            <PanelTitle>Milestones</PanelTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>{Object.keys(MILESTONE_ART).map((id) => <MilestoneArt key={id} id={id} label={id} />)}</div>
            <PanelTitle>Research</PanelTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{Object.keys(RESEARCH_ART).map((id) => <ResearchArt key={id} id={id} label={id} />)}</div>
            <PanelTitle>New workshop</PanelTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>{Object.keys(SITE_ART).map((id) => <SitePainting key={id} id={id} width={200} label={id} />)}</div>
            <div style={{ maxWidth: 320, marginTop: 40 }}>
                <QuestCard><strong>Deliver 50 iron ingots</strong><p style={{ margin: "6px 0 0" }}>Fill the first smelt run crate at the hub.</p></QuestCard>
            </div>
        </main>
    );
}
