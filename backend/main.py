"""
ShadeCode live parcel API.

Keeps one set of real Landsat/Sentinel-2 readers open (opened once at startup —
that's the expensive part) so that any lat/lon a user clicks on the map can be
scored in a couple of seconds against real, freshly-read satellite pixels, real
Census block-group income/age, and real OSM building footprints — instead of only
the 4 parcels precomputed by scripts/fit_model.py.

The regression coefficients themselves are NOT refit on every server start (that
requires re-sampling ~450 points and takes minutes) — they're loaded from
web/public/data/model.json, which scripts/fit_model.py already fit and validated
offline. This endpoint only answers "what does the real satellite/Census data say
at this exact point," using that already-validated model.

Run: source .venv/bin/activate && uvicorn backend.main:app --reload --port 8000
"""
import json
import sys
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from pipeline_lib import (  # noqa: E402
    BBOX, find_scenes, open_readers, extract_features_with_retry,
    fetch_citywide_incomes, enrich_parcel,
)

MODEL_JSON_PATH = ROOT / "web" / "public" / "data" / "model.json"

app = FastAPI(title="ShadeCode Live Parcel API")

# Hackathon-prototype CORS: wide open so the Vite dev server (and a deployed
# static frontend on any origin) can call this without extra config. Don't
# ship this wildcard as-is for a real multi-tenant deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

state: dict = {"readers": None, "landsat_item": None, "sentinel_item": None,
               "citywide_incomes": [], "model_meta": {}, "cache": {}}


@app.on_event("startup")
def startup():
    print("[api] finding real Landsat + Sentinel-2 scenes...")
    landsat_item, sentinel_item = find_scenes()
    state["landsat_item"] = landsat_item
    state["sentinel_item"] = sentinel_item
    state["readers"] = open_readers(landsat_item, sentinel_item)

    print("[api] pulling citywide Census income distribution for percentile ranking...")
    state["citywide_incomes"] = fetch_citywide_incomes()

    if MODEL_JSON_PATH.exists():
        state["model_meta"] = json.loads(MODEL_JSON_PATH.read_text())["meta"]
    print("[api] ready.")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "landsat_scene": state["landsat_item"].id if state["landsat_item"] else None,
        "sentinel_scene": state["sentinel_item"].id if state["sentinel_item"] else None,
        "bbox": BBOX,
        "citywide_incomes_n": len(state["citywide_incomes"]),
    }


@app.get("/api/parcel")
def get_parcel(
    lat: float = Query(..., ge=BBOX[1] - 0.05, le=BBOX[3] + 0.05),
    lon: float = Query(..., ge=BBOX[0] - 0.05, le=BBOX[2] + 0.05),
):
    if state["readers"] is None:
        raise HTTPException(503, "Satellite readers not ready yet — try again in a moment.")

    cache_key = (round(lat, 5), round(lon, 5))
    if cache_key in state["cache"]:
        return state["cache"][cache_key]

    feats = extract_features_with_retry(state["readers"], lat, lon, label=f"{lat:.4f},{lon:.4f}")
    if feats is None:
        raise HTTPException(
            422,
            "No clear satellite read at this point (cloud, water, or missing data in the "
            "current scene pair) — try a nearby spot.",
        )

    category = "hot" if feats["impervious"] - feats["canopy"] > 0.3 else (
        "cool" if feats["canopy"] - feats["impervious"] > 0.3 else "mixed"
    )
    fallback_lot_sqft = 13000 if category == "hot" else 5000
    parcel_id = f"PHL-LIVE-{round(lat, 5)}-{round(lon, 5)}"

    parcel = enrich_parcel(lat, lon, feats, parcel_id, category, fallback_lot_sqft, state["citywide_incomes"])
    parcel["live"] = True
    parcel["fetched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    state["cache"][cache_key] = parcel
    return parcel
