import type { AreaView, HudSettings, StatLine } from "./types";

export function ExpeditionList({
  areas,
  onSelectArea,
}: {
  areas: AreaView[];
  onSelectArea?: (id: string) => void;
}) {
  return (
    <ul className="ab-list" aria-label="Expedition areas">
      {areas.map((a) => {
        const locked = a.state === "locked";
        return (
          <li key={a.id} className="ab-row" data-state={a.state}>
            <button
              type="button"
              className="ab-list-btn"
              disabled={locked || !onSelectArea}
              onClick={() => onSelectArea?.(a.id)}
            >
              <span className="ab-list-name">{a.name}</span>
              <span className="ab-dim">{a.note}</span>
              <span className="ab-state">{a.state}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function StatsList({ stats }: { stats: StatLine[] }) {
  return (
    <dl className="ab-data" aria-label="Production stats">
      {stats.map((s) => (
        <div key={s.label}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type Option<T extends string> = { value: T; label: string };

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="ab-setting">
      <span>{label}</span>
      <span className="ab-choices" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="ab-text-btn"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  );
}

const ON_OFF: Option<"on" | "off">[] = [
  { value: "on", label: "on" },
  { value: "off", label: "off" },
];

export function SettingsList({
  settings,
  onChange,
}: {
  settings: HudSettings;
  onChange: (patch: Partial<HudSettings>) => void;
}) {
  const bool = (v: boolean) => (v ? "on" : "off") as "on" | "off";
  const toBool = (v: "on" | "off") => v === "on";
  return (
    <div className="ab-settings">
      <Choice
        label="Sound"
        options={ON_OFF}
        value={bool(settings.sound)}
        onChange={(v) => onChange({ sound: toBool(v) })}
      />
      <Choice
        label="Low fx (no scramble, shimmer or slides)"
        options={ON_OFF}
        value={bool(settings.lowFx)}
        onChange={(v) => onChange({ lowFx: toBool(v) })}
      />
      <Choice
        label="Reduce motion"
        options={ON_OFF}
        value={bool(settings.reduceMotion)}
        onChange={(v) => onChange({ reduceMotion: toBool(v) })}
      />
      <Choice
        label="Show rates"
        options={ON_OFF}
        value={bool(settings.showRates)}
        onChange={(v) => onChange({ showRates: toBool(v) })}
      />
      <Choice
        label="Numbers"
        options={[
          { value: "short", label: "short" },
          { value: "full", label: "full" },
        ]}
        value={settings.numberFormat}
        onChange={(v) => onChange({ numberFormat: v })}
      />
    </div>
  );
}
