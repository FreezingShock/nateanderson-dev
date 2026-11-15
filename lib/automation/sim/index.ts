// Public surface of the Brasswork simulation. Headless: nothing here touches the DOM or React.
export * from "../types";
export { DEFAULT_CATALOG, PLACEHOLDER_CATALOG, PLACEHOLDER_TREE, ENGINE_DATA } from "./data";
export { windAt, chargeOf, createWorld, place, placeError, remove, setRecipe, setFilter, unloaderIdleReason, step, advance, catchUp, summary, stock, addDeposit, depositUnder, hasOutputNeighbour, buildingAt, footprintCells, keyOf, resolve, DRILL, HUB, STARTER_KIT } from "./world";
export type { CatchUpResult, CreateOptions, Kind, Resolved } from "./world";
export { unlockedRecipes, buyResearch, checkMilestones, checkRequests, requestDone, dayClock, prestige, offerSites } from "./progress";
export { SITES } from "./data";
export type { SiteDef } from "./data";
export { gridView, autoRoute, suggestSpot } from "./grid";
export type { GridItem, GridView, RouteCell, RouteResult } from "./grid";
export { serialize, deserialize, SAVE_FORMAT, SAVE_VERSION } from "./save";
export { hudData, actions, unlockedMachine, previewMachine } from "./hud";
