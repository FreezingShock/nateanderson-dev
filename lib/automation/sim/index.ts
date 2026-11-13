// Public surface of the Brasswork simulation. Headless: nothing here touches the DOM or React.
export * from "../types";
export { DEFAULT_CATALOG, PLACEHOLDER_CATALOG, PLACEHOLDER_TREE, ENGINE_DATA } from "./data";
export { windAt, createWorld, place, placeError, remove, setRecipe, step, advance, catchUp, summary, stock, addDeposit, buildingAt, footprintCells, keyOf, resolve, DRILL, HUB } from "./world";
export type { CatchUpResult, CreateOptions, Kind, Resolved } from "./world";
export { unlockedRecipes, buyResearch, checkMilestones, dayClock, prestige } from "./progress";
export { gridView, autoRoute } from "./grid";
export type { GridItem, GridView, RouteCell, RouteResult } from "./grid";
export { serialize, deserialize, SAVE_FORMAT, SAVE_VERSION } from "./save";
