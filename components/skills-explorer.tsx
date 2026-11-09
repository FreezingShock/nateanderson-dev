"use client";

import { memo, useMemo, useState } from "react";
import { ArrowDownWideNarrow } from "lucide-react";
import { ABOUT_ICONS } from "@/components/about-icons";
import { FilterChips, type FilterChip } from "@/components/filter-chips";
import { Meter } from "@/components/cm/ui";
import {
    LEVELS,
    SKILL_CATEGORIES,
    skills,
    type Skill,
    type SkillCategory,
} from "@/lib/about-data";

// Skills by domain: filter by category, sort by level, and every card shows
// its description right away (the old version hid it behind hover, which a
// phone doesn't have). Plain CSS cards and no animation library, replacing the
// per-card framer-motion hover/tap springs.

const SkillCard = memo(function SkillCard({ skill }: { skill: Skill }) {
    const Icon = ABOUT_ICONS[skill.icon];
    const { label: catLabel } = SKILL_CATEGORIES[skill.category];
    const level = LEVELS[skill.level - 1];

    return (
        <div className="cm-card" style={{ height: "100%", gap: 8 }}>
            <div className="cm-row" style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 15 }}>{skill.name}</b>
                    <div className="cm-state" style={{ marginTop: 4 }}>{catLabel} / {level.label}</div>
                </div>
                <Icon className="cm-ico" style={{ width: 20, height: 20 }} aria-hidden="true" />
            </div>
            <div className="cm-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                <div style={{ flex: 1 }}>
                    <Meter value={skill.level * 20} tone={skill.level <= 2 ? "warn" : undefined} label={`${level.label}, level ${skill.level} of 5`} />
                </div>
                <span className="cm-num" style={{ fontSize: 11 }}>{skill.level}/5</span>
            </div>
            <p>{skill.description}</p>
        </div>
    );
});

export function SkillsExplorer() {
    const [category, setCategory] = useState<string | null>(null);
    const [byLevel, setByLevel] = useState(false);

    const chips: FilterChip[] = useMemo(
        () =>
            (Object.keys(SKILL_CATEGORIES) as SkillCategory[]).map((key) => ({
                key,
                label: SKILL_CATEGORIES[key].label,
                color: SKILL_CATEGORIES[key].color,
                count: skills.filter((s) => s.category === key).length,
            })),
        []
    );

    const visible = useMemo(() => {
        const list = category
            ? skills.filter((s) => s.category === category)
            : skills;
        return byLevel ? [...list].sort((a, b) => b.level - a.level) : list;
    }, [category, byLevel]);

    return (
        <div style={{ display: "grid", gap: "var(--cm-s4)" }}>
            <div className="cm-row" style={{ justifyContent: "space-between" }}>
                <FilterChips chips={chips} active={category} onChange={setCategory} total={skills.length} />
                <button type="button" className="cm-chip" aria-pressed={byLevel} onClick={() => setByLevel((v) => !v)}>
                    <ArrowDownWideNarrow className="cm-ico" style={{ width: 12, height: 12 }} aria-hidden="true" /> Sort by level
                </button>
            </div>

            {/* Level legend */}
            <p className="cm-row cm-coord" style={{ gap: 14, margin: 0 }}>
                {LEVELS.map((l, i) => (
                    <span key={l.label}>{i + 1} · {l.label}</span>
                ))}
            </p>

            <div className="cm-grid">
                {visible.map((skill) => (
                    <SkillCard key={skill.name} skill={skill} />
                ))}
            </div>
        </div>
    );
}
