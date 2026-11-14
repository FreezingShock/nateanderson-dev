"use client";

import { useEffect, useState, type ReactNode } from "react";
import "@/components/brasswork-ui/brass-kit.css";
import "@/components/brasswork-ui/scrollbar.css";
import "./automation-hud.css";
import type { HudData } from "@/lib/automation/types";
import type { HudActions } from "./types";
import { ResourceStrip } from "./resource-strip";
import { BuildList } from "./build-bar";
import { Inspector } from "./inspector";
import { Milestones, PrestigeCard, Section } from "./factory-sections";
import { StatsList } from "./drawers";
import { SettingsWindow, type SettingsSlots } from "./settings-window";
import { ExpeditionWindow } from "./expedition-window";
import { ResearchScreen } from "./research-screen";
import { PrestigeScreen } from "./prestige-screen";
import "./brasswork-skin.css";
import { canAfford } from "./format";
import { uiIconStyle } from "@/lib/automation/icons/ui";

/** A 24px HUD glyph. Decorative: the text beside it carries the name. */
const Ico = ({ id }: { id: string }) => <span className="ab-ico" style={uiIconStyle(id, 24)} aria-hidden="true" />;

type Drawer = "expedition" | "stats" | "settings";
type Screen = "research" | "prestige" | "expedition";

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
  settingsSlots,
}: {
  data: HudData;
  actions: HudActions;
  children?: ReactNode;
  /** Extra Settings rows supplied by the host (lighting, save and leave). */
  settingsSlots?: SettingsSlots;
}) {
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [screen, setScreen] = useState<Screen | null>(null);
  // Site chosen in Expedition, handed to the workshop selection screen.
  const [planSite, setPlanSite] = useState<string | undefined>(undefined);
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

  const toggle = (d: Drawer) => {
    if (d === "expedition") {
      setDrawer(null);
      setScreen((s) => (s === "expedition" ? null : "expedition"));
      return;
    }
    setScreen((s) => (s === "expedition" ? null : s));
    setDrawer((cur) => (cur === d ? null : d));
  };
  // Phone: the inspector lives in the Milestones sheet, so opening a machine's details brings that sheet up.
  const selectedKey = data.selected?.id ?? null;
  useEffect(() => {
    if (selectedKey !== null) setSheet("factory");
  }, [selectedKey]);
  const selectedId = data.selected?.id ?? null;
  const next = data.nextStep;

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
              aria-expanded={d === "expedition" ? screen === "expedition" : drawer === d}
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
          {/* The group panels below carry the visible titles and counts; this heading is for screen readers only. */}
          <h2 className="ab-sr-only">Machines</h2>
          <BuildList
            machines={data.machines}
            resources={data.resources}
            selectedId={selectedId}
            armedId={data.armed ?? null}
            numberFormat={mode}
            onBuild={(id) => {
              // Arming a tool on phone closes the Machines sheet so the player can place straight away.
              const arming = data.armed !== id;
              actions.onBuild(id);
              if (arming) setSheet(null);
            }}
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
              <button
                type="button"
                role="menuitem"
                className="ab-more-item"
                onClick={() => {
                  setMore(false);
                  setPlanSite(undefined);
                  setScreen("prestige");
                }}
              >
                <Ico id="prestige" />
                Prestige
              </button>
              {(["expedition", "stats", "settings"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="menuitem"
                  className="ab-more-item"
                  onClick={() => {
                    setMore(false);
                    if (d === "expedition") setScreen("expedition");
                    else setDrawer(d);
                  }}
                >
                  <Ico id={DRAWER_ICON[d]} />
                  {DRAWER_TITLE[d]}
                </button>
              ))}
            </div>
          )}
          <p className="ab-next" aria-label="Current objective">
            <span className="ab-next-label">{next.title ? "Objective" : "Next"}</span>
            {next.title && <span className="ab-next-title">{next.title}</span>}
            {next.progress !== undefined && (
              <span className="ab-next-bar" role="progressbar" aria-label="Objective progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(next.progress * 100)}>
                <span className="ab-next-fill" style={{ width: `${Math.round(next.progress * 100)}%` }} />
              </span>
            )}
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
            <PrestigeCard prestige={data.prestige} onOpen={() => { setPlanSite(undefined); setScreen("prestige"); }} />
          </Section>
        </aside>

        {drawer && drawer !== "settings" && (
          <aside className="ab-drawer" role="dialog" aria-label={DRAWER_TITLE[drawer]}>
            <header className="ab-head">
              <h2 className="ab-h">
                <Ico id={DRAWER_ICON[drawer]} />
                {DRAWER_TITLE[drawer]}
              </h2>
              <button type="button" className="ab-text-btn" onClick={() => setDrawer(null)}>
                Close
              </button>
            </header>
            <div className="ab-drawer-body">
              {drawer === "stats" && <StatsList stats={data.stats} />}
            </div>
          </aside>
        )}
      </div>

      {drawer === "settings" && (
        <SettingsWindow settings={data.settings} onChange={actions.onSettings} onClose={() => setDrawer(null)} slots={settingsSlots} />
      )}

      {screen === "research" && (
        <ResearchScreen
          nodes={data.research}
          blueprints={data.blueprints}
          onResearch={actions.onResearch}
          onClose={() => setScreen(null)}
        />
      )}

      {screen === "expedition" && (
        <ExpeditionWindow
          areas={data.areas}
          prestige={data.prestige}
          onPlan={(id) => {
            actions.onSelectArea?.(id);
            setPlanSite(id);
            setScreen("prestige");
          }}
          onClose={() => setScreen(null)}
        />
      )}

      {screen === "prestige" && (
        <PrestigeScreen
          initialSiteId={planSite}
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
