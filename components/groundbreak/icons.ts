"use client";

// Pixel icons for Groundbreak, drawn as small character grids and rendered once to crisp data URLs (nearest-neighbour when shown).
// One shared size (10 x 10), one outline colour and one light direction so the set reads as one family. The art thread can replace
// this file's exports (iconUrl) with drawn sprites; the screen only calls iconUrl(id).
// Legend: k outline, a main, b light, c dark, w white, o orange, y yellow, g green, . empty.
type Def = { rows: string[]; a: string; b?: string; c?: string };
const G = (rows: string[], a: string, b?: string, c?: string): Def => ({ rows, a, b, c });

const DEFS: Record<string, Def> = {
    gravel: G(["..........", "..........", "....kkk...", "...kbbak..", "..kkbaack.", ".kbbkaacck", "kbaakkcakk", "kaaacbkbak", "kcaccakaac", ".kkkkkkkkk"], "#c9b79a", "#e6d9bd", "#8d7c62"),
    sand: G(["..........", "......yy..", ".....yyyy.", "..........", "....kk....", "..kkbbkk..", ".kbbaaabkk", "kbaaaacaak", "kaaacccaac", "kkkkkkkkkk"], "#e6c07a", "#f6e0a8", "#b08a3e"),
    cement: G([".kkkkkkkk.", "kbbbbbbaak", "kbwwwwbaak", "kbwkkwbaak", "kbwwwwbaak", "kaaaaaaaak", "kaaaaaaack", "kaaaaaacck", "kaaaaaccck", ".kkkkkkkk."], "#a9adb3", "#d4d7dc", "#6c7078"),
    concrete: G(["..kkkkk...", ".kbbbaak..", "kbbaaaack.", "kbaakkaack", "kaakkkkack", "kaaakkkack", "kcaaaaacck", ".kcccccck.", "..kk..kk..", ".kkkkkkkk."], "#8f98a6", "#c3cad4", "#5b6370"),
    rebar: G(["..........", "kkkkkkkkko", "kbbbbbbbak", "kkkkkkkkkk", "kaaaaaaack", "kkkkkkkkkk", "kbbbbbbbak", "kkkkkkkkkk", "kaaaaaaack", "kkkkkkkkkk"], "#d9742f", "#f09a5a", "#a2501a"),
    steel: G(["kkkkkkkkkk", "kbbbbbbbbk", "kaaaaaaaak", "kkkkaakkkk", "...kaack..", "...kaack..", "...kaack..", "kkkkaakkkk", "kaaaaaaack", "kkkkkkkkkk"], "#7e8fb0", "#b3c0d8", "#4f5e7e"),
    glass: G(["kkkkkkkkkk", "kbbwaaaaak", "kbwaaaaaak", "kwaaaaaaak", "kaaaaaaaak", "kaaaaabaak", "kaaaabwaak", "kaaaaaaaak", "kaaaaaaack", "kkkkkkkkkk"], "#7fc7d9", "#c9eef6", "#4d8fa2"),
    wire: G(["..kkkkkk..", ".kbbbbaak.", "kbkkkkkaak", "kbkaaaakck", "kbkakkakck", "kbkaaaakck", "kbkkkkkcck", ".kbaaaack.", "..kkkkkk..", "......kkkk"], "#d98f52", "#f2b988", "#9a5a28"),
    duct: G(["..........", "kkkkkk....", "kbbbbak...", "kaaaaack..", "kkkkkkaak.", "....kbaack", "....kaaack", "....kaacck", "....kcccck", "....kkkkkk"], "#9ab0a0", "#cde0d2", "#667a6c"),
    precast: G(["kkkkkkkkkk", "kbbbbbbbbk", "kbkkabkkak", "kbkkabkkak", "kbbbbbbbak", "kaaaaaaaak", "kakkaakkak", "kakkaakkak", "kaaaaaaack", "kkkkkkkkkk"], "#b7a99a", "#dacfc2", "#7a6d60"),
    curtain: G(["kkkkkkkkkk", "kbwbkbwbkk", "kbabkbabkk", "kkkkkkkkkk", "kbwbkbwbkk", "kbabkbabkk", "kkkkkkkkkk", "kbabkbabkk", "kaackaackk", "kkkkkkkkkk"], "#8fb3c2", "#d3e6ee", "#5a7f8e"),
    floors: G(["..........", "kkkkkkkkkk", "kbbbbbbbak", "kkkkkkkkkk", "kkokkkokkk", "kkkkkkkkkk", "kbbbbbbbak", "kkkkkkkkkk", "kkokkkokkk", "kkkkkkkkkk"], "#f0b04a", "#ffd98a", "#b97f1f"),
    // interface glyphs
    bid: G(["..kkkkkk..", ".kbbbbbbk.", ".kbkkkkbk.", ".kbbbbbbk.", ".kbkkkkbk.", ".kbbbbbbk.", ".kbkkkbbk.", ".kbbbbbbk.", ".kcccccck.", "..kkkkkk.."], "#e8e0d0", "#ffffff", "#a9a08c"),
    skyline: G(["..........", "......aa..", "..aa..aa..", "..aaaaaa.a", "..aaaaaaaa", ".aaaaaaaaa", ".aaaaaaaaa", "aaaaaaaaaa", "aaaaaaaaaa", "aaaaaaaaaa"], "#ffd36a", "#ffd36a", "#c58a2a"),
    firm: G(["....kk....", "...kyyk...", "..kyyyyk..", ".kyyyyyyk.", "kyyyyyyyyk", ".kkkkkkkk.", ".kbbbbbbk.", ".kbkkkkbk.", ".kbkkkkbk.", ".kkkkkkkk."], "#e8e0d0", "#ffffff", "#a9a08c"),
    console: G(["kkkkkkkkkk", "kcccccccck", "kcgcccccck", "kccgccccck", "kcgcccccck", "kcccgggcck", "kcccccccck", "kcccccccck", "kcccccccck", "kkkkkkkkkk"], "#1b1410", "#7fd06a", "#1b1410"),
    menu: G(["..........", "kkkkkkkkkk", "kaaaaaaaak", "kkkkkkkkkk", "..........", "kkkkkkkkkk", "kaaaaaaaak", "kkkkkkkkkk", "..........", ".........."], "#e8e0d0"),
    crew: G(["...kkkk...", "..kooook..", ".kooooook.", "kkkkkkkkkk", "..kbbbbk..", "..kbkkbk..", "..kbbbbk..", ".kaaaaaak.", "kaaaaaaaak", "kkkkkkkkkk"], "#d9c8a8", "#f0e2c6", "#9c8a68"),
    equip: G(["......kkk.", ".....kbbk.", "....kbak..", "...kbak...", "kkkkak....", "kbbbak....", "kaaack.kk.", "kkkkk.kaak", "..kkkkkaak", "...kkkkkk."], "#e0a62a", "#ffd36a", "#a8741a"),
    method: G(["....kk....", "..kkbbkk..", ".kbbaabbk.", ".kbakkabk.", "kbakkkkabk", "kbakkkkack", ".kbakkack.", ".kbbaacck.", "..kkcckk..", "....kk...."], "#7fc7d9", "#c9eef6", "#4d8fa2"),
    cash: G(["kkkkkkkkkk", "kbbbbbbbak", "kbkkkkkkak", "kbkgggggak", "kbkgkkkkak", "kbkggggkak", "kbkkkkgkak", "kbkgggggak", "kaaaaaaack", "kkkkkkkkkk"], "#7fd06a", "#bfeea8", "#4a9a3a"),
    rep: G(["....kk....", "...kyyk...", "..kyyyyk..", "kkkyyyykkk", "kyyyyyyyyk", ".kyyyyyyk.", "..kyyyyk..", "..kyykyyk.", ".kyyk.kyyk", ".kkk...kkk"], "#ffd36a", "#fff0b8", "#b8892a"),
    zoomin: G(["..kkkk....", ".kbbbbk...", "kb.kk.ak..", "kb.kk.ak..", "kbkkkkak..", "kb.kk.ak..", ".kaaaak...", "..kkkkkk..", "......kkk.", ".......kkk"], "#e8e0d0", "#ffffff", "#a9a08c"),
    reset: G(["..kkkkkk..", ".kbbbbbbk.", "kb..kk..ak", "kb.kkkk.ak", "kb..kk..ak", "kb......ak", "kb..kk..ak", ".kaaaaaak.", "..kkkkkk..", ".........."], "#e8e0d0", "#ffffff", "#a9a08c"),
    lock: G(["...kkkk...", "..kbaabk..", "..k....k..", ".kkkkkkkk.", "kbbbbbbbak", "kbbbkkbbak", "kbbbkkbbak", "kbbbbbbbak", "kcccccccck", ".kkkkkkkk."], "#8a8478", "#b5afa0", "#5c5850"),
};

const cache = new Map<string, string>();
const KEY: Record<string, string> = { k: "#1b1410", w: "#ffffff", o: "#e07a2a", y: "#ffd36a", g: "#7fd06a" };

export function iconUrl(id: string): string {
    const hit = cache.get(id);
    if (hit) return hit;
    const d = DEFS[id];
    if (!d || typeof document === "undefined") return "";
    const c = document.createElement("canvas");
    c.width = 10; c.height = 10;
    const g = c.getContext("2d")!;
    d.rows.forEach((row, y) => {
        for (let x = 0; x < 10; x++) {
            const ch = row[x] ?? ".";
            if (ch === ".") continue;
            g.fillStyle = ch === "a" ? d.a : ch === "b" ? d.b ?? d.a : ch === "c" ? d.c ?? d.a : KEY[ch] ?? "#fff";
            g.fillRect(x, y, 1, 1);
        }
    });
    const url = c.toDataURL();
    cache.set(id, url);
    return url;
}
export const MAT_ICONS = ["gravel", "sand", "cement", "concrete", "rebar", "steel", "glass", "wire", "duct", "precast", "curtain", "floors"];
