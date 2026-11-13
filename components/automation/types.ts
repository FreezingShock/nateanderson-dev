// The HUD's data types live in lib/automation/types.ts (shared with the simulation).
// This file re-exports them for existing imports, and holds the UI callbacks, which are not data.
import type { HudSettings } from "@/lib/automation/types";

export * from "@/lib/automation/types";

export type HudActions = {
  onBuild: (machineId: string) => void;
  onSelect: (machineId: string | null) => void;
  onNextStep?: (actionId: string) => void;
  onSelectArea?: (areaId: string) => void;
  onResearch?: (nodeId: string) => void;
  /** Called once the player has picked a site and held to confirm. */
  onPrestige?: (siteId: string) => void;
  onSettings: (patch: Partial<HudSettings>) => void;
};
