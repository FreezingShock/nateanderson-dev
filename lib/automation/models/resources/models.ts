// Resource models in the shared format, with stable ids for the registry and
// the renderer. Ids:
//   resource.deposit.<item>.<grade>.v<variant>   grade: pure | normal | impure | depleted
//   resource.stock.<item>.<fill>                 fill: 0 | 35 | 70 | 100 (percent)

import type { VoxelModel } from "../format";
import { buildDeposit, DEPOSIT_VARIANTS } from "./deposits";
import {
    RESOURCE_IDS,
    STOCK_IDS,
    type ResourceId,
    type StockId,
} from "./palette";
import { buildStockpile } from "./stockpiles";
import { toModel } from "./voxel";

export type Grade = "pure" | "normal" | "impure" | "depleted";
export const GRADES: readonly Grade[] = [
    "pure",
    "normal",
    "impure",
    "depleted",
];
export const STOCK_FILLS = [0, 35, 70, 100] as const;

/** Sim purity (0.5, 1, 2) and remaining amount to a grade. */
export function gradeOf(purity: number, remaining = 1): Grade {
    if (remaining < 0.15) return "depleted";
    return purity <= 0.5 ? "impure" : purity >= 2 ? "pure" : "normal";
}

const GRADE_OPTS: Record<Grade, { purity: number; remaining: number }> = {
    pure: { purity: 2, remaining: 1 },
    normal: { purity: 1, remaining: 1 },
    impure: { purity: 0.5, remaining: 1 },
    depleted: { purity: 1, remaining: 0 },
};

const cache = new Map<string, VoxelModel>();
const memo = (id: string, make: () => VoxelModel) => {
    let m = cache.get(id);
    if (!m) cache.set(id, (m = make()));
    return m;
};

/**
 * One deposit cell. `variant` picks the layout (use variantForCell); `seed`
 * adds rotation and fine detail per cell and is part of the cache key only when
 * non-zero, so most cells share a handful of models.
 */
export function depositModel(
    item: ResourceId,
    grade: Grade,
    variant = 0,
    seed = 0
): VoxelModel {
    const v =
        ((variant % DEPOSIT_VARIANTS) + DEPOSIT_VARIANTS) % DEPOSIT_VARIANTS;
    const id =
        `resource.deposit.${item}.${grade}.v${v}` + (seed ? `.s${seed}` : "");
    return memo(id, () =>
        toModel(
            id,
            buildDeposit(item, { ...GRADE_OPTS[grade], variant: v, seed })
        )
    );
}

/** A stockpile crate. Fill is snapped to 0, 35, 70 or 100 percent so models are shared. */
export function stockpileModel(item: StockId, fillPercent: number): VoxelModel {
    const f = STOCK_FILLS.reduce((a, b) =>
        Math.abs(b - fillPercent) < Math.abs(a - fillPercent) ? b : a
    );
    const id = `resource.stock.${item}.${f}`;
    return memo(id, () =>
        toModel(id, buildStockpile(item, { fill: f / 100, seed: 1 }), {
            w: 1,
            d: 1,
        })
    );
}

/** Every model id this folder can make, for the preview page and tests. */
export function allResourceModelIds(): string[] {
    const ids: string[] = [];
    for (const item of RESOURCE_IDS)
        for (const g of GRADES)
            for (let v = 0; v < DEPOSIT_VARIANTS; v++)
                ids.push(`resource.deposit.${item}.${g}.v${v}`);
    for (const item of STOCK_IDS)
        for (const f of STOCK_FILLS) ids.push(`resource.stock.${item}.${f}`);
    return ids;
}

/** Builds a model from one of the ids above. */
export function resourceModel(id: string): VoxelModel | undefined {
    const p = id.split(".");
    if (p[0] !== "resource") return undefined;
    if (
        p[1] === "deposit" &&
        RESOURCE_IDS.includes(p[2] as ResourceId) &&
        GRADES.includes(p[3] as Grade)
    )
        return depositModel(
            p[2] as ResourceId,
            p[3] as Grade,
            Number(p[4]?.slice(1) ?? 0),
            Number(p[5]?.slice(1) ?? 0)
        );
    if (p[1] === "stock" && STOCK_IDS.includes(p[2] as StockId))
        return stockpileModel(p[2] as StockId, Number(p[3]));
    return undefined;
}

/** The set shown in the shared preview registry: variant 0 of each grade, and full stockpiles. */
export function resourcePreviewModels(): VoxelModel[] {
    return [
        ...RESOURCE_IDS.flatMap((item) =>
            GRADES.map((g) => depositModel(item, g, 0))
        ),
        ...STOCK_IDS.map((item) => stockpileModel(item, 100)),
    ];
}
