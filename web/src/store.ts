import { create } from "zustand";
import type { ModelData, Parcel, SliderState } from "./types";
import { fetchLiveParcel, LiveParcelError } from "./lib/api";

interface AppState {
  data: ModelData | null;
  loading: boolean;
  error: string | null;
  currentParcelId: string | null;
  slider: SliderState;
  liveParcels: Parcel[];
  liveLoading: boolean;
  liveError: string | null;
  setData: (data: ModelData) => void;
  setError: (err: string) => void;
  selectParcel: (id: string) => void;
  setSlider: (patch: Partial<SliderState>) => void;
  currentParcel: () => Parcel | null;
  allParcels: () => Parcel[];
  fetchLive: (lat: number, lon: number) => Promise<void>;
  dismissLiveError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  data: null,
  loading: true,
  error: null,
  currentParcelId: null,
  slider: { impervious: 0, canopy: 0, albedo: 0 },
  liveParcels: [],
  liveLoading: false,
  liveError: null,

  setData: (data) => {
    // Start on the hottest parcel — the pitch reads instantly.
    const hottest = [...data.parcels].sort((a, b) => b.lst - a.lst)[0];
    set({
      data,
      loading: false,
      currentParcelId: hottest.id,
      slider: { impervious: hottest.impervious, canopy: hottest.canopy, albedo: hottest.albedo },
    });
  },
  setError: (err) => set({ error: err, loading: false }),

  selectParcel: (id) => {
    const p = get().allParcels().find((p) => p.id === id);
    if (!p) return;
    set({
      currentParcelId: id,
      slider: { impervious: p.impervious, canopy: p.canopy, albedo: p.albedo },
    });
  },

  setSlider: (patch) => set((s) => ({ slider: { ...s.slider, ...patch } })),

  currentParcel: () => {
    const { currentParcelId } = get();
    if (!currentParcelId) return null;
    return get().allParcels().find((p) => p.id === currentParcelId) ?? null;
  },

  allParcels: () => [...(get().data?.parcels ?? []), ...get().liveParcels],

  fetchLive: async (lat, lon) => {
    set({ liveLoading: true, liveError: null });
    try {
      const parcel = await fetchLiveParcel(lat, lon);
      set((s) => ({
        liveParcels: [...s.liveParcels.filter((p) => p.id !== parcel.id), parcel],
        currentParcelId: parcel.id,
        slider: { impervious: parcel.impervious, canopy: parcel.canopy, albedo: parcel.albedo },
        liveLoading: false,
      }));
    } catch (e) {
      const msg = e instanceof LiveParcelError ? e.message : "Live parcel API unreachable — is backend/main.py running?";
      set({ liveLoading: false, liveError: msg });
    }
  },

  dismissLiveError: () => set({ liveError: null }),
}));
