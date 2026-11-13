import { notFound } from "next/navigation";
import "@/components/brasswork-ui/brass-kit.css";

// Brasswork GUI kit reference. Hidden in production builds unless VOXEL_BENCH=1 is set.
export const metadata = { robots: { index: false, follow: false } };

const Cell = ({ n, children }: { n: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 28 }}>
        <div className="bw-row" style={{ marginBottom: 12 }}><span>{n}</span></div>
        {children}
    </div>
);
const Glyph = ({ c }: { c: string }) => (
    <svg width="32" height="32" viewBox="0 0 8 8" shapeRendering="crispEdges">
        <rect x="1" y="1" width="6" height="6" fill={c} />
        <rect x="1" y="1" width="6" height="2" fill="#fff" fillOpacity=".3" />
        <rect x="1" y="5" width="6" height="2" fill="#000" fillOpacity=".3" />
    </svg>
);

export default function BrassKit() {
    if (process.env.NODE_ENV === "production" && process.env.VOXEL_BENCH !== "1") notFound();
    return (
        <main className="bw" style={{ minHeight: "100vh", padding: 32, background: "radial-gradient(ellipse at 50% 0%, #4a2f1a, #140d08 70%)" }}>
            <h1 style={{ letterSpacing: "0.3em", color: "#d29a3c", fontWeight: 400, marginBottom: 24 }}>BRASSWORK / GUI KIT</h1>
            <div style={{ display: "grid", gap: 28, gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", maxWidth: 1200 }}>
                <div className="bw-frame"><div className="bw-inner">
                    <div className="bw-title">Frame · brass</div>
                    <div className="bw-row"><span>Smelter</span><b>3 / 4 running</b></div>
                    <div className="bw-row"><span>Power</span><b>128 / 160</b></div>
                    <hr className="bw-sep" />
                    <button className="bw-btn">Build</button>{" "}
                    <button className="bw-btn copper">Open workshop</button>
                </div></div>
                <div className="bw-frame iron"><div className="bw-inner">
                    <div className="bw-title">Frame · iron</div>
                    <Cell n="Buttons">
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <button className="bw-btn">Brass</button>
                            <button className="bw-btn iron">Iron</button>
                            <button className="bw-btn is-down">Pressed</button>
                            <button className="bw-btn" disabled>Locked</button>
                            <button className="bw-btn sm">Small</button>
                        </div>
                    </Cell>
                    <Cell n="Dial switch">
                        <div className="bw-dial"><button aria-pressed="true">Orbit</button><button aria-pressed="false">Top</button></div>
                    </Cell>
                </div></div>
                <div className="bw-frame"><div className="bw-inner">
                    <div className="bw-title">Gauges and bars</div>
                    <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
                        <div className="bw-gauge" style={{ ["--v" as string]: 0.25 }}><i /><span>WIND</span></div>
                        <div className="bw-gauge" style={{ ["--v" as string]: 0.8 }}><i /><span>POWER</span></div>
                        <span className="bw-readout">12 BP</span>
                    </div>
                    <div className="bw-bar" style={{ ["--v" as string]: 0.62, marginBottom: 14 }}><i /></div>
                    <div className="bw-bar warn" style={{ ["--v" as string]: 0.2 }}><i /></div>
                </div></div>
                <div className="bw-frame"><div className="bw-inner">
                    <div className="bw-title">Palette slots</div>
                    <div style={{ display: "grid", gap: 10 }}>
                        <button className="bw-slot" aria-pressed="true"><span className="bw-icon sm"><Glyph c="#c4682f" /></span><span><span className="nm">Smelter</span><span className="sub">iron ore → ingot</span></span><span className="amt">x3</span></button>
                        <button className="bw-slot"><span className="bw-icon sm"><Glyph c="#7f8ca3" /></span><span><span className="nm">Press</span><span className="sub">ingot → plate</span></span><span className="amt">x1</span></button>
                        <button className="bw-slot" disabled><span className="bw-icon sm"><Glyph c="#58b09a" /></span><span><span className="nm">Windmill</span><span className="sub">needs Gear cutting</span></span></button>
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 20, alignItems: "end" }}>
                        <span className="bw-icon sm"><Glyph c="#d29a3c" /></span>
                        <span className="bw-icon"><Glyph c="#eed9e4" /></span>
                        <span className="bw-icon lg"><Glyph c="#3f5576" /></span>
                    </div>
                </div></div>
                <div className="bw-frame"><div className="bw-inner">
                    <div className="bw-title">Tooltip</div>
                    <div className="bw-tip"><b>Photocells</b>Costs 8 blueprints. Unlocks the Photocell recipe. Needs Silicon wafers.</div>
                    <div style={{ height: 14 }} />
                </div></div>
            </div>
        </main>
    );
}
