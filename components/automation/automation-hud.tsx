"use client";

import { useEffect, useState, type ReactNode } from "react";
import "@/components/brasswork-ui/brass-kit.css";
import "./automation-hud.css";
import type { HudData } from "@/lib/automation/types";
import type { HudActions } from "./types";
import { ResourceStrip } from "./resource-strip";
import { BuildList } from "./build-bar";
import { Inspector } from "./inspector";
import { Milestones, PrestigeCard, Section } from "./factory-sections";
import { ExpeditionList, SettingsList, StatsList } from "./drawers";
import { ResearchScreen } from "./research-screen";
import { PrestigeScreen } from "./prestige-screen";
import "./brasswork-skin.css";
import { canAfford } from "./format";
import { uiIconStyle } from "@/lib/automation/icons/ui";

/** A 24px HUD glyph. Decorative: the text beside it carries the name. */
const Ico = ({ id }: { id: string }) => <span className="ab-ico" style={uiIconStyle(id, 24)} aria-hidden="true" />;

type Drawer = "expedition" | "stats" | "settings";
type Screen = "research" | "prestige";

const DRAWER_ICON: Record<Drawer, string> = { expedition: "expedition", stats: "stats", settings: "settings" };
const DRAWER_TITLE: Record<Drawer, string> = {
  expedition: "Expedition",
  stats: "Production stats",
  settings: "Settings",
};

/**
 * Brasswork's 2D interface, drawn over the 3D workshop.
 * Layout follows the design mock: machine palette on the left, the 3D floor in
 * the centre with the status line along its bottom, and the inspector and
 * milestones on the right. Research and prestige open as full-screen views.
 * `children` is the 3D view slot.
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
  const [screen, setScreen] = useState<Screen | null>(null);
  // Phone only: which panel is open as a bottom sheet over the stage.
  const [sheet, setSheet] = useState<"pal" | "factory" | null>(null);
  // Phone only: the "More" sheet lists the drawers, so the bottom bar stays at four tabs.
  const [more, setMore] = useState(false);
  const mode = data.settings.numberFormat;

  useEffect(() => {
    if (!drawer && !screen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (screen) setScreen(null);
      else setDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, screen]);

  const toggle = (d: Drawer) => setDrawer((cur) => (cur === d ? null : d));
  const selectedId = data.selected?.id ?? null;
  const next = data.nextStep;
  const openMachines = data.machines.filter((m) => m.unlocked).length;

  return (
    <div
      className="ab-root bw"
      data-drawer={drawer ?? "none"}
      data-sheet={sheet ?? "none"}
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
          <button
            type="button"
            className="ab-text-btn ab-primary"
            aria-expanded={screen === "research"}
            onClick={() => setScreen((s) => (s === "research" ? null : "research"))}
          >
            <Ico id="research" />
            Research
          </button>
          {(["expedition", "stats", "settings"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className="ab-text-btn"
              aria-expanded={drawer === d}
              onClick={() => toggle(d)}
            >
              <Ico id={DRAWER_ICON[d]} />
              {DRAWER_TITLE[d]}
            </button>
          ))}
        </nav>
      </header>

      <div className="ab-body">
        <aside className="ab-pal" aria-label="Machines">
          <header className="ab-factory-head">
            <h2 className="ab-h">Machines</h2>
            <span className="ab-dim">{openMachines} open</span>
          </header>
          <BuildList
            machines={data.machines}
            resources={data.resources}
            selectedId={selectedId}
            numberFormat={mode}
            onBuild={actions.onBuild}
            onSelect={actions.onSelect}
          />
        </aside>

        <div className="ab-center">
          <div className="ab-stage">{children}</div>
          <nav className="ab-tabbar" aria-label="Menus">
            <button
              type="button"
              className="ab-tab"
              aria-pressed={sheet === "pal"}
              onClick={() => {
                setMore(false);
                setSheet((c) => (c === "pal" ? null : "pal"));
              }}
            >
              <Ico id="machines" />
              <span className="ab-tab-label">Machines</span>
            </button>
            <button
              type="button"
              className="ab-tab"
              aria-pressed={sheet === "factory"}
              onClick={() => {
                setMore(false);
                setSheet((c) => (c === "factory" ? null : "factory"));
              }}
            >
              <Ico id="milestones" />
              <span className="ab-tab-label">Milestones</span>
            </button>
            <button
              type="button"
              className="ab-tab"
              aria-pressed={screen === "research"}
              onClick={() => {
                setMore(false);
                setScreen((s) => (s === "research" ? null : "research"));
              }}
            >
              <Ico id="research" />
              <span className="ab-tab-label">Research</span>
            </button>
            <button
              type="button"
              className="ab-tab"
              aria-pressed={more}
              onClick={() => {
                setSheet(null);
                setMore((m) => !m);
              }}
            >
              <Ico id="help" />
              <span className="ab-tab-label">More</span>
            </button>
          </nav>
          {more && (
            <div className="ab-more" role="menu" aria-label="More menus">
              {(["expedition", "stats", "settings"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="menuitem"
                  className="ab-more-item"
                  onClick={() => {
                    setMore(false);
                    setDrawer(d);
                  }}
                >
                  <Ico id={DRAWER_ICON[d]} />
                  {DRAWER_TITLE[d]}
                </button>
              ))}
            </div>
          )}
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
        </div>

        <aside className="ab-factory" aria-label="Factory panel">
          {data.selected && (
            <section className="ab-panel ab-inspect-panel" aria-label="Selected machine">
              <Inspector
                detail={data.selected}
                resources={data.resources}
                numberFormat={mode}
                canBuild={canAfford(data.selected.cost, data.resources)}
                onBuild={actions.onBuild}
                onSetRecipe={actions.onSetRecipe}
                onClose={() => actions.onSelect(null)}
              />
            </section>
          )}

          <Section title="Milestones" icon="milestones" meta={`${data.blueprints} blueprints`}>
            <Milestones milestones={data.milestones} />
          </Section>

          <Section title="Prestige" icon="prestige" defaultOpen={false}>
            <PrestigeCard prestige={data.prestige} onOpen={() => setScreen("prestige")} />
          </Section>
        </aside>

        {drawer && (
          <aside className="ab-drawer" role="dialog" aria-label={DRAWER_TITLE[drawer]}>
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
              {drawer === "stats" && <StatsList stats={data.stats} />}
              {drawer === "settings" && (
                <SettingsList settings={data.settings} onChange={actions.onSettings} />
              )}
            </div>
          </aside>
        )}
      </div>

      {screen === "research" && (
        <ResearchScreen
          nodes={data.research}
          blueprints={data.blueprints}
          onResearch={actions.onResearch}
          onClose={() => setScreen(null)}
        />
      )}

      {screen === "prestige" && (
        <PrestigeScreen
          prestige={data.prestige}
          onConfirm={(siteId) => {
            actions.onPrestige?.(siteId);
            setScreen(null);
          }}
          onClose={() => setScreen(null)}
        />
      )}
    </div>
  );
}
