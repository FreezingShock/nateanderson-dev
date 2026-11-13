"use client";

import { useEffect, useState, type ReactNode } from "react";
import "./automation-hud.css";
import type { HudActions, HudData } from "./types";
import { ResourceStrip } from "./resource-strip";
import { BuildList } from "./build-bar";
import { Inspector } from "./inspector";
import { Milestones, PrestigeCard, Section } from "./factory-sections";
import { ExpeditionList, ResearchTree, SettingsList, StatsList } from "./drawers";
import { canAfford } from "./format";

type Drawer = "expedition" | "research" | "stats" | "settings";

const DRAWER_TITLE: Record<Drawer, string> = {
  expedition: "Expedition",
  research: "Research",
  stats: "Production stats",
  settings: "Settings",
};

/**
 * Brasswork's 2D interface, drawn over the 3D workshop.
 * `children` is the stage slot for the 3D view. Everything else is props-driven.
 */
export function AutomationHud({
  data,
  actions,
  children,
}: {
  data: HudData;
  actions: HudActions;
  children?: ReactNode;
}) {
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const mode = data.settings.numberFormat;

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const toggle = (d: Drawer) => setDrawer((cur) => (cur === d ? null : d));
  const selectedId = data.selected?.id ?? null;
  const next = data.nextStep;

  return (
    <div
      className="ab-root"
      data-drawer={drawer ?? "none"}
      data-inspect={data.selected ? "on" : "off"}
      data-lowfx={data.settings.lowFx}
      data-reduce={data.settings.reduceMotion}
    >
      <header className="ab-top">
        <div className="ab-brand">
          <span className="ab-brand-name">Brasswork</span>
          <span className="ab-dim">workshop</span>
        </div>
        <ResourceStrip
          resources={data.resources}
          showRates={data.settings.showRates}
          numberFormat={mode}
        />
        <nav className="ab-nav" aria-label="Workshop views">
          {(["expedition", "research", "stats", "settings"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className="ab-text-btn"
              aria-expanded={drawer === d}
              onClick={() => toggle(d)}
            >
              {DRAWER_TITLE[d]}
            </button>
          ))}
        </nav>
      </header>

      <p className="ab-next">
        <span className="ab-next-label">Next</span>
        <span className="ab-next-text">{next.text}</span>
        {next.actionId && next.actionLabel && (
          <button
            type="button"
            className="ab-text-btn"
            onClick={() => {
              const id = next.actionId!;
              if (actions.onNextStep) actions.onNextStep(id);
              else actions.onSelect(id);
            }}
          >
            {next.actionLabel}
          </button>
        )}
      </p>

      <div className="ab-body">
      <div className="ab-stage">{children}</div>

      <aside className="ab-factory" aria-label="Factory panel">
        <header className="ab-factory-head">
          <h2 className="ab-h">Factory</h2>
          <span className="ab-dim">{data.machines.filter((m) => m.unlocked).length} machines open</span>
        </header>

        {data.selected && (
          <Inspector
            detail={data.selected}
            resources={data.resources}
            numberFormat={mode}
            canBuild={canAfford(data.selected.cost, data.resources)}
            onBuild={actions.onBuild}
            onClose={() => actions.onSelect(null)}
          />
        )}

        <Section title="Build" meta="tap a row to build">
          <BuildList
            machines={data.machines}
            resources={data.resources}
            selectedId={selectedId}
            numberFormat={mode}
            onBuild={actions.onBuild}
            onSelect={actions.onSelect}
          />
        </Section>

        <Section title="Milestones" meta={`${data.blueprints} blueprints`}>
          <Milestones milestones={data.milestones} />
        </Section>

        <Section title="Prestige" defaultOpen={false}>
          <PrestigeCard prestige={data.prestige} onPrestige={actions.onPrestige} />
        </Section>
      </aside>

      {drawer && (
        <aside
          className="ab-drawer"
          role="dialog"
          aria-label={DRAWER_TITLE[drawer]}
        >
          <header className="ab-head">
            <h2 className="ab-h">{DRAWER_TITLE[drawer]}</h2>
            <button type="button" className="ab-text-btn" onClick={() => setDrawer(null)}>
              Close
            </button>
          </header>
          <div className="ab-drawer-body">
            {drawer === "expedition" && (
              <ExpeditionList areas={data.areas} onSelectArea={actions.onSelectArea} />
            )}
            {drawer === "research" && (
              <ResearchTree
                nodes={data.research}
                blueprints={data.blueprints}
                onResearch={actions.onResearch}
              />
            )}
            {drawer === "stats" && <StatsList stats={data.stats} />}
            {drawer === "settings" && (
              <SettingsList settings={data.settings} onChange={actions.onSettings} />
            )}
          </div>
        </aside>
      )}
      </div>
    </div>
  );
}
