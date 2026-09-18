import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { useAppStore } from "../store";
import { lstColor, predictDeltaLST } from "../lib/model";
import type { Parcel } from "../types";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>({});
  const clickMarkerRef = useRef<maplibregl.Marker | null>(null);

  const data = useAppStore((s) => s.data);
  const currentParcelId = useAppStore((s) => s.currentParcelId);
  const slider = useAppStore((s) => s.slider);
  const liveParcels = useAppStore((s) => s.liveParcels);
  const apiUp = useAppStore((s) => s.apiUp);

  // Mount the map + static layers once real data is available.
  useEffect(() => {
    if (!data || !containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // OpenFreeMap's "positron" vector style: free, unlimited, no API key.
      // (Both prior basemaps broke in production under real traffic: CARTO's
      // raster tiles now require a paid API key for anonymous requests, and
      // Esri's free World_Dark_Gray_Base throttles bursts of concurrent tile
      // requests — the exact pattern a real page load makes — and silently
      // serves a "Map data not yet available" placeholder tile instead of an
      // error. OpenFreeMap is sponsored infra built specifically to have no
      // such limits.)
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-75.155, 39.978],
      zoom: 12.2,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.resize();
      // Real citywide sample points (from the same 450-point pipeline run that
      // fit the regression), rendered as a native MapLibre circle layer colored
      // by observed LST — a plain GeoJSON source/layer, no separate WebGL canvas
      // stacked on top, so there's no compositing risk with the base map.
      map.addSource("sample-points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: data.sample_points.map((d) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [d.lng, d.lat] },
            properties: { lst: d.lst },
          })),
        },
      });
      map.addLayer({
        id: "sample-points",
        type: "circle",
        source: "sample-points",
        paint: {
          "circle-radius": 5,
          "circle-opacity": 0.55,
          "circle-color": [
            "interpolate", ["linear"], ["get", "lst"],
            28, "#1B7A72",
            34, "#EDE7D9",
            40, "#D98E2B",
            46, "#B23A2E",
          ],
        },
      });

      data.parcels.forEach((p) => addParcelMarker(map, markersRef, p, false));
    });

    map.on("error", (e) => {
      console.error("MapLibre error (likely a tile source failing to load):", e.error);
    });

    map.on("click", (e) => {
      // Ignore clicks that landed on an existing marker (they have their own handler).
      if ((e.originalEvent.target as HTMLElement)?.closest(".shadecode-marker")) return;
      // The live-lookup API isn't reachable on a hosted deploy (it needs
      // rasterio/gdal, which can't run on Vercel) — silently no-op instead of
      // dropping a pending marker that's guaranteed to fail with an error toast.
      if (!useAppStore.getState().apiUp) return;
      const { lat, lng } = e.lngLat;

      clickMarkerRef.current?.remove();
      const el = document.createElement("div");
      el.className = "shadecode-pending-marker";
      el.style.cssText =
        "width:16px;height:16px;border-radius:50%;border:2px solid #fff;background:#3E7CB1;box-shadow:0 0 0 6px rgba(62,124,177,0.35);animation:shadecode-pulse 1s infinite;";
      clickMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);

      useAppStore.getState().fetchLive(lat, lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Add a marker for each newly-fetched live parcel.
  useEffect(() => {
    if (!mapRef.current) return;
    liveParcels.forEach((p) => {
      if (!markersRef.current[p.id]) addParcelMarker(mapRef.current!, markersRef, p, true);
    });
    clickMarkerRef.current?.remove();
    clickMarkerRef.current = null;
  }, [liveParcels]);

  // Recolor the current parcel's marker as sliders move, and fly to it on selection.
  useEffect(() => {
    if (!data || !currentParcelId) return;
    const parcel = [...data.parcels, ...liveParcels].find((p) => p.id === currentParcelId) as Parcel | undefined;
    if (!parcel) return;

    const deltaLST = predictDeltaLST(data.model_coefficients, parcel, slider.impervious, slider.canopy, slider.albedo);
    const rec = markersRef.current[parcel.id];
    if (rec) rec.el.style.background = lstColor(parcel.lst + deltaLST);
  }, [data, currentParcelId, slider, liveParcels]);

  useEffect(() => {
    if (!data || !currentParcelId || !mapRef.current) return;
    const parcel = [...data.parcels, ...liveParcels].find((p) => p.id === currentParcelId);
    if (!parcel) return;
    mapRef.current.flyTo({ center: [parcel.lng, parcel.lat], zoom: 15.5, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParcelId]);

  // Inline styles, not Tailwind's `absolute inset-0` classes: Tailwind v4 emits
  // utilities inside a CSS @layer, and MapLibre's own stylesheet sets
  // `.maplibregl-map { position: relative }` as unlayered CSS — unlayered rules
  // always win over layered ones regardless of source order, so the Tailwind
  // classes silently lost and this div (and the map inside it) collapsed to
  // zero height. Inline styles aren't subject to layering and always win.
  return (
    <div
      ref={containerRef}
      className={apiUp ? "cursor-crosshair" : ""}
      style={{ position: "absolute", inset: 0 }}
    />
  );
}

function addParcelMarker(
  map: maplibregl.Map,
  markersRef: React.MutableRefObject<Record<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>,
  p: Parcel,
  isLive: boolean,
) {
  const el = document.createElement("div");
  el.className = "shadecode-marker";
  el.style.width = "26px";
  el.style.height = "26px";
  el.style.borderRadius = "50%";
  el.style.border = isLive ? "2px solid var(--color-heat-warn, #D98E2B)" : "2px solid rgba(255,255,255,0.9)";
  el.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.35)";
  el.style.cursor = "pointer";
  el.style.background = lstColor(p.lst);
  el.title = p.name;
  el.onclick = (ev) => {
    ev.stopPropagation();
    useAppStore.getState().selectParcel(p.id);
  };
  const marker = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
  markersRef.current[p.id] = { marker, el };
}
