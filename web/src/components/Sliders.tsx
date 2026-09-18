import { useAppStore } from "../store";
import { fmtPct } from "../lib/model";

function SliderRow({
  label,
  value,
  min,
  max,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  displayValue: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="font-[var(--font-mono)] text-[var(--color-accent)] font-semibold">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-[var(--color-accent)]"
      />
    </div>
  );
}

export function Sliders() {
  const slider = useAppStore((s) => s.slider);
  const setSlider = useAppStore((s) => s.setSlider);

  return (
    <div>
      <SliderRow
        label="Impervious surface"
        value={slider.impervious}
        min={0}
        max={100}
        displayValue={fmtPct(slider.impervious)}
        onChange={(v) => setSlider({ impervious: v })}
      />
      <SliderRow
        label="Canopy cover"
        value={slider.canopy}
        min={0}
        max={80}
        displayValue={fmtPct(slider.canopy)}
        onChange={(v) => setSlider({ canopy: v })}
      />
      <SliderRow
        label="Roof / pavement albedo"
        value={slider.albedo}
        min={5}
        max={70}
        displayValue={slider.albedo.toFixed(2)}
        onChange={(v) => setSlider({ albedo: v })}
      />
    </div>
  );
}
