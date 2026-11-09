"use client";

import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react";
import {
    geoArea,
    geoCentroid,
    geoGraticule,
    geoMercator,
    geoPath,
} from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { Topology } from "topojson-specification";
import { feature } from "topojson-client";
import {
    ChevronLeft,
    ChevronRight,
    Eye,
    Lightbulb,
    Minus,
    Plus,
    X,
} from "lucide-react";
import { CountryCombobox } from "@/components/games/guess-kit";
import worldTopo from "@/lib/data/world.topo.json";
import {
    flagSrc,
    type Country,
    type NeighborState,
} from "@/lib/outline-game";
import { cn } from "@/lib/utils";

// Round 2 of the Outline Guesser: name the countries that share a land
// border with the one you just found. The map is drawn from the same
// TopoJSON used to work out who the neighbours are (scripts/build-neighbors
// .mjs), so borders line up exactly, and it pans and zooms like a real map:
// drag, wheel, pinch, +/- buttons and previous/next-neighbour buttons.
// Everything is plain SVG moved with one CSS transform, so a drag never
// re-renders the paths.

const W = 640;
const H = 460;
const MIN_K = 0.5;
const MAX_K = 40;
const GREEN = "var(--cm-good)";
const RED = "var(--cm-alert)";

type Tf = { x: number; y: number; k: number };
type Bounds = [[number, number], [number, number]];
interface MapData {
    paths: Record<string, string>;
    labels: Record<string, [number, number]>;
    bounds: Record<string, Bounds>;
    graticule: string;
}

// ---- Map building (once per round) ----

function buildMap(centerCode: string, neighborCodes: string[]): MapData {
    const topo = worldTopo as unknown as Topology;
    const all = feature(topo, topo.objects.countries) as unknown as FeatureCollection<
        Polygon | MultiPolygon
    >;
    const byId = new Map(all.features.map((f) => [String(f.id), f]));
    const center = byId.get(centerCode)!;
    const nbFeatures = neighborCodes
        .map((c) => byId.get(c))
        .filter((f): f is Feature<Polygon | MultiPolygon> => !!f);
    const union: FeatureCollection<Polygon | MultiPolygon> = {
        type: "FeatureCollection",
        features: [center, ...nbFeatures],
    };

    // Mercator centred on the country. Fit the whole group if it isn't
    // hugely bigger than the country itself; otherwise fit the country with
    // room around it and let the visitor pan out to the far neighbours.
    const [lon] = geoCentroid(center);
    const projection = geoMercator().rotate([-lon, 0]);
    projection.fitExtent(
        [
            [40, 40],
            [W - 40, H - 40],
        ],
        center
    );
    const probe = geoPath(projection);
    const [[cx0, cy0], [cx1, cy1]] = probe.bounds(center);
    const [[ux0, uy0], [ux1, uy1]] = probe.bounds(union);
    const cw = cx1 - cx0;
    const ch = cy1 - cy0;
    if (ux1 - ux0 <= cw * 2.6 && uy1 - uy0 <= ch * 2.6) {
        projection.fitExtent(
            [
                [30, 30],
                [W - 30, H - 30],
            ],
            union
        );
    } else {
        projection.fitExtent(
            [
                [W * 0.3, H * 0.3],
                [W * 0.7, H * 0.7],
            ],
            center
        );
    }

    const path = geoPath(projection);
    const paths: Record<string, string> = {};
    const labels: Record<string, [number, number]> = {};
    const bounds: Record<string, Bounds> = {};
    for (const f of union.features) {
        const id = String(f.id);
        paths[id] = path(f) ?? "";
        bounds[id] = path.bounds(f);
        // Label the largest landmass, not the middle of a scattered country.
        let main: Feature<Polygon | MultiPolygon> = f;
        if (f.geometry.type === "MultiPolygon") {
            let best = -1;
            for (const coords of f.geometry.coordinates) {
                const poly: Feature<Polygon> = {
                    type: "Feature",
                    properties: {},
                    geometry: { type: "Polygon", coordinates: coords },
                };
                const a = geoArea(poly);
                if (a > best) {
                    best = a;
                    main = poly;
                }
            }
        }
        labels[id] = path.centroid(main);
    }

    // Graticule spacing that gives a handful of lines across the country.
    const sw = projection.invert!([0, H]) ?? [0, 0];
    const ne = projection.invert!([W, 0]) ?? [1, 1];
    const [gw, gs] = sw;
    const [ge, gn] = ne;
    const span = Math.max(Math.abs(ge - gw), Math.abs(gn - gs)) / 5;
    const step = [0.5, 1, 2, 5, 10, 20, 30].find((s) => s >= span) ?? 30;
    const graticule = path(geoGraticule().step([step, step])()) ?? "";

    return { paths, labels, bounds, graticule };
}

// ---- Static map layer: memoised so panning never re-renders it ----

const MapLayer = memo(function MapLayer({
    data,
    centerCode,
    neighborCodes,
    revealed,
    lost,
    flashCode,
    flashId,
    focusCode,
}: {
    data: MapData;
    centerCode: string;
    neighborCodes: string[];
    revealed: Set<string>;
    lost: boolean;
    flashCode: string | null;
    flashId: number;
    focusCode: string | null;
}) {
    return (
        <>
            <path
                d={data.graticule}
                fill="none"
                stroke="rgba(148,163,184,0.22)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
            />
            {neighborCodes.map((c) => {
                const state = revealed.has(c) ? "found" : lost ? "missed" : "hidden";
                return (
                    <path
                        key={`${c}-${state === "found" ? flashId : 0}`}
                        d={data.paths[c]}
                        className={cn(
                            "nb-path",
                            c === flashCode && "nb-correct",
                            c === focusCode && "nb-focus"
                        )}
                        data-code={c}
                        data-state={state}
                        vectorEffect="non-scaling-stroke"
                    />
                );
            })}
            <path
                d={data.paths[centerCode]}
                className="nb-path"
                data-code={centerCode}
                data-state="center"
                vectorEffect="non-scaling-stroke"
            />
        </>
    );
});

// ---- The round ----

export function NeighborRound({
    answer,
    countries,
    neighborCodes,
    initial,
    onChange,
    footer,
}: {
    answer: Country;
    countries: Country[];
    neighborCodes: string[];
    initial: NeighborState;
    onChange: (s: NeighborState) => void;
    /** Shown once the round is over (share / next buttons). */
    footer: ReactNode;
}) {
    const byCode = useMemo(
        () => new Map(countries.map((c) => [c.c, c])),
        [countries]
    );
    const data = useMemo(
        () => buildMap(answer.c, neighborCodes),
        [answer.c, neighborCodes]
    );
    const total = neighborCodes.length;
    const maxGuesses = total * 2;

    const [state, setState] = useState<NeighborState>(initial);
    const { guesses, status, hints } = state;
    const [flash, setFlash] = useState<{ code: string; id: number } | null>(null);
    const mapBoxRef = useRef<HTMLDivElement>(null);
    const [confirmGiveUp, setConfirmGiveUp] = useState(false);
    const [focus, setFocus] = useState(-1);
    const [tf, setTf] = useState<Tf>({ x: 0, y: 0, k: 1 });
    const [animating, setAnimating] = useState(false);

    const found = useMemo(
        () => guesses.filter((g) => neighborCodes.includes(g)),
        [guesses, neighborCodes]
    );
    const wrong = useMemo(
        () => guesses.filter((g) => !neighborCodes.includes(g)),
        [guesses, neighborCodes]
    );
    const revealed = useMemo(() => new Set(found), [found]);
    const playing = status === "playing";
    const lost = status === "lost";
    const guessesLeft = maxGuesses - guesses.length;

    useEffect(() => onChange(state), [state, onChange]);

    // ---- Camera ----
    const tfRef = useRef(tf);
    tfRef.current = tf;
    const svgRef = useRef<SVGSVGElement>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    useEffect(() => {
        const t = timers.current;
        return () => t.forEach(clearTimeout);
    }, []);

    const move = useCallback((next: Tf, animate: boolean) => {
        setAnimating(animate);
        setTf(next);
        if (animate) {
            const t = setTimeout(() => setAnimating(false), 600);
            timers.current.push(t);
        }
    }, []);

    const fitTo = useCallback(
        (code: string, animate = true) => {
            const [[x0, y0], [x1, y1]] = data.bounds[code];
            const bw = Math.max(x1 - x0, 4);
            const bh = Math.max(y1 - y0, 4);
            const k = Math.min(Math.max(Math.min((W * 0.6) / bw, (H * 0.6) / bh), 1), 30);
            const next = {
                k,
                x: W / 2 - ((x0 + x1) / 2) * k,
                y: H / 2 - ((y0 + y1) / 2) * k,
            };
            move(next, animate);
        },
        [data, move]
    );

    const showAll = useCallback(() => {
        setFocus(-1);
        move({ x: 0, y: 0, k: 1 }, true);
    }, [move]);

    const zoomAt = useCallback(
        (factor: number, px: number, py: number, animate: boolean) => {
            const { x, y, k } = tfRef.current;
            const nk = Math.min(MAX_K, Math.max(MIN_K, k * factor));
            const f = nk / k;
            move({ k: nk, x: px - (px - x) * f, y: py - (py - y) * f }, animate);
        },
        [move]
    );

    // Focus the camera on one country (a slot below or a shape on the map).
    const focusOn = (code: string) => {
        setFocus(neighborCodes.indexOf(code));
        fitTo(code);
    };

    const step = (dir: 1 | -1) => {
        const n = (focus + dir + total) % total;
        setFocus(n);
        fitTo(neighborCodes[n]);
    };

    // Pointer drag / pinch, wheel zoom.
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const pinch = useRef<{ dist: number } | null>(null);
    const toView = (clientX: number, clientY: number) => {
        const r = svgRef.current!.getBoundingClientRect();
        return {
            x: ((clientX - r.left) / r.width) * W,
            y: ((clientY - r.top) / r.height) * H,
            scale: W / r.width,
        };
    };

    const downAt = useRef({ x: 0, y: 0 });
    const onPointerDown = (e: React.PointerEvent) => {
        downAt.current = { x: e.clientX, y: e.clientY };
        try {
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
        } catch {}
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
        }
    };
    const onPointerMove = (e: React.PointerEvent) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        const cur = { x: e.clientX, y: e.clientY };
        pointers.current.set(e.pointerId, cur);
        if (pointers.current.size === 1) {
            const s = toView(0, 0).scale;
            const { x, y, k } = tfRef.current;
            move(
                { k, x: x + (cur.x - prev.x) * s, y: y + (cur.y - prev.y) * s },
                false
            );
        } else if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const mid = toView((a.x + b.x) / 2, (a.y + b.y) / 2);
            zoomAt(dist / pinch.current.dist, mid.x, mid.y, false);
            pinch.current.dist = dist;
        }
    };
    const onPointerUp = (e: React.PointerEvent) => {
        const wasSingle = pointers.current.size === 1;
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        // A tap (barely moved) on a country focuses it. The svg holds the
        // pointer capture, so look up what is under the pointer ourselves.
        if (
            e.type === "pointerup" &&
            wasSingle &&
            Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y) < 5
        ) {
            const hit = document
                .elementsFromPoint(e.clientX, e.clientY)
                .find((el) => el instanceof SVGPathElement && el.dataset.code);
            const code = (hit as SVGPathElement | undefined)?.dataset.code;
            if (code) focusOn(code);
        }
    };

    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const p = toView(e.clientX, e.clientY);
            zoomAt(Math.exp(-e.deltaY * 0.0018), p.x, p.y, false);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [zoomAt]);

    // ---- Guessing ----
    const guessBoxRef = useRef<HTMLDivElement>(null);

    // The country in the middle can't be a neighbour, so it isn't offered.
    const candidates = useMemo(
        () => countries.filter((c) => c.c !== answer.c),
        [countries, answer.c]
    );
    const guessedSet = useMemo(() => new Set(guesses), [guesses]);
    const shake = () =>
        guessBoxRef.current?.animate(
            [
                { transform: "translateX(0)" },
                { transform: "translateX(-7px)" },
                { transform: "translateX(6px)" },
                { transform: "translateX(-4px)" },
                { transform: "translateX(0)" },
            ],
            { duration: 380 }
        );

    const onPick = (target: Country) => {
        if (!playing) return;
        const nextGuesses = [...guesses, target.c];
        const isNeighbor = neighborCodes.includes(target.c);
        const foundNow = nextGuesses.filter((g) => neighborCodes.includes(g));
        let nextStatus: NeighborState["status"] = "playing";
        if (foundNow.length === total) nextStatus = "won";
        else if (nextGuesses.length >= maxGuesses) nextStatus = "lost";
        setState({ guesses: nextGuesses, status: nextStatus, hints });

        if (isNeighbor) {
            setFlash({ code: target.c, id: Date.now() });
            fitTo(target.c);
            setFocus(neighborCodes.indexOf(target.c));
            if (nextStatus === "playing") {
                timers.current.push(
                    setTimeout(() => {
                        setFocus(-1);
                        move({ x: 0, y: 0, k: 1 }, true);
                    }, 1500)
                );
            } else {
                timers.current.push(setTimeout(() => showAll(), 1500));
            }
        } else {
            mapBoxRef.current?.animate(
                [
                    { boxShadow: "0 0 0 0 transparent" },
                    {
                        boxShadow:
                            "0 0 0 2px var(--cm-alert), 0 0 24px -4px var(--cm-alert)",
                    },
                    { boxShadow: "0 0 0 0 transparent" },
                ],
                { duration: 700 }
            );
            shake();
        }
    };

    const giveUp = () => {
        if (!confirmGiveUp) {
            setConfirmGiveUp(true);
            timers.current.push(setTimeout(() => setConfirmGiveUp(false), 3000));
            return;
        }
        setConfirmGiveUp(false);
        setState({ ...state, status: "lost" });
        showAll();
    };

    // ---- Labels (screen space, so they never scale with the map) ----
    const chip = (code: string) => {
        const c = byCode.get(code);
        const isCenter = code === answer.c;
        const isFound = revealed.has(code);
        let text: string;
        let color = "#0f172a";
        let bg = "rgba(226,232,240,0.92)";
        if (isCenter) {
            text = answer.n;
            bg = "rgba(219,234,254,0.95)";
        } else if (isFound) {
            text = c?.n ?? code;
            bg = "rgba(187,247,208,0.95)";
        } else if (lost) {
            text = c?.n ?? code;
            bg = "rgba(254,202,202,0.95)";
        } else {
            text = hints > 0 ? `${(c?.n ?? "?")[0]} ?` : "?";
        }
        return { text, color, bg, isFound, isCenter };
    };

    const labelCodes = [answer.c, ...neighborCodes];

    return (
        <div>
            <h3
                className="mb-3 text-center font-sans text-base font-bold sm:text-lg"
                style={{ color: "var(--cm-cyan)" }}
            >
                Can you guess {total} {total === 1 ? "neighbour" : "neighbours"} of{" "}
                {answer.n}?
            </h3>

            <div
                ref={mapBoxRef}
                className="relative overflow-hidden rounded-[2px] border bg-slate-950"
                style={{ aspectRatio: `${W} / ${H}` }}
            >
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${W} ${H}`}
                    className="size-full cursor-grab touch-none select-none active:cursor-grabbing"
                    role="img"
                    aria-label={`Map of ${answer.n} and its ${total} neighbours. Drag to pan, scroll to zoom.`}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                >
                    <g
                        style={
                            {
                                transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.k})`,
                                transformOrigin: "0 0",
                                transition: animating
                                    ? "transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)"
                                    : "none",
                                willChange: "transform",
                            } as CSSProperties
                        }
                    >
                        <MapLayer
                            data={data}
                            centerCode={answer.c}
                            neighborCodes={neighborCodes}
                            revealed={revealed}
                            lost={lost}
                            flashCode={flash?.code ?? null}
                            flashId={flash?.id ?? 0}
                            focusCode={focus >= 0 ? neighborCodes[focus] : null}
                        />
                    </g>
                    {labelCodes.map((code) => {
                        const [lx, ly] = data.labels[code] ?? [0, 0];
                        const sx = lx * tf.k + tf.x;
                        const sy = ly * tf.k + tf.y;
                        if (sx < -60 || sx > W + 60 || sy < -20 || sy > H + 20) {
                            return null;
                        }
                        const { text, color, bg, isFound } = chip(code);
                        const w = text.length * 6.6 + 16;
                        return (
                            <g
                                key={`${code}-${isFound ? "f" : "u"}`}
                                transform={`translate(${sx} ${sy})`}
                                pointerEvents="none"
                            >
                                <g className={isFound ? "nb-chip-pop" : undefined}>
                                <rect
                                    x={-w / 2}
                                    y={-11}
                                    width={w}
                                    height={22}
                                    rx={7}
                                    fill={bg}
                                    stroke="rgba(15,23,42,0.35)"
                                />
                                <text
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize={12}
                                    fontWeight={700}
                                    fill={color}
                                    style={{ fontFamily: "var(--font-mono), sans-serif" }}
                                >
                                    {text}
                                </text>
                                </g>
                            </g>
                        );
                    })}
                </svg>

                {/* Zoom buttons */}
                <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-[2px] border border-white/20 bg-black/50">
                    <button
                        type="button"
                        aria-label="Zoom in"
                        onClick={() => zoomAt(1.6, W / 2, H / 2, true)}
                        className="grid size-8 place-items-center text-white/90 transition-colors hover:bg-white/15"
                    >
                        <Plus className="size-4" />
                    </button>
                    <button
                        type="button"
                        aria-label="Zoom out"
                        onClick={() => zoomAt(1 / 1.6, W / 2, H / 2, true)}
                        className="grid size-8 place-items-center border-t border-white/20 text-white/90 transition-colors hover:bg-white/15"
                    >
                        <Minus className="size-4" />
                    </button>
                </div>

                {flash && (
                    <div
                        key={flash.id}
                        aria-hidden
                        className="nb-correct-toast pointer-events-none absolute inset-x-0 top-1/2 text-center font-sans text-3xl font-bold"
                        style={{ color: GREEN }}
                    >
                        CORRECT!
                    </div>
                )}
            </div>

            {/* Camera controls */}
            <div className="mt-3 flex items-center justify-center gap-3">
                <button
                    type="button"
                    aria-label="Previous neighbour"
                    onClick={() => step(-1)}
                    className="grid size-9 place-items-center rounded-[2px] border border-border transition-colors hover:bg-foreground/10"
                >
                    <ChevronLeft className="size-4" />
                </button>
                <button
                    type="button"
                    onClick={showAll}
                    className="rounded-[2px] border border-border px-4 py-1.5 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                    Show all
                </button>
                <button
                    type="button"
                    aria-label="Next neighbour"
                    onClick={() => step(1)}
                    className="grid size-9 place-items-center rounded-[2px] border border-border transition-colors hover:bg-foreground/10"
                >
                    <ChevronRight className="size-4" />
                </button>
            </div>

            {/* Neighbour slots: ? until found. Found (or revealed) ones focus the map. */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {neighborCodes.map((_, i) => {
                    const code = found[i];
                    const missed =
                        !code && lost
                            ? neighborCodes.filter((c) => !revealed.has(c))[i - found.length]
                            : undefined;
                    const shown = code ?? missed;
                    const c = shown ? byCode.get(shown) : undefined;
                    const isFocused = !!shown && neighborCodes[focus] === shown;
                    const style: CSSProperties | undefined = code
                        ? {
                              color: GREEN,
                              borderColor: `color-mix(in oklch, ${GREEN} ${isFocused ? 100 : 60}%, transparent)`,
                              backgroundColor: `color-mix(in oklch, ${GREEN} ${isFocused ? 22 : 12}%, transparent)`,
                          }
                        : missed
                          ? {
                                color: RED,
                                borderColor: `color-mix(in oklch, ${RED} ${isFocused ? 100 : 55}%, transparent)`,
                                backgroundColor: `color-mix(in oklch, ${RED} ${isFocused ? 20 : 10}%, transparent)`,
                            }
                          : undefined;
                    const cls = cn(
                        "flex h-11 items-center justify-center gap-2 rounded-[2px] border px-2 text-sm font-semibold transition-colors",
                        code && "nb-slot-flip",
                        !shown && "border-dashed text-muted-foreground"
                    );
                    if (!c || !shown) {
                        return (
                            <div key={i} className={cls}>
                                <span className="text-lg">?</span>
                            </div>
                        );
                    }
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => focusOn(shown)}
                            aria-label={`Show ${c.n} on the map`}
                            aria-pressed={isFocused}
                            className={cn(cls, "cursor-pointer hover:brightness-125")}
                            style={style}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={flagSrc(c.c)}
                                alt=""
                                width={24}
                                height={16}
                                className="h-4 w-auto rounded-[2px]"
                            />
                            <span className="truncate">{c.n}</span>
                        </button>
                    );
                })}
            </div>

            {playing ? (
                <div ref={guessBoxRef} className="mt-4">
                    <CountryCombobox
                        countries={candidates}
                        guessed={guessedSet}
                        onPick={onPick}
                        label="Guess a neighbour"
                    />
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            disabled={hints > 0}
                            data-action="hint"
                            onClick={() => setState({ ...state, hints: 1 })}
                            className="inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1 font-mono text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            style={{
                                color: "var(--cm-amber)",
                                borderColor: "color-mix(in oklch, var(--cm-amber) 45%, transparent)",
                            }}
                        >
                            <Lightbulb className="size-3.5" /> First letters
                        </button>
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            {guessesLeft} {guessesLeft === 1 ? "guess" : "guesses"} left
                        </span>
                        <button
                            type="button"
                            data-action="giveup"
                            onClick={giveUp}
                            className="rounded-[2px] border px-3 py-1 font-mono text-xs font-semibold transition-colors"
                            style={{
                                color: RED,
                                borderColor: `color-mix(in oklch, ${RED} ${confirmGiveUp ? 90 : 45}%, transparent)`,
                                backgroundColor: confirmGiveUp
                                    ? `color-mix(in oklch, ${RED} 14%, transparent)`
                                    : undefined,
                            }}
                        >
                            {confirmGiveUp ? "Really give up?" : "Give up"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="og-hint mt-5 text-center">
                    <p
                        className="font-sans text-xl font-bold"
                        style={{ color: status === "won" ? GREEN : RED }}
                    >
                        {status === "won"
                            ? total === 1
                                ? "Found the neighbour!"
                                : `Found all ${total} neighbours!`
                            : `Found ${found.length} of ${total} neighbours.`}
                    </p>
                    <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                        <Eye className="size-4" /> Drag and zoom the map to look around.
                    </p>
                    {footer}
                </div>
            )}

            {/* Wrong guesses */}
            {wrong.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {wrong.map((code) => (
                        <span
                            key={code}
                            className="og-hint inline-flex items-center gap-1 rounded-[2px] border px-2.5 py-0.5 text-xs font-semibold"
                            style={{
                                color: RED,
                                borderColor: `color-mix(in oklch, ${RED} 45%, transparent)`,
                                backgroundColor: `color-mix(in oklch, ${RED} 8%, transparent)`,
                            }}
                        >
                            <X className="size-3" /> {byCode.get(code)?.n ?? code}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
