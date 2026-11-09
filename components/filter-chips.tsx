"use client";

export interface FilterChip {
    key: string;
    label: string;
    color: string;
    count: number;
}

// Single-select filter row: an "All" chip plus one chip per group, each with its count. The square dot
// is the category flag; pressed state is aria-pressed so it stays accessible. Same look on every filter.
export function FilterChips({
    chips,
    active,
    onChange,
    total,
    label = "All",
}: {
    chips: FilterChip[];
    /** Active chip key, or null for "All". */
    active: string | null;
    onChange: (key: string | null) => void;
    total: number;
    label?: string;
}) {
    return (
        <div className="cm-row" role="group" style={{ gap: 6 }}>
            <button type="button" className="cm-chip" aria-pressed={active === null} onClick={() => onChange(null)}>
                {label}
                <span style={{ opacity: 0.7 }}>{total}</span>
            </button>
            {chips.map((chip) => {
                const on = active === chip.key;
                return (
                    <button
                        key={chip.key}
                        type="button"
                        className="cm-chip"
                        aria-pressed={on}
                        onClick={() => onChange(on ? null : chip.key)}
                    >
                        <span className="dot" style={{ background: on ? "currentColor" : chip.color }} />
                        {chip.label}
                        <span style={{ opacity: 0.7 }}>{chip.count}</span>
                    </button>
                );
            })}
        </div>
    );
}
