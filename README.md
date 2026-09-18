# ShadeCode

A parcel-level Heat Impact Score: satellite-derived surface temperature, canopy, and
impervious-surface data turned into a building-code-style review instrument, so a city
can score a proposed development's heat impact the same way it already scores
stormwater or traffic impact.

Built for the WUST Hackathon 2026. See `PLAN.md` for the full strategy, rubric mapping,
and design language this build follows.

## Structure

- **`scripts/fit_model.py`** — the real-data pipeline. Pulls a live Landsat 8/9
  Collection-2 Level-2 thermal scene and a Sentinel-2 L2A optical scene (via Microsoft
  Planetary Computer's public STAC catalog), samples ~450 points across Philadelphia,
  fits an empirical `LST ~ impervious + canopy + albedo` regression with a real
  held-out RMSE, algorithmically selects the 4 most illustrative real parcels (coolest
  vs. hottest), and enriches those 4 with real Census block-group income/age data
  (via the Census Geocoder + Census Reporter) and real OSM building footprints
  (Overpass) and place names (Nominatim). Writes `web/public/data/model.json`.
- **`web/`** — the frontend: Vite + React + TypeScript + Tailwind v4, MapLibre GL for
  the base map, deck.gl for the citywide sample-point heat layer, Zustand for state.
  Loads `model.json` at runtime — no backend, nothing hardcoded.

## Running it

```bash
# 1. Regenerate the data (optional — model.json is already committed/generated)
python3 -m venv .venv && source .venv/bin/activate
pip install pystac-client rasterio rioxarray geopandas shapely numpy pandas \
            scikit-learn requests planetary-computer
python3 scripts/fit_model.py

# 2. Run the frontend
cd web
npm install
npm run dev
```

Node 20.12 note: this repo pins `vite@^6` and `@vitejs/plugin-react@^4` deliberately —
the newer rolldown-based `vite@8`/`@vitejs/plugin-react@6` that `npm create vite@latest`
scaffolds by default require Node ≥20.19/22.12 and fail to build on this machine's
Node 20.12.1. Don't upgrade those two packages without checking the Node version first.

## What's real vs. illustrative

Real, pulled live from public sources, no key required: Landsat/Sentinel-2 imagery,
the fitted regression coefficients and RMSE, the 4 demo parcels' LST/canopy/impervious/
albedo, their Census block-group median income and age 65+, their OSM building
footprint area (where one was found within range), and their reverse-geocoded names.

Illustrative, disclosed in the UI and in `scripts/fit_model.py`: the mitigation menu's
unit costs (tree planting, cool-roof coating, permeable pavers — not an audited
estimate) and the energy-savings-to-payback assumption.
