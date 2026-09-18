export interface Parcel {
  id: string;
  name: string;
  neighborhood: string;
  category: "cool" | "hot" | "mixed";
  lot_sqft: number;
  lot_sqft_is_real_building: boolean;
  lat: number;
  lng: number;
  median_income: number | null;
  income_pctile: number | null;
  age65_pct: number | null;
  lst: number;
  canopy: number;
  impervious: number;
  albedo: number;
  ndvi: number;
  live?: boolean;
  fetched_at?: string;
}

export interface SamplePoint {
  lat: number;
  lng: number;
  lst: number;
  canopy: number;
  impervious: number;
}

export interface ModelCoefficients {
  impervious: number;
  canopy: number;
  albedo: number;
  intercept: number;
}

export interface ModelMeta {
  landsat_scene: string;
  landsat_date: string;
  sentinel_scene: string;
  sentinel_date: string;
  n_training_points: number;
  rmse_c: number;
  r2: number;
  data_sources: string[];
}

export interface ModelData {
  meta: ModelMeta;
  model_coefficients: ModelCoefficients;
  parcels: Parcel[];
  sample_points: SamplePoint[];
}

export type Grade = "A" | "B" | "C" | "D" | "F";
export type Band = "pass" | "condition" | "fail";

export interface SliderState {
  impervious: number;
  canopy: number;
  albedo: number;
}

export interface ScoreResult {
  score: number;
  grade: Grade;
  band: Band;
  deltaLST: number;
}

export interface MitigationItem {
  name: string;
  cost: number;
  cooling: number;
}

export interface MitigationPackage {
  items: MitigationItem[];
  totalCost: number;
  achieved: number;
  ok: boolean;
  alreadyClear: boolean;
  paybackYears: number | null;
}
