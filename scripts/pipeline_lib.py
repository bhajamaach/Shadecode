"""
Shared satellite/Census/OSM extraction logic for ShadeCode.

Used by both:
  - scripts/fit_model.py (offline): samples ~450 points, fits the regression,
    picks + enriches the 4 curated demo parcels, writes model.json.
  - backend/main.py (online): keeps the same satellite readers open and reuses
    extract_features_with_retry() + enrich_parcel() to answer "what's the real
    heat data at this exact point?" for any lat/lon a user clicks on the map.

All data sources here are free and keyless — see fit_model.py's module docstring
for the full list and why each was chosen.
"""
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import planetary_computer
import pystac_client
import rasterio
import requests
from rasterio.warp import transform as warp_transform
from shapely.geometry import shape, box

CATALOG = "https://planetarycomputer.microsoft.com/api/stac/v1"
BBOX = [-75.28, 39.88, -75.05, 40.05]  # Philadelphia core
LANDSAT_DATE_RANGE = "2023-06-01/2023-09-15"
SENTINEL_DATE_RANGE = "2023-08-01/2023-09-20"  # kept close to the Landsat date so
                                                 # canopy/impervious/albedo reflect
                                                 # roughly the same summer conditions
                                                 # as the thermal read
WINDOW_M = 90

HEADERS = {"User-Agent": "ShadeCode-Hackathon-Prototype/1.0 (contact: amancode2000@gmail.com)"}

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

AGE_65_PLUS_COLS = [f"B01001{n:03d}" for n in list(range(20, 26)) + list(range(44, 50))]


# ---------------------------------------------------------------------------
# Satellite scene selection
# ---------------------------------------------------------------------------

def find_scenes():
    cat = pystac_client.Client.open(CATALOG, modifier=planetary_computer.sign_inplace)

    landsat = cat.search(
        collections=["landsat-c2-l2"], bbox=BBOX, datetime=LANDSAT_DATE_RANGE,
        query={"eo:cloud_cover": {"lt": 15}, "platform": {"in": ["landsat-8", "landsat-9"]}},
        max_items=10,
    )
    landsat_item = min(landsat.items(), key=lambda it: it.properties["eo:cloud_cover"])

    # Philadelphia straddles a Sentinel-2 tile boundary: a single relative-orbit
    # acquisition can leave nodata gores over parts of the bbox even though the
    # scene's nominal footprint intersects it. Require full BBOX coverage before
    # ranking by cloud cover.
    sentinel = cat.search(
        collections=["sentinel-2-l2a"], bbox=BBOX, datetime=SENTINEL_DATE_RANGE,
        query={"eo:cloud_cover": {"lt": 30}}, max_items=100,
    )
    bbox_geom = box(*BBOX)
    full_cover = sorted(
        (it for it in sentinel.items() if shape(it.geometry).contains(bbox_geom)),
        key=lambda it: it.properties["eo:cloud_cover"],
    )
    if not full_cover:
        raise RuntimeError("No Sentinel-2 scene fully covers BBOX in the given date range")
    sentinel_item = full_cover[0]

    print(f"[scenes] Landsat: {landsat_item.id} (cloud {landsat_item.properties['eo:cloud_cover']:.2f}%, {landsat_item.datetime.date()})")
    print(f"[scenes] Sentinel-2: {sentinel_item.id} (cloud {sentinel_item.properties['eo:cloud_cover']:.2f}%, {sentinel_item.datetime.date()})")
    return landsat_item, sentinel_item


def open_readers(landsat_item, sentinel_item):
    return {
        "lwir11": rasterio.open(landsat_item.assets["lwir11"].href),
        "blue": rasterio.open(sentinel_item.assets["B02"].href),
        "red": rasterio.open(sentinel_item.assets["B04"].href),
        "nir": rasterio.open(sentinel_item.assets["B08"].href),
        "swir16": rasterio.open(sentinel_item.assets["B11"].href),
        "swir22": rasterio.open(sentinel_item.assets["B12"].href),
        "scl": rasterio.open(sentinel_item.assets["SCL"].href),
    }


# ---------------------------------------------------------------------------
# Per-point feature extraction from the satellite readers
# ---------------------------------------------------------------------------

def sample_window_mean(reader, lat, lon, half_window_m):
    xs, ys = warp_transform("EPSG:4326", reader.crs, [lon], [lat])
    row, col = reader.index(xs[0], ys[0])
    px = reader.res[0]
    half = max(1, int(half_window_m / px))
    window = ((row - half, row + half + 1), (col - half, col + half + 1))
    try:
        data = reader.read(1, window=window, boundless=True, fill_value=0).astype("float64")
    except Exception:
        return None
    return data if data.size else None


def extract_features(readers, lat, lon, window_m=WINDOW_M, bad_frac_max=0.3):
    """Returns dict of physical features at one point, or None if cloud/water/nodata."""
    scl = sample_window_mean(readers["scl"], lat, lon, window_m)
    if scl is None:
        return None
    bad_frac = np.isin(scl, [0, 1, 3, 6, 8, 9, 10, 11]).mean()  # nodata/satur/shadow/water/cloud/cirrus/snow
    if bad_frac > bad_frac_max:
        return None

    blue = sample_window_mean(readers["blue"], lat, lon, window_m)
    red = sample_window_mean(readers["red"], lat, lon, window_m)
    nir = sample_window_mean(readers["nir"], lat, lon, window_m)
    swir16 = sample_window_mean(readers["swir16"], lat, lon, window_m)
    swir22 = sample_window_mean(readers["swir22"], lat, lon, window_m)
    lwir = sample_window_mean(readers["lwir11"], lat, lon, window_m)
    if any(a is None for a in (blue, red, nir, swir16, swir22, lwir)):
        return None

    scale = 1 / 10000.0  # Sentinel-2 L2A surface reflectance scale factor
    blue_r, red_r, nir_r = blue.mean() * scale, red.mean() * scale, nir.mean() * scale
    swir16_r, swir22_r = swir16.mean() * scale, swir22.mean() * scale
    if (red_r + nir_r) == 0 or (swir16_r + nir_r) == 0:
        return None

    ndvi = (nir_r - red_r) / (nir_r + red_r)
    ndbi = (swir16_r - nir_r) / (swir16_r + nir_r)  # built-up/impervious index

    # Liang (2001) broadband shortwave albedo
    albedo = (0.356 * blue_r + 0.130 * red_r + 0.373 * nir_r
              + 0.085 * swir16_r + 0.072 * swir22_r - 0.0018)
    albedo = float(np.clip(albedo, 0.02, 0.9))

    canopy_frac = float(np.clip((ndvi - 0.05) / 0.70, 0.0, 1.0))
    impervious_frac = float(np.clip((ndbi + 0.35) / 0.55, 0.0, 1.0))

    dn_mean = lwir.mean()
    if dn_mean <= 0:
        return None
    lst_c = (dn_mean * 0.00341802 + 149.0) - 273.15  # USGS Landsat C2 L2 ST scale/offset -> Celsius
    if not (5 < lst_c < 60):
        return None

    return {
        "lst": round(float(lst_c), 3),
        "canopy": round(canopy_frac, 4),
        "impervious": round(impervious_frac, 4),
        "albedo": round(albedo, 4),
        "ndvi": round(float(ndvi), 4),
    }


def extract_features_with_retry(readers, lat, lon, label=""):
    """Try progressively larger windows / looser cloud tolerance, then a small
    spatial jitter, before giving up. Named parcels must not silently vanish."""
    attempts = [
        (WINDOW_M, 0.3), (WINDOW_M * 2, 0.4), (WINDOW_M * 4, 0.5),
    ]
    for window_m, bad_frac_max in attempts:
        feats = extract_features(readers, lat, lon, window_m=window_m, bad_frac_max=bad_frac_max)
        if feats is not None:
            return feats

    jitters = [(0.0006, 0.0), (-0.0006, 0.0), (0.0, 0.0006), (0.0, -0.0006),
               (0.0012, 0.0012), (-0.0012, -0.0012)]
    for dlat, dlon in jitters:
        feats = extract_features(readers, lat + dlat, lon + dlon, window_m=WINDOW_M * 2, bad_frac_max=0.4)
        if feats is not None:
            print(f"  ! {label}: used a {dlat:+.4f},{dlon:+.4f} deg jitter to avoid a cloud/nodata pixel")
            return feats

    return None


# ---------------------------------------------------------------------------
# Real-world enrichment (Census / OSM / reverse geocoding)
# ---------------------------------------------------------------------------

def reverse_geocode(lat, lon):
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 16},
            headers=HEADERS, timeout=10,
        )
        addr = resp.json().get("address", {})
        neighborhood = addr.get("neighbourhood") or addr.get("suburb") or addr.get("quarter") or addr.get("city_district")
        road = addr.get("road")
        city = addr.get("city") or addr.get("town") or "Philadelphia"
        state = addr.get("state", "PA")
        return neighborhood, road, f"{city}, {state}"
    except Exception as e:
        print(f"  ! reverse geocode failed: {e}")
        return None, None, "Philadelphia, PA"


def building_footprint_sqft(lat, lon, fallback_sqft):
    query = f'[out:json][timeout:20];way(around:70,{lat},{lon})[building];out geom;'
    elements = None
    for url in OVERPASS_MIRRORS:
        try:
            resp = requests.post(url, data={"data": query}, headers=HEADERS, timeout=10)
            elements = resp.json().get("elements", [])
            break
        except Exception as e:
            print(f"  ! Overpass mirror {url} failed: {e}")
    try:
        if elements is None or not elements:
            return fallback_sqft, False
        # nearest building by centroid distance
        def centroid_dist(el):
            geom = el.get("geometry", [])
            if not geom:
                return 1e9
            clat = sum(g["lat"] for g in geom) / len(geom)
            clon = sum(g["lon"] for g in geom) / len(geom)
            return (clat - lat) ** 2 + (clon - lon) ** 2

        nearest = min(elements, key=centroid_dist)
        geom = nearest.get("geometry", [])
        if len(geom) < 3:
            return fallback_sqft, False
        # planar area via shoelace, projected with a local equirectangular approx
        lat0 = geom[0]["lat"]
        m_per_deg_lat = 111_320.0
        m_per_deg_lon = 111_320.0 * np.cos(np.radians(lat0))
        xs = [g["lon"] * m_per_deg_lon for g in geom]
        ys = [g["lat"] * m_per_deg_lat for g in geom]
        area_m2 = 0.0
        for i in range(len(xs)):
            j = (i + 1) % len(xs)
            area_m2 += xs[i] * ys[j] - xs[j] * ys[i]
        area_m2 = abs(area_m2) / 2.0
        area_sqft = area_m2 * 10.7639
        if area_sqft < 200:
            return fallback_sqft, False
        return round(area_sqft), True
    except Exception as e:
        print(f"  ! Overpass building lookup failed: {e}")
        return fallback_sqft, False


def census_block_group(lat, lon):
    try:
        resp = requests.get(
            "https://geocoding.geo.census.gov/geocoder/geographies/coordinates",
            params={"x": lon, "y": lat, "benchmark": "Public_AR_Current",
                    "vintage": "Current_Current", "layers": 10, "format": "json"},
            headers=HEADERS, timeout=15,
        )
        bg = resp.json()["result"]["geographies"]["Census Block Groups"][0]
        return {"state": bg["STATE"], "county": bg["COUNTY"], "tract": bg["TRACT"], "blkgrp": bg["BLKGRP"]}
    except Exception as e:
        print(f"  ! Census block-group lookup failed: {e}")
        return None


def census_reporter_table(geoid, table_id):
    try:
        resp = requests.get(
            "https://api.censusreporter.org/1.0/data/show/latest",
            params={"table_ids": table_id, "geo_ids": geoid}, headers=HEADERS, timeout=20,
        )
        return resp.json()["data"][geoid][table_id]["estimate"]
    except Exception as e:
        print(f"  ! Census Reporter lookup failed for {table_id}: {e}")
        return None


def fetch_citywide_incomes():
    """All Philadelphia County block-group median incomes, for a real percentile rank."""
    try:
        resp = requests.get(
            "https://api.censusreporter.org/1.0/data/show/latest",
            params={"table_ids": "B19013", "geo_ids": "150|05000US42101"}, headers=HEADERS, timeout=30,
        )
        data = resp.json()["data"]
        vals = [v["B19013"]["estimate"]["B19013001"] for v in data.values()
                if v["B19013"]["estimate"].get("B19013001") is not None]
        print(f"[census] pulled {len(vals)} Philadelphia County block-group incomes for percentile ranking")
        return vals
    except Exception as e:
        print(f"  ! citywide income pull failed: {e}")
        return []


def enrich_parcel(lat, lng, feats, parcel_id, category, fallback_lot_sqft, citywide_incomes, polite_delay=False):
    """Turn raw satellite features + a lat/lng into a full parcel record with
    real Census income/age, real OSM building area (or a disclosed fallback),
    and a real reverse-geocoded name. Geocoding, the Overpass building lookup,
    and the Census block-group lookup are independent, so they run concurrently
    — this is what keeps a live "click the map" request down to a few seconds
    instead of the ~10-30s all three would take run one after another.

    `polite_delay=True` adds a 1s pause afterwards — used by the offline batch
    pipeline (fit_model.py), which calls this in a loop and shouldn't hammer
    Nominatim's shared free endpoint; the live single-request API skips it."""
    with ThreadPoolExecutor(max_workers=3) as ex:
        f_geo = ex.submit(reverse_geocode, lat, lng)
        f_building = ex.submit(building_footprint_sqft, lat, lng, fallback_lot_sqft)
        f_bg = ex.submit(census_block_group, lat, lng)
        neighborhood, road, city_state = f_geo.result()
        lot_sqft, is_real_building = f_building.result()
        bg = f_bg.result()

    if polite_delay:
        time.sleep(1)

    median_income, age65_pct, income_pctile = None, None, None
    if bg:
        geoid = f"15000US{bg['state']}{bg['county']}{bg['tract']}{bg['blkgrp']}"
        with ThreadPoolExecutor(max_workers=2) as ex:
            f_income = ex.submit(census_reporter_table, geoid, "B19013")
            f_age = ex.submit(census_reporter_table, geoid, "B01001")
            income_est = f_income.result()
            age_est = f_age.result()
        if income_est:
            median_income = income_est.get("B19013001")
            if median_income and citywide_incomes:
                income_pctile = round(100 * (np.sum(np.array(citywide_incomes) < median_income) / len(citywide_incomes)))
        if age_est and age_est.get("B01001001"):
            total = age_est["B01001001"]
            plus65 = sum(age_est.get(c, 0) or 0 for c in AGE_65_PLUS_COLS)
            age65_pct = round(100 * plus65 / total, 1) if total else None

    label = road or neighborhood or "Selected Parcel"
    category_word = "Coolest" if category == "cool" else "Hottest" if category == "hot" else "Selected"
    name = f"{label} ({category_word}{' Sampled' if category in ('cool', 'hot') else ''} Parcel)"
    neighborhood_full = f"{neighborhood + ', ' if neighborhood else ''}{city_state}"

    return {
        "id": parcel_id,
        "name": name,
        "neighborhood": neighborhood_full,
        "category": category,
        "lot_sqft": lot_sqft,
        "lot_sqft_is_real_building": is_real_building,
        "lat": lat, "lng": lng,
        "median_income": median_income,
        "income_pctile": income_pctile,
        "age65_pct": age65_pct,
        "lst": feats["lst"], "canopy": feats["canopy"], "impervious": feats["impervious"],
        "albedo": feats["albedo"], "ndvi": feats["ndvi"],
    }
