/* __NAME__ panel. The shell (components/games/shell) draws the frame and title bar; these rules set the palette and the layout. */
.gs-windowed[data-theme="__SLUG__"] {
    --gs-accent: __ACCENT__;
    --gs-hi: __ACCENT__;
    --gs-bg: #07090d;
    --gs-line: color-mix(in srgb, __ACCENT__ 42%, transparent);
    --gs-ink: #e8edf5;
}

/* The root fills the panel exactly (the shell checks this). It scrolls itself if a small screen cannot fit it. */
.__SLUG__-root {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
    gap: 14px;
    padding: 18px;
    overflow: auto;
    color: var(--gs-ink);
    background:
        radial-gradient(ellipse at 30% 40%, color-mix(in srgb, __ACCENT__ 16%, transparent), transparent 60%),
        var(--gs-bg);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 14px;
}

.__SLUG__-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    min-width: 0;
}

.__SLUG__-head {
    display: grid;
    justify-items: center;
    gap: 2px;
    text-align: center;
}

.__SLUG__-kick {
    color: var(--gs-accent);
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
}

.__SLUG__-amount {
    font-size: clamp(36px, 7vw, 64px);
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.__SLUG__-rate {
    color: color-mix(in srgb, var(--gs-ink) 70%, transparent);
    font-size: 13px;
}

.__SLUG__-away {
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--gs-line);
    color: var(--gs-hi);
    font-size: 13px;
    animation: __SLUG__-in 0.35s ease-out both;
}

.__SLUG__-dais {
    position: relative;
    display: grid;
    place-items: center;
    flex: 1 1 auto;
    width: 100%;
    min-height: 220px;
}

.__SLUG__-tap {
    position: relative;
    display: grid;
    place-items: center;
    width: min(60vw, 260px, 100%);
    aspect-ratio: 1;
    padding: 0;
    border: 2px solid var(--gs-accent);
    background: radial-gradient(circle, color-mix(in srgb, var(--gs-accent) 18%, transparent), transparent 70%);
    color: var(--gs-accent);
    cursor: pointer;
    transition: transform 0.12s ease, box-shadow 0.2s ease;
}

.__SLUG__-tap svg {
    width: 46%;
    height: 46%;
}

.__SLUG__-tap:hover:not(:disabled) {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--gs-accent) 14%, transparent);
}

.__SLUG__-tap:active:not(:disabled) {
    transform: scale(0.96);
}

.__SLUG__-tap:focus-visible {
    outline: 2px solid var(--gs-hi);
    outline-offset: 4px;
}

.__SLUG__-tap:disabled {
    opacity: 0.5;
    cursor: default;
}

.__SLUG__-pop {
    position: absolute;
    left: 50%;
    top: 42%;
    color: var(--gs-hi);
    font-weight: 700;
    pointer-events: none;
    animation: __SLUG__-pop 0.65s ease-out forwards;
}

.__SLUG__-hint {
    margin: 0;
    color: color-mix(in srgb, var(--gs-ink) 60%, transparent);
    font-size: 12px;
    text-align: center;
}

.__SLUG__-side {
    display: grid;
    align-content: start;
    gap: 12px;
    min-width: 0;
}

/* Sharp panel with corner brackets. No pills, no coloured side strip. */
.__SLUG__-card {
    position: relative;
    margin: 0;
    padding: 14px;
    border: 1px solid var(--gs-line);
    background: rgba(255, 255, 255, 0.02);
}

.__SLUG__-card::before,
.__SLUG__-card::after {
    content: "";
    position: absolute;
    width: 10px;
    height: 10px;
    border: 2px solid var(--gs-accent);
    pointer-events: none;
}

.__SLUG__-card::before {
    top: -1px;
    left: -1px;
    border-right: 0;
    border-bottom: 0;
}

.__SLUG__-card::after {
    right: -1px;
    bottom: -1px;
    border-top: 0;
    border-left: 0;
}

.__SLUG__-card h4 {
    margin: 0 0 8px;
    color: var(--gs-accent);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.__SLUG__-list {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.__SLUG__-row {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    grid-template-areas:
        "pip name key cost"
        "pip sub sub sub";
    align-items: center;
    gap: 2px 10px;
    width: 100%;
    min-height: 44px;
    padding: 8px 10px;
    border: 1px solid var(--gs-line);
    background: transparent;
    color: var(--gs-ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
}

.__SLUG__-row:hover:not(:disabled) {
    border-color: var(--gs-accent);
    background: color-mix(in srgb, var(--gs-accent) 12%, transparent);
}

.__SLUG__-row:disabled {
    opacity: 0.45;
    cursor: default;
}

.__SLUG__-row:focus-visible {
    outline: 2px solid var(--gs-hi);
    outline-offset: 2px;
}

.__SLUG__-row-name {
    grid-area: name;
    display: grid;
    min-width: 0;
}

.__SLUG__-row-name em {
    color: color-mix(in srgb, var(--gs-ink) 60%, transparent);
    font-size: 12px;
    font-style: normal;
}

.__SLUG__-row kbd {
    grid-area: key;
    padding: 0 6px;
    border: 1px solid var(--gs-line);
    font: inherit;
    font-size: 12px;
}

.__SLUG__-row .__SLUG__-cost {
    grid-area: cost;
    color: var(--gs-hi);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
}

.__SLUG__-row-sub {
    grid-area: sub;
    color: color-mix(in srgb, var(--gs-ink) 60%, transparent);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
}

/* A small square per generator, shaded by its place in the order. */
.__SLUG__-pip {
    grid-area: pip;
    width: 12px;
    height: 12px;
    border: 2px solid var(--gs-accent);
    background: var(--gs-accent);
    opacity: 0.4;
}

.__SLUG__-pip[data-i="1"] { opacity: 0.7; }
.__SLUG__-pip[data-i="2"] { opacity: 1; }

.__SLUG__-count {
    margin: 0 0 10px;
    font-size: 15px;
}

.__SLUG__-meter {
    height: 6px;
    margin: 0 0 8px;
    border: 1px solid var(--gs-line);
}

.__SLUG__-meter span {
    display: block;
    height: 100%;
    background: var(--gs-accent);
    transition: width 0.3s ease;
}

.__SLUG__-hire {
    display: block;
    width: 100%;
    min-height: 44px;
    margin-top: 10px;
    padding: 10px 12px;
    border: 1px solid var(--gs-accent);
    background: transparent;
    color: var(--gs-ink);
    font: inherit;
    text-align: center;
    cursor: pointer;
}

.__SLUG__-hire:hover:not(:disabled) {
    background: color-mix(in srgb, var(--gs-accent) 14%, transparent);
}

.__SLUG__-hire:disabled {
    opacity: 0.45;
    cursor: default;
}

.__SLUG__-totals {
    display: grid;
    gap: 8px;
    margin: 0;
}

.__SLUG__-totals div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.__SLUG__-totals dt {
    color: color-mix(in srgb, var(--gs-ink) 65%, transparent);
}

.__SLUG__-totals dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
}

@keyframes __SLUG__-pop {
    from { transform: translate(-50%, 0); opacity: 1; }
    to { transform: translate(-50%, -48px); opacity: 0; }
}

@keyframes __SLUG__-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: none; }
}

@media (max-width: 760px) {
    .__SLUG__-root {
        grid-template-columns: minmax(0, 1fr);
    }
}

@media (prefers-reduced-motion: reduce) {
    .__SLUG__-pop,
    .__SLUG__-away {
        animation: none;
    }

    .__SLUG__-tap,
    .__SLUG__-row,
    .__SLUG__-meter span {
        transition: none;
    }
}
