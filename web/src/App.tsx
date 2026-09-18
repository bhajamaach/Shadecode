import { useEffect } from "react";
import { useAppStore } from "./store";
import { MapView } from "./components/MapView";
import { ParcelPicker } from "./components/ParcelPicker";
import { ReviewSheet } from "./components/ReviewSheet";

function TopBar() {
  const count = useAppStore((s) => s.data?.parcels.length ?? 0);
  return (
    <header className="no-print h-14 flex items-center justify-between px-5 bg-[var(--color-bg)] text-[var(--color-paper)] border-b border-[#262b35]">
      <div className="flex items-baseline gap-2.5">
        <span className="text-[var(--color-heat-warn)] text-lg">◈</span>
        <span className="font-[var(--font-head)] font-bold text-[17px] tracking-[0.2px]">ShadeCode</span>
        <span className="text-[#8A93A3] text-xs">Heat Impact Review Instrument — live satellite data prototype</span>
      </div>
      <div className="font-[var(--font-mono)] text-xs text-[#8A93A3]">{count} parcels loaded</div>
    </header>
  );
}

function MapLegend() {
  const meta = useAppStore((s) => s.data?.meta);
  if (!meta) return null;
  return (
    <div className="no-print absolute left-4 bottom-4 z-[5] bg-[rgba(18,21,26,0.9)] text-[var(--color-paper)] px-3.5 py-2.5 rounded-md text-[11px] border border-[#2a2f3a] max-w-[260px]">
      <div className="font-[var(--font-mono)] mb-1.5 text-[#C7CCD6]">Surface Temperature (LST)</div>
      <div className="flex items-center gap-2 mb-2">
        <span>Cool</span>
        <div className="w-[120px] h-2 rounded-full bg-[linear-gradient(90deg,#1B7A72,#EDE7D9,#D98E2B,#B23A2E)]" />
        <span>Hot</span>
      </div>
      <div className="text-[9.5px] text-[#8A93A3] leading-tight">
        {meta.landsat_scene} ({meta.landsat_date}) · {meta.sentinel_scene.slice(0, 20)}… ({meta.sentinel_date})
      </div>
    </div>
  );
}

function ClickHint() {
  const apiUp = useAppStore((s) => s.apiUp);
  const liveLoading = useAppStore((s) => s.liveLoading);
  const refreshApiHealth = useAppStore((s) => s.refreshApiHealth);

  useEffect(() => {
    refreshApiHealth();
    const id = setInterval(refreshApiHealth, 15000);
    return () => clearInterval(id);
  }, [refreshApiHealth]);

  // Only surface this when the live-lookup API is actually reachable (i.e.
  // running locally) — on a hosted deploy it's always offline (it depends on
  // rasterio/gdal, which can't run on Vercel), and a banner telling visitors
  // to run a uvicorn command they have no way to act on just looks broken.
  if (!apiUp) return null;

  return (
    <div className="no-print absolute top-4 right-4 z-[5] bg-[rgba(18,21,26,0.9)] text-[11px] px-3 py-2 rounded-md border border-[#2a2f3a] max-w-[220px]">
      <span className="text-[#C7CCD6]">
        {liveLoading ? (
          <span className="text-[var(--color-accent)]">Reading live satellite data…</span>
        ) : (
          <>🛰️ Click anywhere on the map to pull real satellite + Census data for that exact point.</>
        )}
      </span>
    </div>
  );
}

function LiveErrorToast() {
  const liveError = useAppStore((s) => s.liveError);
  const dismiss = useAppStore((s) => s.dismissLiveError);
  if (!liveError) return null;
  return (
    <div className="no-print absolute bottom-20 left-1/2 -translate-x-1/2 z-[6] bg-[var(--color-heat-hazard)] text-white text-[12px] px-4 py-2 rounded-md shadow-lg max-w-[360px] text-center">
      {liveError}
      <button onClick={dismiss} className="block mx-auto mt-1 text-[10px] underline opacity-80">
        dismiss
      </button>
    </div>
  );
}

export default function App() {
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const data = useAppStore((s) => s.data);
  const setData = useAppStore((s) => s.setData);
  const setError = useAppStore((s) => s.setError);

  useEffect(() => {
    fetch("/data/model.json")
      .then((r) => {
        if (!r.ok) throw new Error(`model.json fetch failed: ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [setData, setError]);

  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <main className="flex-1 flex min-h-0">
        <section className="relative flex-[1.4] min-w-0 bg-[var(--color-bg)]">
          {data && (
            <>
              <MapView />
              <MapLegend />
              <ParcelPicker />
              <ClickHint />
              <LiveErrorToast />
            </>
          )}
          {loading && <CenterMessage text="Loading real satellite + Census data…" />}
          {error && <CenterMessage text={`Failed to load model.json: ${error}`} isError />}
        </section>

        <section className="w-[460px] shrink-0 bg-[#0c0e12] overflow-y-auto p-4 print-fullbleed">
          {data && <ReviewSheet />}
        </section>
      </main>
    </div>
  );
}

function CenterMessage({ text, isError }: { text: string; isError?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className={`text-sm font-[var(--font-mono)] px-4 text-center ${isError ? "text-[var(--color-heat-hazard)]" : "text-[#8A93A3]"}`}>
        {text}
      </div>
    </div>
  );
}
