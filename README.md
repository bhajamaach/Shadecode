# ShadeCode

A parcel-level Heat Impact Score: satellite-derived surface temperature, canopy, and
impervious-surface data turned into a building-code-style review instrument, so a city
can score a proposed development's heat impact the same way it already scores
stormwater or traffic impact.

## Structure

- **`scripts/`** — the real-data pipeline (`fit_model.py`, `pipeline_lib.py`). Pulls a
  live Landsat 8/9 Collection-2 Level-2 thermal scene and a Sentinel-2 L2A optical scene
  (via Microsoft Planetary Computer's public STAC catalog), samples ~450 points across
  Philadelphia, fits an empirical `LST ~ impervious + canopy + albedo` regression with a
  real held-out RMSE, algorithmically selects the 4 most illustrative real parcels
  (coolest vs. hottest), and enriches those 4 with real Census block-group income/age
  data (via the Census Geocoder + Census Reporter) and real OSM building footprints
  (Overpass) and place names (Nominatim). Writes `web/public/data/model.json`.
- **`backend/`** — an optional FastAPI live-parcel API (`main.py`) that scores any
  lat/lon a user clicks against fresh satellite/Census/OSM data, using the regression
  coefficients already fit and validated by `scripts/fit_model.py`.
- **`web/`** — the frontend: Vite + React + TypeScript + Tailwind v4, MapLibre GL for
  the base map, deck.gl for the citywide sample-point heat layer, Zustand for state.
  Loads `model.json` at runtime, with an optional live lookup against the backend API
  when it's reachable.

## Setup

### 1. Python environment (data pipeline + backend API)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pystac-client rasterio rioxarray geopandas shapely numpy pandas \
            scikit-learn requests planetary-computer fastapi uvicorn
```

### 2. Regenerate the data (optional — `web/public/data/model.json` is already committed)

```bash
source .venv/bin/activate
python3 scripts/fit_model.py
```

### 3. Run the live parcel API (optional)

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

### 4. Run the frontend

```bash
cd web
npm install
npm run dev
```

Then open the printed local URL. To produce a production build:

```bash
cd web
npm run build   # outputs to web/dist
npm run preview # serve the production build locally
```

Node compatibility note: this repo pins `vite@^6` and `@vitejs/plugin-react@^4`
deliberately — the newer rolldown-based `vite@8`/`@vitejs/plugin-react@6` that
`npm create vite@latest` scaffolds by default require Node ≥20.19/22.12 and fail to
build on older Node (tested against 20.12.1). Don't upgrade those two packages without
checking the Node version first.

## What's real vs. illustrative

Real, pulled live from public sources, no key required: Landsat/Sentinel-2 imagery,
the fitted regression coefficients and RMSE, the 4 demo parcels' LST/canopy/impervious/
albedo, their Census block-group median income and age 65+, their OSM building
footprint area (where one was found within range), and their reverse-geocoded names.

Illustrative, disclosed in the UI and in `scripts/fit_model.py`: the mitigation menu's
unit costs (tree planting, cool-roof coating, permeable pavers — not an audited
estimate) and the energy-savings-to-payback assumption.
