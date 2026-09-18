import type {
  Parcel,
  ModelCoefficients,
  ScoreResult,
  Grade,
  Band,
  MitigationPackage,
  MitigationItem,
} from "../types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Marginal-effect forecast: this is a *screening* surrogate, not a physics
 * simulation — the fitted coefficients (in model_coefficients, produced by
 * scripts/fit_model.py from real Landsat + Sentinel-2 reads) express how many
 * degrees C surface temperature moves per unit fraction change in impervious
 * cover, canopy cover, or albedo, applied as a delta from the parcel's own
 * observed baseline.
 */
export function predictDeltaLST(
  coef: ModelCoefficients,
  parcel: Parcel,
  newImpervious: number,
  newCanopy: number,
  newAlbedo: number,
): number {
  const dImp = newImpervious - parcel.impervious;
  const dCanopy = newCanopy - parcel.canopy;
  const dAlbedo = newAlbedo - parcel.albedo;
  return coef.impervious * dImp + coef.canopy * dCanopy + coef.albedo * dAlbedo;
}

const GRADE_BANDS: Array<{ max: number; grade: Grade; band: Band }> = [
  { max: 0, grade: "A", band: "pass" },
  { max: 0.5, grade: "B", band: "pass" },
  { max: 1.2, grade: "C", band: "condition" },
  { max: 2.0, grade: "D", band: "condition" },
  { max: Infinity, grade: "F", band: "fail" },
];

export function scoreFromDelta(deltaLST: number): ScoreResult {
  const score = clamp(100 - (deltaLST / 3.0) * 100, 0, 100);
  const { grade, band } = GRADE_BANDS.find((b) => deltaLST <= b.max)!;
  return { score, grade, band, deltaLST };
}

export const GRADE_COLOR: Record<Grade, string> = {
  A: "var(--color-grade-a)",
  B: "var(--color-grade-b)",
  C: "var(--color-grade-c)",
  D: "var(--color-grade-d)",
  F: "var(--color-grade-f)",
};

// Illustrative unit costs for the mitigation menu — not an audited estimate,
// disclosed as such in the UI. See PLAN.md for the assumptions.
const MITIGATION_COST = {
  treeInstall: 600,
  treeCrownSqft: 200,
  coolRoofPerSqft: 12,
  coolRoofAlbedoGain: 0.4,
  paverPerSqft: 14,
  annualSavingsPerSqftTreated: 0.35,
};

export function buildMitigationPackage(
  coef: ModelCoefficients,
  parcel: Parcel,
  deltaLST: number,
): MitigationPackage {
  const TARGET = 0.5;
  const needed = deltaLST - TARGET;
  if (needed <= 0) {
    return { items: [], totalCost: 0, achieved: 0, ok: true, alreadyClear: true, paybackYears: null };
  }

  const split = { tree: 0.5, roof: 0.3, paver: 0.2 };
  const items: MitigationItem[] = [];
  let achieved = 0;
  let totalCost = 0;

  const coolingPerTree = Math.abs(coef.canopy) * (MITIGATION_COST.treeCrownSqft / parcel.lot_sqft);
  const treeCount = Math.max(1, Math.ceil((needed * split.tree) / coolingPerTree));
  const treeCooling = treeCount * coolingPerTree;
  const treeCost = treeCount * MITIGATION_COST.treeInstall;
  items.push({ name: `Plant ${treeCount} shade tree${treeCount > 1 ? "s" : ""}`, cost: treeCost, cooling: treeCooling });
  achieved += treeCooling;
  totalCost += treeCost;

  const roofPerSqft = (Math.abs(coef.albedo) * MITIGATION_COST.coolRoofAlbedoGain) / parcel.lot_sqft;
  let roofSqft = Math.ceil((needed * split.roof) / roofPerSqft / 50) * 50;
  roofSqft = Math.min(roofSqft, Math.round(parcel.lot_sqft * 0.6));
  const roofCooling = roofSqft * roofPerSqft;
  const roofCost = roofSqft * MITIGATION_COST.coolRoofPerSqft;
  items.push({ name: `Cool-roof coating, ${roofSqft.toLocaleString()} sf`, cost: roofCost, cooling: roofCooling });
  achieved += roofCooling;
  totalCost += roofCost;

  const paverPerSqft = Math.abs(coef.impervious) / parcel.lot_sqft;
  let paverSqft = Math.ceil((needed * split.paver) / paverPerSqft / 50) * 50;
  paverSqft = Math.min(paverSqft, Math.round(parcel.lot_sqft * 0.4));
  const paverCooling = paverSqft * paverPerSqft;
  const paverCost = paverSqft * MITIGATION_COST.paverPerSqft;
  items.push({ name: `Permeable pavers, ${paverSqft.toLocaleString()} sf`, cost: paverCost, cooling: paverCooling });
  achieved += paverCooling;
  totalCost += paverCost;

  const treatedSqft = roofSqft + paverSqft;
  const annualSavings = treatedSqft * MITIGATION_COST.annualSavingsPerSqftTreated;
  const paybackYears = annualSavings > 0 ? totalCost / annualSavings : null;

  return { items, totalCost, achieved, ok: achieved >= needed, alreadyClear: false, paybackYears };
}

export function lstColor(lst: number): string {
  const stops: Array<[number, [number, number, number]]> = [
    [28, [27, 122, 114]],
    [34, [237, 231, 217]],
    [40, [217, 142, 43]],
    [46, [178, 58, 46]],
  ];
  const t = clamp(lst, stops[0][0], stops[stops.length - 1][0]);
  for (let i = 0; i < stops.length - 1; i++) {
    const [l0, c0] = stops[i];
    const [l1, c1] = stops[i + 1];
    if (t >= l0 && t <= l1) {
      const f = (t - l0) / (l1 - l0);
      const c = c0.map((v, idx) => Math.round(v + f * (c1[idx] - v)));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(217,142,43)";
}

export const fmtPct = (x: number) => `${Math.round(x * 100)}%`;
export const fmtMoney = (x: number) => `$${Math.round(x).toLocaleString()}`;
