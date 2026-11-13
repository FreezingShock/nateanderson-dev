// Save and load. A save is plain JSON: { format, version, world }. The cell index is never saved; it is rebuilt on load.
import type { World } from "../types";

export const SAVE_FORMAT = "brasswork-sim";
export const SAVE_VERSION = 1;

export function serialize(world: World): string {
    return JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, world });
}

export function deserialize(text: string): World {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("save is not JSON");
    }
    if (!data || typeof data !== "object") throw new Error("save is not an object");
    const env = data as { format?: unknown; version?: unknown; world?: unknown };
    if (env.format !== SAVE_FORMAT) throw new Error("not a Brasswork save");
    if (env.version !== SAVE_VERSION) throw new Error(`unsupported save version ${String(env.version)}`);
    const w = env.world as Partial<World> | undefined;
    if (!w || typeof w !== "object") throw new Error("save has no world");
    for (const f of ["time", "width", "depth", "nextId", "hubId"] as const) {
        if (typeof w[f] !== "number" || !Number.isFinite(w[f] as number)) throw new Error(`save field ${f} is invalid`);
    }
    if (!w.buildings || typeof w.buildings !== "object") throw new Error("save has no buildings");
    if (!w.buildings[w.hubId as number]) throw new Error("save has no hub");
    for (const id of Object.keys(w.buildings)) {
        const b = w.buildings[Number(id)];
        if (!b || b.id !== Number(id) || typeof b.type !== "string") throw new Error(`building ${id} is invalid`);
        b.input ??= {};
        b.output ??= {};
        b.lane ??= [];
        b.acc ??= 0;
        b.rr ??= 0;
        b.progress ??= 0;
        b.crafting ??= false;
        b.recipe ??= null;
    }
    w.deposits ??= {};
    w.progress ??= { blueprints: 0, researched: [], milestonesDone: [], delivered: {}, prestiges: 0 };
    w.power ??= { supply: 0, demand: 0, satisfaction: 1 };
    return w as World;
}
