import type { Metadata } from "next";
import { FooterOptionA } from "@/components/footer/option-a";
import { FooterOptionB } from "@/components/footer/option-b";
import { FooterOptionC } from "@/components/footer/option-c";

// Review page for the footer options. Behind the site password like every route. Removed once one option is picked.
export const metadata: Metadata = {
    title: "Footer options",
    robots: { index: false, follow: false },
};

const OPTIONS = [
    { key: "A", name: "Signal deck", note: "Live signal graph, pillar spec row, icon directory", Comp: FooterOptionA },
    { key: "B", name: "ID card", note: "Homepage Status card as the footer, directory beside it", Comp: FooterOptionB },
    { key: "C", name: "Live readout", note: "Full-width telemetry graph, stat tiles from the About page", Comp: FooterOptionC },
] as const;

export default function FooterLabPage() {
    return (
        <div className="ctos fl-lab">
            {OPTIONS.map(({ key, name, note, Comp }) => (
                <section key={key} aria-label={`Option ${key}`}>
                    <div className="fl-tag">
                        <b>Option {key}</b>
                        <span>{name}</span>
                        <em>{note}</em>
                    </div>
                    <Comp />
                </section>
            ))}
        </div>
    );
}
