"use client";
import { UiArtIcon } from "@/components/brasswork-art/icons";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "@/components/brasswork-ui/brass-kit.css";
import "@/components/brasswork-ui/scrollbar.css";
import "./automation-hud.css";
import type { HudData, MachineDetail } from "@/lib/automation/types";
import type { HudActions } from "./types";
import { ResourceStrip } from "./resource-strip";
import { BuildList, GROUP_ICON, GROUP_TITLE, type GroupId } from "./build-bar";
import { Inspector } from "./inspector";
import { Milestones, PrestigeCard, Section } from "./factory-sections";
import { MenuWindow } from "@/components/brasswork-ui/window";
import { MilestonesPanel } from "./milestones-window";
import { SettingsWindow, type SettingsSlots } from "./settings-window";
import { ProductionWindow } from "./production-window";
import { ExpeditionWindow } from "./expedition-window";
import { ResearchScreen } from "./research-screen";
import { PrestigeScreen } from "./prestige-screen";
import { HubMenu, HubToast, HUB_OPEN_EVENT, openHubMenu } from "./hub-menu";
import "./brasswork-skin.css";
import "./desktop-stage.css";
import "./phone-menu-art.css";
import "./top-bar.css";
import { canAfford } from "./format";
import { uiIconStyle } from "@/lib/automation/icons/ui";
import { QuestScroll, type QuestState } from "@/components/brasswork/first-run";

/** A 24px HUD glyph. Decorative: the text beside it carries the name. */
const Ico = ({ id }: { id: string }) => <span className="ab-ico" style={uiIconStyle(id, 24)} aria-hidden="true" />;

/** Pixel glyphs for the build dock, drawn in brass. Each group has its own shape; colour follows the button. */
const DockGlyph = ({ group }: { group: GroupId }) => <UiArtIcon id={group} size={28} className="ab-dock-glyph" />;
/** A parchment scroll with a wax seal. */
const QuestGlyph = () => <UiArtIcon id="quest" size={28} className="ab-dock-glyph" />;

type Drawer = "expedition" | "stats" | "settings";
type Screen = "research" | "prestige" | "expedition";

const DRAWER_ICON: Record<Drawer, string> = { expedition: "expedition", stats: "stats", settings: "settings" };
const DRAWER_TITLE: Record<Drawer, string> = {
  expedition: "Expedition",
  stats: "Production stats",
  settings: "Settings",
};

/** A top-bar button's word. Hidden until the button is hovered or focused, then it types in (steps = letters). */
function NavLabel({ text }: { text: string }) {
  return (
    <span className="ab-nav-label" style={{ "--n": text.length } as CSSProperties}>
      <span className="ab-nav-txt">{text}</span>
    </span>
  );
}

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
  quest,
  dockGroup,
  onDockGroup,
}: {
  data: HudData;
  actions: HudActions;
  children?: ReactNode;
  /** Extra Settings rows supplied by the host (lighting, save and leave). */
  settingsSlots?: SettingsSlots;
  /** Desktop dock foot: the Remove tool button, shown at the bottom of the left dock. */
  removeSlot?: ReactNode;
  /** The starter quest, when one is running. Its scroll opens from the dock's Quest button. */
  quest?: QuestState;
  /** The build dock section the host says is open (Tab moves it). Undefined leaves the HUD to manage it alone. */
  dockGroup?: GroupId | null;
  /** Called when the player opens or closes a dock section, so the host can keep the number keys in step. */
  onDockGroup?: (g: GroupId | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLParagraphElement>(null);
  // The top bar wraps to two rows on a desktop-width window, so its height is measured. The rails, the Milestones
  // dock and the panels read --ab-top-h, so nothing hides under the bar.
  useEffect(() => {
    const top = topRef.current;
    const root = rootRef.current;
    if (!top || !root) return;
    const apply = () => root.style.setProperty("--ab-top-h", `${Math.ceil(top.getBoundingClientRect().height)}px`);
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(top);
    return () => ro.disconnect();
  }, []);
  // The objective card grows with its text and progress bar, and the tool hint sits above it. The card's height is
  // measured so the hint always clears it, at any width.
  useEffect(() => {
    const next = nextRef.current;
    const root = rootRef.current;
    if (!next || !root) return;
    const apply = () => root.style.setProperty("--ab-next-h", `${Math.ceil(next.getBoundingClientRect().height)}px`);
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(next);
    return () => ro.disconnect();
  }, []);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [screen, setScreen] = useState<Screen | null>(null);
  // Site chosen in Expedition, handed to the workshop selection screen.
  const [planSite, setPlanSite] = useState<string | undefined>(undefined);
  // Phone only: which panel is open as a bottom sheet over the stage.
  const [sheet, setSheet] = useState<"pal" | "factory" | null>(null);
  // Phone only: the "More" sheet lists the drawers, so the bottom bar stays at four tabs.
  const [more, setMore] = useState(false);
  // Phone only: the sheet that just closed. It stays mounted for its short exit animation, then goes.
  const [leaving, setLeaving] = useState<"pal" | "factory" | "more" | null>(null);
  const wasOpen = useRef<"pal" | "factory" | "more" | null>(null);
  const quiet = data.settings.reduceMotion || data.settings.lowFx;
  useEffect(() => {
    const now = more ? "more" : sheet;
    const was = wasOpen.current;
    wasOpen.current = now;
    if (!was || now || quiet) {
      setLeaving(null);
      return;
    }
    setLeaving(was);
    const t = setTimeout(() => setLeaving(null), 190);
    return () => clearTimeout(t);
  }, [sheet, more, quiet]);
  // Desktop: one build group flyout from the left dock, and the Milestones window from the right dock.
  const [palGroup, setPalGroup] = useState<GroupId | null>(null);
  // The section that is closing. It plays its exit while the newly chosen section plays its entrance.
  const [palLeaving, setPalLeaving] = useState<GroupId | null>(null);
  const leaveTimer = useRef<number | null>(null);
  useEffect(() => () => { if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current); }, []);
  const leavePal = (from: GroupId) => {
    setPalLeaving(from);
    if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => { setPalLeaving(null); leaveTimer.current = null; }, 160);
  };
  // One section at a time: choosing another section closes the open one with its exit animation.
  // The quest scroll shares the one-section-at-a-time rule with the build flyouts.
  const [questOpen, setQuestOpen] = useState(false);
  // True while the scroll rolls back up, so it stays mounted for its exit animation.
  const [questClosing, setQuestClosing] = useState(false);
  const questTimer = useRef<number | null>(null);
  useEffect(() => () => { if (questTimer.current !== null) window.clearTimeout(questTimer.current); }, []);
  const closeQuest = () => {
    if (!questOpen) return;
    setQuestOpen(false);
    setQuestClosing(true);
    if (questTimer.current !== null) window.clearTimeout(questTimer.current);
    questTimer.current = window.setTimeout(() => { setQuestClosing(false); questTimer.current = null; }, 170);
  };
  const openQuest = () => {
    if (questTimer.current !== null) { window.clearTimeout(questTimer.current); questTimer.current = null; }
    setQuestClosing(false);
    if (palGroup) { leavePal(palGroup); setPalGroup(null); onDockGroup?.(null); }
    setQuestOpen(true);
  };
  const toggleQuest = () => (questOpen ? closeQuest() : openQuest());
  const choosePal = (g: GroupId) => {
    if (questOpen) closeQuest();
    if (palGroup === g) { leavePal(g); setPalGroup(null); onDockGroup?.(null); return; }
    if (palGroup) leavePal(palGroup);
    setPalGroup(g);
    onDockGroup?.(g);
  };
  const closePal = () => {
    if (!palGroup) return;
    leavePal(palGroup);
    setPalGroup(null);
    onDockGroup?.(null);
  };
  // Tab and Shift+Tab move the open section from the host (the number keys follow it). Opening it here is a plain
  // state change, so it does not call back.
  useEffect(() => {
    if (dockGroup === undefined || dockGroup === palGroup) return;
    if (dockGroup === null) {
      if (palGroup) { leavePal(palGroup); setPalGroup(null); }
      return;
    }
    if (questOpen) closeQuest();
    if (palGroup) leavePal(palGroup);
    setPalGroup(dockGroup);
    // leavePal and closeQuest read the current section; this runs only when the host's section changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockGroup]);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  // The hub menu opens from the top bar, the goal strip, the phone More sheet, or a click on the hub in the world.
  const [hubOpen, setHubOpen] = useState(false);
  useEffect(() => {
    const open = () => {
      setDrawer(null);
      setScreen(null);
      setMilestonesOpen(false);
      setMore(false);
      setHubOpen(true);
    };
    window.addEventListener(HUB_OPEN_EVENT, open);
    return () => window.removeEventListener(HUB_OPEN_EVENT, open);
  }, []);
  const mode = data.settings.numberFormat;
  // The inspector keeps the last machine it showed while it folds away, so closing can animate.
  const [held, setHeld] = useState<MachineDetail | null>(data.selected);
  const [inspectClosing, setInspectClosing] = useState(false);
  useEffect(() => {
    if (data.selected) {
      setHeld(data.selected);
      setInspectClosing(false);
      return;
    }
    if (!held) return;
    setInspectClosing(true);
    const t = window.setTimeout(() => { setHeld(null); setInspectClosing(false); }, 170);
    return () => window.clearTimeout(t);
    // Runs when the selection changes; `held` is read as the machine that is closing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.selected]);

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
      ref={rootRef}
      className="ab-root bw"
      data-drawer={drawer ?? "none"}
      data-sheet={sheet ?? (leaving === "pal" || leaving === "factory" ? leaving : "none")}
      data-leaving={leaving ? "on" : "off"}
      data-inspect={held ? "on" : "off"}
      data-lowfx={data.settings.lowFx}
      data-reduce={data.settings.reduceMotion}
      data-palgroup={palGroup ?? "none"}
      data-modal={drawer || screen || sheet || hubOpen ? "on" : "off"}
    >
      <header className="ab-top" ref={topRef}>
        <div className="ab-brand">
          <Link prefetch={false} href="/creations/games#automation" className="ab-back" aria-label="Back to Games">
            <span className="ab-back-chev" aria-hidden="true">{"<"}</span> <span className="ab-back-label">Games</span>
          </Link>
          <span className="ab-brand-name">Brasswork</span>
        </div>
        <ResourceStrip
          resources={data.resources}
          showRates={data.settings.showRates}
          numberFormat={mode}
        />
        <nav className="ab-nav" aria-label="Workshop views">
          <span className="ab-nav-slot"><button
            type="button"
            className="ab-text-btn ab-primary"
            data-label="Research"
            aria-expanded={screen === "research"}
            onClick={() => setScreen((s) => (s === "research" ? null : "research"))}
          >
            <Ico id="research" />
            <NavLabel text="Research" />
          </button></span>
          <span className="ab-nav-slot"><button type="button" className="ab-text-btn" data-label="Hub" aria-expanded={hubOpen} onClick={() => (hubOpen ? setHubOpen(false) : openHubMenu())}>
            <Ico id="milestones" />
            <NavLabel text="Hub" />
          </button></span>
          {(["expedition", "stats", "settings"] as const).map((d) => (
            <span className="ab-nav-slot"><button
              key={d}
              type="button"
              className="ab-text-btn"
              data-label={DRAWER_TITLE[d]}
              aria-expanded={d === "expedition" ? screen === "expedition" : drawer === d}
              onClick={() => toggle(d)}
            >
              <Ico id={DRAWER_ICON[d]} />
              <NavLabel text={DRAWER_TITLE[d]} />
            </button></span>
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
          {quest && (
            <button
              type="button"
              className="ab-dock-btn ab-dock-quest"
              aria-pressed={questOpen}
              aria-label={`Starter quest, ${quest.finished} of ${quest.steps.length} done. ${questOpen ? "Roll up the scroll" : "Open the scroll"}`}
              onClick={toggleQuest}
            >
              <QuestGlyph />
              <span className="ab-dock-label">Quest</span>
              <span className="ab-dock-count" aria-hidden="true">{quest.finished}/{quest.steps.length}</span>
            </button>
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
          {(more || leaving === "more") && (
            <div className="ab-more" role="menu" aria-label="More menus" inert={!more || undefined}>
              <button type="button" role="menuitem" className="ab-more-item" onClick={openHubMenu}>
                <Ico id="milestones" />
                Hub
              </button>
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
              {quest && (
                <button
                  type="button"
                  role="menuitem"
                  className="ab-more-item"
                  onClick={() => {
                    setMore(false);
                    setSheet(null);
                    toggleQuest();
                  }}
                >
                  <QuestGlyph />
                  Starter quest
                </button>
              )}
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
          <p className="ab-next" ref={nextRef} aria-label="Current objective">
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
                  if (id === "hub-menu") openHubMenu();
                  else if (actions.onNextStep) actions.onNextStep(id);
                  else {
                    // A machine step arms that machine in its palette section, so the next click on the stage places it.
                    // Selecting a placed building would be the wrong action here: the step is about building a new one.
                    const m = data.machines.find((x) => x.id === id);
                    if (m && m.unlocked) {
                      const g = m.group ?? "machines";
                      if (palGroup !== g) choosePal(g);
                      if (data.armed !== id) actions.onBuild(id);
                    } else actions.onSelect(id);
                  }
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
          {held && (
            <section
              key={held.id}
              className="ab-panel ab-inspect-panel"
              aria-label="Selected machine"
              data-closing={inspectClosing ? "true" : undefined}
            >
              <Inspector
                detail={held}
                resources={data.resources}
                numberFormat={mode}
                canBuild={canAfford(held.cost, data.resources)}
                onBuild={actions.onBuild}
                onSetRecipe={actions.onSetRecipe}
                onClose={() => actions.onSelect(null)}
              />
            </section>
          )}

          {/* Phone shows these in the Milestones sheet. On desktop they live in the Goals window instead. */}
          <div className="ab-factory-meta">
            <MilestonesPanel
              milestones={data.milestones}
              blueprints={data.blueprints}
              prestige={data.prestige}
              onPrestige={() => { setPlanSite(undefined); setScreen("prestige"); }}
            />
          </div>
        </aside>

      </div>

      {drawer === "stats" && (
        <ProductionWindow resources={data.resources} stats={data.stats} numberFormat={mode} onClose={() => setDrawer(null)} />
      )}

      {quest && (questOpen || questClosing) && (
        <QuestScroll quest={quest} closing={!questOpen} onClose={closeQuest} />
      )}

      {drawer === "settings" && (
        <SettingsWindow settings={data.settings} onChange={actions.onSettings} onClose={() => setDrawer(null)} slots={settingsSlots} />
      )}

      {hubOpen && <HubMenu hub={data.hub} onClose={() => setHubOpen(false)} />}
      {!hubOpen && <HubToast hub={data.hub} onOpen={openHubMenu} />}

      {milestonesOpen && (
        <MenuWindow
          title="Milestones"
          theme="milestones"
          label="Milestones and prestige"
          size="wide"
          art={<Ico id="milestones" />}
          onClose={() => setMilestonesOpen(false)}
        >
          <MilestonesPanel
            milestones={data.milestones}
            blueprints={data.blueprints}
            prestige={data.prestige}
            onPrestige={() => { setMilestonesOpen(false); setPlanSite(undefined); setScreen("prestige"); }}
          />
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
