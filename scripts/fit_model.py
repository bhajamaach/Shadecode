"""
ShadeCode offline data pipeline.

Every number the frontend shows by default is produced here from live public data —
nothing in web/public/data/model.json is hand-typed. See scripts/pipeline_lib.py for
the extraction/enrichment functions this shares with backend/main.py (the live
"click any parcel" API).

Pipeline:
  1. Grid-sample ~450 points across Philadelphia, extract LST / canopy / impervious /
     albedo at each from real Landsat + Sentinel-2 scenes.
  2. Fit a Ridge regression LST ~ impervious_frac + canopy_frac + albedo on that
     sample, hold out 20%, report a real RMSE and R^2 — this is the empirical
     heat-response surrogate both the static frontend and the live API use for the
     ΔLST forecast.
  3. Algorithmically pick the 4 most illustrative real parcels from that same
     sample — the 2 coolest/leafiest and 2 hottest/most-impervious — instead of
     hand-picking addresses, verify each is actually inside Philadelphia, then
     enrich just those 4 with Census/OSM/geocoding.

Run: source .venv/bin/activate && python scripts/fit_model.py
"""
import json
import random
import time
from pathlib import Path

import numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

from pipeline_lib import (
    BBOX, find_scenes, open_readers, extract_features, reverse_geocode,
    fetch_citywide_incomes, enrich_parcel,
)

N_SAMPLE_POINTS = 450
N_MAP_SAMPLE = 180  # subset of training points shipped to the frontend for the map layer
N_DEMO_PER_CATEGORY = 2


def build_training_set(readers, n_points, seed=42):
    rng = random.Random(seed)
    rows = []
    attempts = 0
    while len(rows) < n_points and attempts < n_points * 8:
        attempts += 1
        lat = rng.uniform(BBOX[1], BBOX[3])
        lon = rng.uniform(BBOX[0], BBOX[2])
        feats = extract_features(readers, lat, lon)
        if feats is not None:
            feats["lat"], feats["lng"] = round(lat, 6), round(lon, 6)
            rows.append(feats)
    print(f"[training] {len(rows)} usable samples out of {attempts} attempted points")
    return rows


def fit_and_validate(rows):
    X = np.array([[r["impervious"], r["canopy"], r["albedo"]] for r in rows])
    y = np.array([r["lst"] for r in rows])
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=7)

    model = Ridge(alpha=1.0)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, pred)))
    r2 = float(r2_score(y_test, pred))

    coef = {"impervious": float(model.coef_[0]), "canopy": float(model.coef_[1]),
            "albedo": float(model.coef_[2]), "intercept": float(model.intercept_)}
    print(f"[model] coefficients: {coef}")
    print(f"[model] held-out RMSE: {rmse:.3f} °C   R^2: {r2:.3f}   (n_train={len(X_train)}, n_test={len(X_test)})")
    return coef, rmse, r2, len(rows)


def pick_demo_points(rows, n_per_category=N_DEMO_PER_CATEGORY, min_separation_deg=0.01):
    """Rank by a simple heat-risk index and take spatially separated extremes from
    each end, so the 4 demo parcels aren't clustered on top of each other. BBOX
    extends slightly beyond Philadelphia's actual (very irregular) city limits into
    neighboring townships, so each candidate is reverse-geocoded and rejected if it
    isn't actually inside Philadelphia — real data deserves a real filter here, not
    a hand-tuned bbox."""
    def risk(r):
        return r["impervious"] - r["canopy"] + r["lst"] / 50.0

    ranked_hot = sorted(rows, key=risk, reverse=True)
    ranked_cool = sorted(rows, key=risk)

    def pick_separated(ranked, n, category_label):
        chosen = []
        for r in ranked:
            if not all((abs(r["lat"] - c["lat"]) + abs(r["lng"] - c["lng"])) > min_separation_deg for c in chosen):
                continue
            _, _, city_state = reverse_geocode(r["lat"], r["lng"])
            time.sleep(1)
            if "Philadelphia" not in city_state:
                print(f"  ! rejected candidate at ({r['lat']:.4f},{r['lng']:.4f}) — outside Philadelphia ({city_state})")
                continue
            r["category"] = category_label
            chosen.append(r)
            if len(chosen) == n:
                break
        return chosen

    hot = pick_separated(ranked_hot, n_per_category, "hot")
    cool = pick_separated(ranked_cool, n_per_category, "cool")
    return cool + hot


def main():
    landsat_item, sentinel_item = find_scenes()
    readers = open_readers(landsat_item, sentinel_item)

    rows = build_training_set(readers, N_SAMPLE_POINTS)
    coef, rmse, r2, n = fit_and_validate(rows)

    demo_rows = pick_demo_points(rows)
    print(f"[parcels] enriching {len(demo_rows)} algorithmically-selected demo parcels with Census/OSM/geocoding...")
    citywide_incomes = fetch_citywide_incomes()

    parcels_out = []
    for i, row in enumerate(demo_rows, start=1):
        fallback = 5000 if row["category"] == "cool" else 13000
        p = enrich_parcel(row["lat"], row["lng"], row, f"PHL-SAMPLE-{i:03d}", row["category"], fallback,
                          citywide_incomes, polite_delay=True)
        parcels_out.append(p)
        print(f"  {p['id']} [{p['category']}]: {p['name']} — LST={p['lst']:.1f}°C canopy={p['canopy']:.2f} "
              f"impervious={p['impervious']:.2f} albedo={p['albedo']:.2f} income={p['median_income']} age65={p['age65_pct']}")

    map_sample = random.Random(11).sample(rows, min(N_MAP_SAMPLE, len(rows)))

    out = {
        "meta": {
            "landsat_scene": landsat_item.id,
            "landsat_date": str(landsat_item.datetime.date()),
            "sentinel_scene": sentinel_item.id,
            "sentinel_date": str(sentinel_item.datetime.date()),
            "n_training_points": n,
            "rmse_c": round(rmse, 3),
            "r2": round(r2, 3),
            "data_sources": [
                "Landsat 8/9 Collection-2 Level-2 (ST_B10) via Microsoft Planetary Computer",
                "Sentinel-2 L2A via Microsoft Planetary Computer",
                "US Census Bureau block-group geography (Census Geocoder)",
                "ACS 5-year median household income & age 65+ (Census Reporter)",
                "OpenStreetMap building footprints (Overpass) and place names (Nominatim)",
            ],
        },
        "model_coefficients": coef,
        "parcels": parcels_out,
        "sample_points": [
            {"lat": r["lat"], "lng": r["lng"], "lst": r["lst"], "canopy": r["canopy"], "impervious": r["impervious"]}
            for r in map_sample
        ],
    }

    out_path = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "model.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f"[done] wrote {out_path}")


if __name__ == "__main__":
    main()
