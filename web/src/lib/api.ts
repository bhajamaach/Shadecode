import type { Parcel } from "../types";

// Points at the local FastAPI live-parcel server (backend/main.py). Override
// with VITE_API_BASE if it's deployed somewhere else.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export class LiveParcelError extends Error {}

export async function fetchLiveParcel(lat: number, lon: number): Promise<Parcel> {
  const url = `${API_BASE}/api/parcel?lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new LiveParcelError(body?.detail ?? `Live parcel lookup failed (${res.status})`);
  }
  return res.json();
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
