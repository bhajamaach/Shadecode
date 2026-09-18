import { useAppStore } from "../store";
import { predictDeltaLST, scoreFromDelta, buildMitigationPackage, fmtPct } from "../lib/model";
import { StatGrid } from "./StatGrid";
import { Sliders } from "./Sliders";
import { ScoreGauge } from "./ScoreGauge";
import { MitigationPanel } from "./MitigationPanel";

const BAND_LABEL: Record<string, string> = {
  pass: "PASS",
  condition: "CONDITIONAL — MITIGATION RECOMMENDED",
  fail: "FAIL — MITIGATION REQUIRED",
};
const BAND_CLASS: Record<string, string> = {
  pass: "text-[var(--color-heat-cool)] border-current",
  condition: "text-[var(--color-heat-warn)] border-current",
  fail: "text-[var(--color-heat-hazard)] border-current",
};

export function ReviewSheet() {
  const data = useAppStore((s) => s.data);
  const parcel = useAppStore((s) => s.currentParcel())!;
  const slider = useAppStore((s) => s.slider);

  const meta = data!.meta;
  const coef = data!.model_coefficients;
  const result = scoreFromDelta(predictDeltaLST(coef, parcel, slider.impervious, slider.canopy, slider.albedo));
  const pkg = buildMitigationPackage(coef, parcel, result.deltaLST);

  return (
    <div className="bg-[var(--color-paper)] rounded overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.35)] print-fullbleed" id="review-sheet">
      <div className="bg-[var(--color-paper-dim)] border-b-2 border-[var(--color-ink)] px-[18px] py-4">
        <div className="flex justify-between items-start gap-3">
          <div>
            <div className="font-[var(--font-head)] font-bold text-[15px] tracking-[0.3px]">Heat Impact Review Sheet</div>
            <div className="text-[12.5px] text-[var(--color-ink-soft)] mt-0.5">
              {parcel.name} — {parcel.neighborhood}
            </div>
          </div>
          <div className="text-[10.5px] text-right">
            <div className="mb-[3px]">
              <span className="block text-[var(--color-ink-soft)] uppercase tracking-[0.4px] text-[9.5px]">Parcel ID</span>
              <span className="font-[var(--font-mono)]">{parcel.id}</span>
            </div>
            <div>
              <span className="block text-[var(--color-ink-soft)] uppercase tracking-[0.4px] text-[9.5px]">Reviewed</span>
              <span className="font-[var(--font-mono)]">{new Date().toISOString().slice(0, 10)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-[18px] py-4">
        <Block title="1 · Current Heat Burden (observed, satellite-derived)">
          <StatGrid
            stats={[
              { label: "Surface Temp (LST)", value: `${parcel.lst.toFixed(1)} °C` },
              { label: "Canopy Cover", value: fmtPct(parcel.canopy) },
              { label: "Impervious Fraction", value: fmtPct(parcel.impervious) },
              { label: "Surface Albedo", value: parcel.albedo.toFixed(2) },
            ]}
          />
        </Block>

        <Block title="2 · Proposed Site Changes">
          <Sliders />
        </Block>

        <Block title="3 · Heat Impact Score">
          <div className="bg-black/[0.03] rounded-md p-3 flex items-center gap-4">
            <ScoreGauge result={result} />
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="font-[var(--font-mono)] text-xl font-semibold" style={{ color: gradeTextColor(result.grade) }}>
                  {result.deltaLST >= 0 ? "+" : ""}
                  {result.deltaLST.toFixed(1)} °C
                </span>
                <span className="text-[11px] text-[var(--color-ink-soft)]">forecast ΔLST vs. observed baseline</span>
              </div>
              <div className={`inline-block font-[var(--font-mono)] text-[11px] font-semibold tracking-[0.5px] px-2.5 py-[3px] rounded mb-2 border-[1.5px] ${BAND_CLASS[result.band]}`}>
                {BAND_LABEL[result.band]}
              </div>
              <div className="text-[10px] text-[var(--color-ink-soft)] leading-[1.4]">
                Model validated on {meta.n_training_points} held-out satellite samples · RMSE ≈{" "}
                <span className="font-[var(--font-mono)]">{meta.rmse_c.toFixed(1)}&nbsp;°C</span> (R²={meta.r2.toFixed(2)}) ·
                empirical surrogate, not a physics simulation
              </div>
            </div>
          </div>
        </Block>

        <Block title="4 · Mitigation Package to Clear Threshold">
          <MitigationPanel pkg={pkg} deltaLST={result.deltaLST} />
        </Block>

        <Block title="5 · Equity Context">
          <StatGrid
            stats={[
              { label: "Block Median Income", value: parcel.median_income ? `$${(parcel.median_income / 1000).toFixed(0)}k` : "n/a" },
              { label: "Income Percentile (city)", value: parcel.income_pctile != null ? `${parcel.income_pctile}th` : "n/a" },
              { label: "Population 65+", value: parcel.age65_pct != null ? `${parcel.age65_pct}%` : "n/a" },
              { label: "Lot Area", value: `${parcel.lot_sqft.toLocaleString()} sf${parcel.lot_sqft_is_real_building ? "" : "*"}` },
            ]}
          />
          <div className="text-[10.5px] text-[var(--color-ink-soft)] mt-2 leading-[1.4]">
            Score calibrated relative to this block's own baseline, not city-wide averages — a mitigation credit stays tied
            to the residents already living here.
            {!parcel.lot_sqft_is_real_building && " *No OSM building footprint found within range — using a category default."}
          </div>
        </Block>
      </div>

      <div className="border-t border-[var(--color-line)] px-[18px] py-3 flex justify-between items-center text-[10px] text-[var(--color-ink-soft)] bg-[var(--color-paper-dim)]">
        <div>ShadeCode — a forward-facing parcel heat impact instrument. Not a substitute for site-specific engineering review.</div>
        <button
          onClick={() => window.print()}
          className="no-print font-[var(--font-ui)] text-[11.5px] font-semibold bg-[var(--color-ink)] text-[var(--color-paper)] border-none rounded px-3 py-1.5 cursor-pointer hover:bg-black"
        >
          Export review sheet (PDF)
        </button>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-[18px]">
      <div className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.6px] text-[var(--color-ink-soft)] border-b border-[var(--color-line)] pb-[5px] mb-2.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function gradeTextColor(grade: string) {
  return { A: "#1B7A72", B: "#4C9A8A", C: "#D98E2B", D: "#C8622E", F: "#B23A2E" }[grade] ?? "#1B1D22";
}
