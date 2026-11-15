"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "@/components/brasswork-ui/brass-kit.css";
import "@/components/brasswork-ui/scrollbar.css";
import "./automation-hud.css";
import type { HudData } from "@/lib/automation/types";
import type { HudActions } from "./types";
import { ResourceStrip } from "./resource-strip";
import { BuildList, GROUP_ICON, GROUP_TITLE, type GroupId } from "./build-bar";
import { Inspector } from "./inspector";
import { Milestones, PrestigeCard, Section } from "./factory-sections";
import { MenuWindow } from "@/components/brasswork-ui/window";
import { SettingsWindow, type SettingsSlots } from "./settings-window";
import { ProductionWindow } from "./production-window";
import { ExpeditionWindow } from "./expedition-window";
import { ResearchScreen } from "./research-screen";
import { PrestigeScreen } from "./prestige-screen";
import "./brasswork-skin.css";
import "./desktop-stage.css";
import { canAfford } from "./format";
import { uiIconStyle } from "@/lib/automation/icons/ui";

/** A 24px HUD glyph. Decorative: the text beside it carries the name. */
const Ico = ({ id }: { id: string }) => <span className="ab-ico" style={uiIconStyle(id, 24)} aria-hidden="true" />;

/** Pixel glyphs for the build dock, drawn in brass. Each group has its own shape; colour follows the button. */
const DOCK_GLYPH: Record<GroupId, ReactNode> = {
  machines: (
    <>
      <rect x="6.5" y="0.5" width="3" height="3" />
      <rect x="6.5" y="12.5" width="3" height="3" />
      <rect x="0.5" y="6.5" width="3" height="3" />
      <rect x="12.5" y="6.5" width="3" height="3" />
      <rect x="2.5" y="2.5" width="2" height="2" />
      <rect x="11.5" y="2.5" width="2" height="2" />
      <rect x="2.5" y="11.5" width="2" height="2" />
      <rect x="11.5" y="11.5" width="2" height="2" />
      <rect x="3.5" y="3.5" width="9" height="9" />
      <rect x="6" y="6" width="4" height="4" fill="#20170c" />
    </>
  ),
  logistics: (
    <>
      <rect x="1" y="5" width="14" height="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="2" y="4" width="2" height="2" />
      <rect x="12" y="4" width="2" height="2" />
      <rect x="2" y="10" width="2" height="2" />
      <rect x="12" y="10" width="2" height="2" />
      <path d="M6 6 L10 8 L6 10 Z" />
    </>
  ),
  power: <path d="M9.5 0.5 L3 9 L7.5 9 L6 15.5 L13 6.5 L8.5 6.5 L10.5 0.5 Z" />,
};
const DockGlyph = ({ group }: { group: GroupId }) => (
  <svg className="ab-dock-glyph" viewBox="0 0 16 16" width="26" height="26" aria-hidden="true" shapeRendering="crispEdges" fill="currentColor">
    {DOCK_GLYPH[group]}
  </svg>
);

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
  removeSlot,
}: {
  data: HudData;
  actions: HudActions;
  children?: ReactNode;
  /** Extra Settings rows supplied by the host (lighting, save and leave). */
  settingsSlots?: SettingsSlots;
  /** Desktop dock foot: the Remove tool button, shown at the bottom of the left dock. */
  removeSlot?: ReactNode;
}) {
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [screen, setScreen] = useState<Screen | null>(null);
  // Site chosen in Expedition, handed to the workshop selection screen.
  const [planSite, setPlanSite] = useState<string | undefined>(undefined);
  // Phone only: which panel is open as a bottom sheet over the stage.
  const [sheet, setSheet] = useState<"pal" | "factory" | null>(null);
  // Phone only: the "More" sheet lists the drawers, so the bottom bar stays at four tabs.
  const [more, setMore] = useState(false);
  // Desktop: one build group flyout from the left dock, and the Milestones window from the right dock.
  const [palGroup, setPalGroup] = useState<GroupId | null>(null);
  // The section that is closing. It plays its exit while the newly chosen section plays its entrance.
  const [palLeaving, setPalLeaving] = useState<GroupId | null>(null);
  const leaveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current); }, []);
  const leavePal = (from: GroupId) => {
    setPalLeaving(from);
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => { setPalLeaving(null); leaveTimer.current = null; }, 170);
  };
  // One section at a time: choosing another section closes the open one with its exit animation.
  const choosePal = (g: GroupId) => {
    if (palGroup === g) { leavePal(g); setPalGroup(null); return; }
    if (palGroup) leavePal(palGroup);
    setPalGroup(g);
  };
  const closePal = () => {
    if (!palGroup) return;
    leavePal(palGroup);
    setPalGroup(null);
  };
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const mode = data.settings.numberFormat;

  useEffect(() => {
    if (!drawer && !screen && !palGroup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Screens and windows (drawers included) handle Escape themselves, so their exit animation can play.
      // Only the build flyout is closed here.
      if (screen || drawer) return;
      closePal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // closePal reads the current section; re-subscribe whenever it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer, screen, palGroup]);

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
      data-palgroup={palGroup ?? "none"}
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
        {/* Desktop only: a slim left dock. One click opens that group as a flyout, so the resting screen stays mostly island. */}
        <nav className="ab-dock ab-dock-left" aria-label="Build groups">
          {(["logistics", "machines", "power"] as const).map((g) => {
            const open = data.machines.filter((m) => (m.group ?? "machines") === g && m.unlocked).length;
            const armedHere = data.armed != null && data.machines.some((m) => m.id === data.armed && (m.group ?? "machines") === g);
            return (
              <button
                key={g}
                type="button"
                className="ab-dock-btn"
                aria-pressed={palGroup === g}
                aria-label={`${GROUP_TITLE[g]}, ${open} open`}
                data-armed={armedHere}
                onClick={() => choosePal(g)}
              >
                <DockGlyph group={g} />
                <span className="ab-dock-label">{GROUP_TITLE[g]}</span>
              </button>
            );
          })}
          {data.armed && (
            <span className="ab-dock-rot" aria-label={`Turn ${data.rotation ?? 0} degrees, press R to turn`}>
              <span className="ab-dock-rot-k">Turn · R</span>
              <span className="ab-dock-rot-v">{data.rotation ?? 0}°</span>
            </span>
          )}
          {removeSlot && <div className="ab-dock-foot">{removeSlot}</div>}
        </nav>

        <aside className="ab-pal" key={palGroup ?? "none"} aria-label="Machines">
          {/* The group panels below carry the visible titles and counts; this heading is for screen readers only. */}
          <h2 className="ab-sr-only">Machines</h2>
          <BuildList
            machines={data.machines}
            resources={data.resources}
            selectedId={selectedId}
            armedId={data.armed ?? null}
            group={palGroup}
            numberFormat={mode}
            onBuild={(id) => {
              // Arming a tool closes the palette so the player can place straight away (phone: the sheet; desktop: the flyout).
              const arming = data.armed !== id;
              actions.onBuild(id);
              if (arming) { setSheet(null); closePal(); }
            }}
            onSelect={actions.onSelect}
          />
        </aside>
        {/* Desktop only: the section that just closed plays its exit. It is inert, so it takes no input. */}
        {palLeaving && (
          <aside className="ab-pal ab-pal-leaving" aria-hidden="true" inert>
            <BuildList
              machines={data.machines}
              resources={data.resources}
              selectedId={null}
              group={palLeaving}
              numberFormat={mode}
              onBuild={() => {}}
              onSelect={() => {}}
            />
          </aside>
        )}

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

        {/* Desktop only: a slim right dock. Milestones opens as a window; the selected machine's inspector floats here. */}
        <nav className="ab-dock ab-dock-right" aria-label="Workshop goals">
          <button
            type="button"
            className="ab-dock-btn"
            aria-pressed={milestonesOpen}
            aria-label={`Milestones, ${data.blueprints} blueprints`}
            onClick={() => setMilestonesOpen((o) => !o)}
          >
            <Ico id="milestones" />
            <span className="ab-dock-label">Milestones</span>
          </button>
        </nav>

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

          {/* Phone shows these in the Milestones sheet. On desktop they live in the Goals window instead. */}
          <div className="ab-factory-meta">
            <Section title="Milestones" icon="milestones" meta={`${data.blueprints} blueprints`}>
              <Milestones milestones={data.milestones} />
            </Section>

            <Section title="Prestige" icon="prestige" defaultOpen={false}>
              <PrestigeCard prestige={data.prestige} onOpen={() => { setPlanSite(undefined); setScreen("prestige"); }} />
            </Section>
          </div>
        </aside>

        {drawer === "stats" && (
          <ProductionWindow resources={data.resources} stats={data.stats} numberFormat={mode} onClose={() => setDrawer(null)} />
        )}
      </div>

      {drawer === "settings" && (
        <SettingsWindow settings={data.settings} onChange={actions.onSettings} onClose={() => setDrawer(null)} slots={settingsSlots} />
      )}

      {milestonesOpen && (
        <MenuWindow
          title="Milestones"
          label="Milestones and prestige"
          size="wide"
          art={<Ico id="milestones" />}
          onClose={() => setMilestonesOpen(false)}
        >
          <p className="ab-dim">{data.blueprints} blueprints</p>
          <Milestones milestones={data.milestones} />
          <Section title="Prestige" icon="prestige" defaultOpen={false}>
            <PrestigeCard prestige={data.prestige} onOpen={() => { setMilestonesOpen(false); setPlanSite(undefined); setScreen("prestige"); }} />
          </Section>
        </MenuWindow>
      )}

      {screen === "research" && (
        <ResearchScreen
          nodes={data.research}
          blueprints={data.blueprints}
          milestones={data.milestones}
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
