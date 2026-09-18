# ShadeCode — Master Build Plan for WUST Hackathon 2026

This file is the single source of truth for building and pitching ShadeCode for the
**2nd Washington Hackathon 2026** (WUST). Everything below was cross-checked against
the live event pages on 2026-09-13. Read this before writing any code, slide, or line
of the pitch.

---

## 0. Verified hackathon facts (source of truth — overrides assumptions in ShadeCode_idea.md)

- **Organizer:** Washington University of Science and Technology (WUST), Alexandria, VA
- **Format:** Virtual hackathon
- **Event dates:** Sept 19–20, 2026 (live presentations + Q&A, winners announced 9/20)
- **⚠️ Submission deadline: Sept 17, 2026, 11:59 PM EDT** — the actual build deadline.
  That is **4 days from today (Sept 13)**, not the event dates. No late submissions accepted.
- **Deliverables:**
  1. **5-slide PPTX/.ppt**, ≤10MB, fonts embedded, named `TeamName_InstitutionName_Category.pptx`
  2. **Optional but strongly recommended:** 2–3 min prototype video (YouTube/Vimeo link)
- **Live event:** 10-minute presentation + 5-minute Q&A per team, Sept 19–20
- **Team:** individual or 2–5 members, one designated leader
- **Eligibility:** B.Tech/M.Tech/PhD/industry professionals — interdisciplinary OK
- **Theme (site-wide):** "Learn, Lead, Perform, Innovate" — sustainability / "innovate for
  a sustainable future"
- **⚠️ Judging rubric is templated from a healthcare track** and literally says
  "healthcare" in two categories even though the site theme is sustainability. Treat
  every "healthcare" mention as "domain impact" — this is a copy-paste artifact across
  WUST's tracks, not a hard requirement to build a health product. `Category` in the
  filename is a free field (their own example is `GreenTech_MIT_CleanEnergy.pptx`), so
  file this as **Category = ClimateTech** or **UrbanSustainability**.
- **Prizes:** Champion $1,000 / 1st runner-up $500 / 2nd runner-up $250
- **Judges (all four are academics/administrators, not domain climate scientists):**
  - Prof. Mohammad Shorif Uddin — Jahangirnagar University, Bangladesh
  - Prof. Touhid Bhuiyan — WUST
  - Dr. Amalisha Sabie-Aridi — Lead Faculty, School of Business, WUST
  - Dr. Mark Robinson — Director, School of Business Administration, WUST
  - **Implication:** 2 of 4 judges are business-school faculty, not engineers. They will
    weigh feasibility, business model, and clarity of communication heavily, and will not
    be impressed by ML jargon they can't evaluate. **Every slide must be legible to a
    non-technical judge in under 60 seconds.** Lead with the one-page review-sheet
    artifact and the dollar/degree mitigation numbers — those read instantly to a
    business audience. Don't over-invest in defending the regression-vs-physics point;
    spend that time on the ordinance/procurement/SaaS story instead.

### Actual rubric (verbatim weights, "healthcare" reframed as domain impact)

| # | Category | Weight | What it really rewards here |
|---|---|---|---|
| 1 | Innovation & Technical Excellence | 25% | Forward-facing satellite heat instrument vs. backward-facing competitors; real model, real validation |
| 2 | "Healthcare" → **Domain (Climate/Heat) Impact** | 25% | Heat mortality + equity framing; lives and dollars saved |
| 3 | Implementability & Feasibility | 20% | Plugs into ordinances that already exist (tree/stormwater/CEQA); no new law required |
| 4 | Scalability & Adoption | 15% | Every city with a tree ordinance is a customer; ordinance = distribution channel |
| 5 | Presentation & Demo | 10% | One-page review sheet + live before/after slider on a real parcel |
| 6 | Ethics, Privacy & Safety | 5% | Green-gentrification risk named + mitigated; census data handling |

---

## 1. Product spec (unchanged core idea, refined for this audience)

**One line:** Satellite heat data turned into a building-code-style Heat Impact Score
for every proposed development, so a city can refuse to make a hot block hotter.

**What the demo shows, end to end:**
1. Pick a real parcel (four preset parcels across 2 neighborhood pairs: leafy/cool vs.
   hot/bare in each, for visual variety without reintroducing a live backend).
2. See its **current heat burden**: LST, canopy %, albedo, impervious %, income/age overlay.
3. Move three sliders — trees removed/added, impervious area, roof albedo — and watch a
   **live ΔLST forecast** update with a confidence interval.
4. See the **Heat Impact Score** (A–F, LEED-style) flip from PASS to FAIL as the sliders
   move toward a worse design.
5. See the **mitigation package** that clears the bar: "+14 shade trees, cool-roof 6,000 sf,
   swap 2,000 sf asphalt → permeable pavers. Cost $X. Back under threshold. Payback N yrs."
6. Output: a **one-page PDF review sheet** — the artifact a planning commission actually
   attaches to a permit file. This is the deliverable, not a dashboard.

**Non-goals for this build (say these out loud in the deck so judges see the discipline):**
- No freehand site-plan drawing — preset parcels + sliders only.
- No physics-based UHI simulation (SOLWEIG/ENVI-met) — an empirical regression surrogate,
  explicitly disclosed as such, validated with a reported RMSE.
- No live backend inference during the demo — precomputed for reliability (see §3).

---

## 2. Design language

Goal: read as a **regulatory instrument / scientific tool**, not a consumer app or a
hackathon toy. Think NOAA/NASA climate dashboards and LEED scorecards, not a startup
landing page.

- **Typography:** `Inter` (UI/body) + `IBM Plex Mono` (all numeric readouts — scores,
  °C deltas, $ figures, RMSE). The monospace-for-numbers trick alone makes it look
  instrument-grade instantly.
- **Color system:**
  - Base: near-black slate `#12151A` background, off-white `#F4F1EA` text (paper-like,
    not pure white — reads as "official document" not "app").
  - Heat scale (sequential, colorblind-safe): cool teal `#1B7A72` → pale `#EDE7D9` →
    warning amber `#D98E2B` → hazard red `#B23A2E`. Use this ONLY for temperature/heat
    data, never for UI chrome.
  - Score grade colors: A/B = teal, C = amber, D/F = red — same family as the heat
    scale so the score visually IS the heat.
  - One accent only: a muted signal blue `#3E7CB1` for interactive elements (sliders,
    links) so it never competes with the heat-data palette.
- **Score widget:** a semicircular gauge (0–100 → A–F), styled like a building-permit
  stamp, not a fitness-app ring.
- **Layout:** one primary screen = map (MapLibre) on the left 60%, review-sheet panel
  on the right 40%, sliders pinned at the bottom of the panel. No modal dialogs, no
  onboarding flow — judges see everything in the first 3 seconds.
- **The review sheet itself** (both on-screen and as the exported artifact) should look
  like an actual government form: header block (parcel ID, address, date, reviewer),
  a data table, the score stamp, and a signature/condition line. This single visual
  choice does more for the "Implementability" score than any amount of narrative.

---

## 3. Tech stack (as built)

Optimized for: **zero live-demo failure risk** (no live backend at demo time — the
frontend is still a static build that fetches one precomputed JSON), a **real,
verifiable data pipeline** rather than hand-typed numbers, and a proper framework so
the code is maintainable, not a hackathon toy.

### Data pipeline — `scripts/fit_model.py` (Python, run ahead of time, not live)
All free, keyless, real:
- **Landsat 8/9 Collection-2 Level-2** thermal band (`lwir11`/ST) and **Sentinel-2
  L2A** optical bands, via **Microsoft Planetary Computer's** public STAC catalog
  (`pystac_client` + `planetary_computer.sign_inplace`) — chosen over AWS Earth Search
  because Landsat C2L2 on Earth Search sits in a requester-pays S3 bucket; Planetary
  Computer mirrors the same data over plain signed HTTPS, no AWS account needed.
- **~450 grid-sampled points across Philadelphia**, each read via `rasterio` windowed
  reads (no full-scene download): NDVI → canopy fraction, NDBI → impervious fraction,
  Liang (2001) shortwave albedo from blue/red/nir/swir bands, and real LST in °C from
  the Landsat thermal DN (`K = DN·0.00341802 + 149.0`).
- **Scene selection is automated, not hand-picked**: search both catalogs for
  low-cloud scenes close in date, require full bbox coverage (Philadelphia straddles
  a Sentinel-2 tile boundary — a single orbit can leave nodata gores), and mask cloud/
  shadow/water per-point via the Sentinel-2 SCL band.
- **US Census** block-group geography (Census Geocoder, keyless) → **ACS 5-year**
  median household income and population 65+ via **Census Reporter**
  (`api.censusreporter.org`, a free keyless wrapper around the Census API — the Census
  Bureau's own `api.census.gov` now requires a registered key, which blocked a fully
  keyless build).
- **OpenStreetMap** building footprint area (Overpass, with 3 mirror endpoints for
  reliability) and place name (Nominatim reverse geocoding).
- **Demo city: Philadelphia** (real green-roof tax credit — cite on Slide 4). The 4
  demo parcels are **not hand-picked addresses** — they're the 2 coolest/leafiest and
  2 hottest/most-impervious points found *algorithmically* in the same 450-point real
  sample used to fit the model, spatially separated so they aren't clustered. This is
  a stronger claim on stage than fictional addresses: "these are the real extremes our
  own pipeline found," not a cherry-picked demo.

### Modeling
- **scikit-learn `Ridge` regression**: `LST ~ impervious_frac + canopy_frac + albedo`,
  fit on the real 450-point sample, 80/20 holdout.
- **Real, reported validation**: RMSE ≈1.4–1.8 °C, R² ≈0.74–0.86 depending on the
  scene pair pulled — an actual number from an actual holdout, not asserted. State it
  on the slide exactly as reported by the last pipeline run (see `model.json`'s
  `meta.rmse_c` / `meta.r2`).
- **Coefficients, not a black box**: Ridge gives one number per feature (°C per unit
  fraction change) that the frontend applies directly as a marginal-effect forecast
  from each parcel's own observed baseline — explainable on stage in one sentence.
- Output is a single `web/public/data/model.json`: coefficients + the 4 enriched
  parcels + a 180-point map sample. The frontend does zero inference server-side;
  it's baked ahead of time and fetched once.

### Frontend — `web/` (Vite + React + TypeScript + Tailwind v4)
- **MapLibre GL JS** for the base map, **deck.gl** (`ScatterplotLayer` via
  `@deck.gl/mapbox`) for the citywide real-sample heat layer underneath the 4
  interactive parcel markers.
- **Zustand** for state (selected parcel, slider values) — deliberately not Redux;
  the state shape is small and doesn't need the ceremony.
- Sliders read the fetched `model.json`'s coefficients and recompute the ΔLST
  forecast, score, and mitigation package client-side, instantly, with zero network
  dependency after the initial load — this is what keeps the live 10-minute demo
  bulletproof on hackathon wifi even though the data behind it is genuinely real.
- **One-page review sheet export**: `window.print()` on a print-styled version of the
  same component tree. No backend PDF service.
- Node compatibility note: pin `vite@^6` + `@vitejs/plugin-react@^4` — the versions
  `npm create vite@latest` scaffolds by default (`vite@8`, rolldown-based) require
  Node ≥20.19/22.12 and fail to build on older Node. See `README.md`.

### Deployment
- **Vercel** or **GitHub Pages**, static build (`npm run build` → `web/dist`), deployed
  at least 24h before the live presentation. Have the URL open in a pre-loaded browser
  tab *and* a local fallback running on localhost in case of venue wifi issues — since
  this is virtual, also record the 2–3 min prototype video as a hard backup in case
  live screen-share breaks.

### Explicitly out of scope for the build
- No Kubernetes, no Celery/task queues, no Postgres/PostGIS, no auth, no multi-user
  backend, no live model inference server. The data pipeline runs ahead of time and
  writes one static JSON file; the frontend never calls out to Python at runtime.

---

## 4. Data pipeline (build order)

1. Pick 4 demo parcels (2 neighborhood pairs, each pair = 1 leafy/cool + 1 hot/bare —
   the visual contrast within each pair is the pitch).
2. Pull Sentinel-2 + Landsat scenes for all 4, clip to parcel + 400m walkable radius.
3. Compute NDVI → canopy fraction, shortwave albedo, impervious fraction (from
   WorldCover/NLCD), and pull `ST_B10` LST directly.
4. Join Census ACS block-group income/age by spatial join.
5. Assemble the training table across a broader sample of parcels in the same
   city (hundreds–low thousands of parcels, not just the 2 demo ones) for the
   regression fit.
6. Fit `LST ~ f(...)`, hold out 20%, report RMSE.
7. Generate the precomputed ΔLST lookup grid for each of the 4 demo parcels across the
   slider ranges (impervious ±, canopy ±, albedo ±).
8. Score each grid point against a chosen threshold (calibrate the A–F cutoffs from the
   distribution of LST deltas you actually observe — don't hardcode arbitrary numbers).
9. Price the mitigation menu (tree planting $/tree, cool-roof $/sf, permeable pavers
   $/sf — cite public unit-cost sources, even rough ones, so the $X isn't invented).
10. Export everything to static JSON/GeoJSON/COG for the frontend.

---

## 5. The 5 slides (exact content, mapped to the rubric weights above)

1. **Team & Institution** — names, roles, leader's email + phone, institution logo.
2. **Problem** — heat mortality stat, the equity gradient, and the specific gap: cities
   already score stormwater/traffic/schools per-parcel; heat is the missing field on a
   form that already exists.
3. **Proposed Solution** — the Heat Impact Score + one-page review sheet screenshot.
   The "every competitor faces backward, this faces forward" diagram. Name the stack in
   one line. State the RMSE and the surrogate-model disclosure in one sentence each —
   don't over-explain the math to a business-faculty panel.
4. **Feasibility & Impact** — name the real ordinance hook (tree ordinance / CEQA /
   Philadelphia's green-roof tax credit), name the pilot city, state the rollout
   (pilot with one planning department → SaaS per city → pre-submission clearing service
   for developers). This slide is where the 20%+15% weight lives — spend real space here.
5. **Implementation & Future Scope** — built vs. next, named risks (surrogate accuracy,
   green-gentrification, procurement timelines) each paired with its mitigation,
   commercialization path.

---

## 6. Prototype video (2–3 min) — do this, it's optional but high-leverage

Given 2 of 4 judges are non-technical, a working video is worth more than any slide.
Script:
- 0:00–0:20 — the one-line problem, on camera or voiceover over the hot/leafy parcel pair.
- 0:20–1:40 — screen recording: pick the hot parcel, show current score (F), move sliders
  to the proposed development, score gets worse, show the mitigation package appear,
  export the one-page review sheet.
- 1:40–2:30 — the ordinance-insertion point in one sentence, RMSE validation number on
  screen, pilot city named.
- 2:30–3:00 — commercialization line + team credits.
Record at 1080p, upload unlisted to YouTube, put the link in registration + on slide 3
as a QR code or URL.

---

## 7. Day-by-day timeline (today = Sept 13; hard deadline Sept 17, 11:59 PM EDT)

- **Day 1 (Sept 13, today):** Lock the 2 demo parcels + city. Pull all raw data
  (Sentinel-2, Landsat, WorldCover, Census, OSM). Get the training table assembled.
- **Day 2 (Sept 14):** Fit the regression, get the RMSE number, generate the precomputed
  lookup grid. Start the frontend skeleton (map + static parcel view, no sliders yet).
- **Day 3 (Sept 15):** Wire sliders to the lookup table, build the score gauge and
  mitigation panel, build the one-page review-sheet export. This is the core demo —
  freeze scope after today, no new features.
- **Day 4 (Sept 16):** Polish design language (colors/type per §2), record the prototype
  video, build the 5-slide deck, deploy to Vercel, dry-run the full demo twice end to end.
- **Day 5 (Sept 17):** Buffer day. Fix whatever broke in the dry run. Export PPTX with
  embedded fonts, confirm ≤10MB, name file exactly `TeamName_InstitutionName_Category.pptx`.
  **Submit well before 11:59 PM EDT — do not submit at the deadline.**
- **Sept 18:** Rehearse the 10-minute live pitch + anticipate the 5-minute Q&A
  (see risk register below for likely questions).
- **Sept 19–20:** Live presentation. Have the deployed URL, the local fallback, and the
  video all ready before you're called.

---

## 8. Risk register (rehearse these answers verbatim)

- **"This is a regression, not physics."** → It's a screening tool, like a traffic
  impact study is a screening estimate, not a traffic simulation. Validated to the
  reported RMSE, disclosed on the slide, mitigation recommendations kept conservative.
- **"Cities don't require this yet."** → Correct, and that's the wedge: voluntary first,
  piloted with one planning department, designed to slot into an ordinance as a new
  scored field — the form already exists, we're proposing one new column on it.
- **"Green gentrification."** → Real risk, named on the ethics slide: score relative to
  the block's own baseline, not city-wide, and tie any mitigation funding to the
  residents already living there, not to raising property values.
- **"Census data is sensitive."** → Block-group level only (never individual), used
  solely to weight equity scoring, never exposed as a queryable field to third parties.

---

## 9. Immediate next actions

1. Confirm team roster + institution name/logo (needed for slide 1 and file naming).
2. Pick the pilot city (recommend Philadelphia for the green-roof tax credit hook, or DC
   given local relevance) and the two demo parcels.
3. Decide `Category` for the filename — recommend `ClimateTech` or `UrbanSustainability`.
4. Start Day 1 data pulls today — the 4-day window is real and tight.
