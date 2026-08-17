/** An OKLCH colour picker: one slider per axis, each over a gamut cross-section. */
import { useState } from "react";
import { GamutChart } from "./GamutChart.js";
import {
  type Axis,
  type Oklch,
  clampToGamut,
  colourName,
  formatOklch,
  hexToOklch,
  inGamut,
  isLight,
  maxChroma,
  oklchToHex,
  toOklch,
} from "./colour.js";
import { DEFAULT_LABELS, axisModels, outOfGamutSpans, trackGradient } from "./model.js";

export interface ColourPickerProps {
  /** `oklch(L C H)` or hex. */
  value: string | null | undefined;
  /** Called with a canonical, gamut-clamped `oklch(L C H)` string. */
  onChange: (colour: string) => void;
  presets?: string[];
  /** Show the hex input. Default true. */
  hexInput?: boolean;
  /** Show the gamut charts. Default true. */
  charts?: boolean;
  /** Show the colour's name and canonical value. Default true. */
  readout?: boolean;
  /** Override for translation. */
  labels?: Partial<Record<Axis | "outOfGamut", string>>;
  /** Class prefix for every element, so styles can be overridden. */
  classPrefix?: string;
  className?: string;
}

export function ColourPicker(props: ColourPickerProps) {
  const prefix = props.classPrefix ?? "oklch-picker";
  const labels = { ...DEFAULT_LABELS, ...props.labels };

  // What was dialled, not what was emitted: dragging through an out-of-gamut
  // region must not destroy the other axes.
  const [draft, setDraft] = useState<Oklch | null>(null);

  const stored: Oklch = toOklch(props.value) ?? { l: 0.7, c: 0.13, h: 260 };
  const current: Oklch =
    draft && formatOklch(clampToGamut(draft)) === formatOklch(stored) ? draft : stored;

  const hex = oklchToHex(current);
  const canonical = formatOklch(clampToGamut(current));
  const clipped = !inGamut(current);

  const emit = (next: Oklch) => {
    setDraft(next);
    props.onChange(formatOklch(clampToGamut(next)));
  };
  const pick = (colour: string) => {
    setDraft(null);
    props.onChange(colour);
  };
  // Handlers are bound to both onInput and onChange — React fires the latter,
  // Preact the former. Each pair shares one function.
  const editHex = (e: { target: EventTarget | null }) => {
    const parsed = hexToOklch((e.target as HTMLInputElement).value);
    if (parsed) emit(parsed);
  };

  const reachable = maxChroma(current.l, current.h);
  const axes = axisModels(current, reachable);

  return (
    <div className={[prefix, props.className].filter(Boolean).join(" ")}>
      {props.presets && props.presets.length > 0 && (
        <div className={`${prefix}__presets`}>
          {props.presets.map((p) => {
            const selected = p === canonical;
            return (
              <button
                key={p}
                type="button"
                className={`${prefix}__preset${selected ? ` ${prefix}__preset--selected` : ""}`}
                style={{ background: p }}
                onClick={() => pick(p)}
                aria-label={colourName(p)}
                aria-pressed={selected}
              />
            );
          })}
        </div>
      )}

      {axes.map((a) => {
        const spans = outOfGamutSpans(current, a.key, a.max);
        // The chroma chart is plotted against hue.
        const position = a.key === "l" ? current.l : current.h / 360;
        const slide = (e: { target: EventTarget | null }) =>
          emit({ ...current, [a.key]: Number((e.target as HTMLInputElement).value) });
        // A div, not a label — the slider has its own aria-label.
        return (
          <div key={a.key} className={`${prefix}__axis`}>
            <span className={`${prefix}__axis-head`}>
              <span className={`${prefix}__axis-label`} aria-hidden="true">
                {labels[a.key]}
              </span>
              <output className={`${prefix}__axis-value`}>
                {a.key === "h" ? Math.round(a.value) : a.value.toFixed(2)}
              </output>
            </span>

            {props.charts !== false && (
              <GamutChart
                base={current}
                axis={a.key}
                id={a.key}
                position={position}
                chromaFraction={current.c / Math.max(reachable, 1e-6)}
                classPrefix={prefix}
              />
            )}

            <span className={`${prefix}__track`}>
              <span
                className={`${prefix}__track-fill`}
                style={{ background: trackGradient(current, a.key, a.max) }}
              >
                {spans.map((s) => (
                  <span
                    key={`${a.key}-${s.start}`}
                    className={`${prefix}__out-of-gamut`}
                    style={{ left: `${s.start * 100}%`, width: `${(s.end - s.start) * 100}%` }}
                  />
                ))}
              </span>
              <input
                type="range"
                className={`${prefix}__slider`}
                min={a.min}
                max={a.max}
                step={a.step}
                value={a.value}
                aria-label={labels[a.key]}
                onInput={slide}
                onChange={slide}
              />
            </span>
          </div>
        );
      })}

      {(props.hexInput !== false || props.readout !== false) && (
        <div className={`${prefix}__footer`}>
          <span
            className={`${prefix}__preview`}
            style={{ background: hex, color: isLight(current) ? "#000" : "#fff" }}
            title={clipped ? labels.outOfGamut : canonical}
          />
          {props.hexInput !== false && (
            <input
              className={`${prefix}__hex`}
              value={hex}
              spellCheck={false}
              aria-label="Hex colour"
              onInput={editHex}
              onChange={editHex}
            />
          )}
          {props.readout !== false && (
            <span className={`${prefix}__name`}>{colourName(canonical)}</span>
          )}
        </div>
      )}

      {clipped && <p className={`${prefix}__notice`}>{labels.outOfGamut}</p>}
    </div>
  );
}
