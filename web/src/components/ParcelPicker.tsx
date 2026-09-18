import { useAppStore } from "../store";

export function ParcelPicker() {
  const parcels = useAppStore((s) => s.data?.parcels ?? []);
  const liveParcels = useAppStore((s) => s.liveParcels);
  const currentParcelId = useAppStore((s) => s.currentParcelId);
  const selectParcel = useAppStore((s) => s.selectParcel);

  return (
    <div className="absolute top-4 left-4 z-[5] flex flex-col gap-1.5 max-h-[calc(100%-32px)] overflow-y-auto">
      {parcels.map((p) => (
        <ParcelButton key={p.id} p={p} active={p.id === currentParcelId} onClick={() => selectParcel(p.id)} />
      ))}
      {liveParcels.length > 0 && (
        <div className="text-[9.5px] uppercase tracking-wide text-[#8A93A3] font-[var(--font-mono)] mt-1 px-1">
          Live-picked
        </div>
      )}
      {liveParcels.map((p) => (
        <ParcelButton key={p.id} p={p} active={p.id === currentParcelId} onClick={() => selectParcel(p.id)} live />
      ))}
    </div>
  );
}

function ParcelButton({
  p,
  active,
  onClick,
  live,
}: {
  p: { id: string; name: string; neighborhood: string; lst: number };
  active: boolean;
  onClick: () => void;
  live?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left text-[12.5px] px-3 py-2 rounded-md border min-w-[220px] cursor-pointer transition-colors ${
        active
          ? "border-[var(--color-accent)] bg-[rgba(62,124,177,0.22)] text-white"
          : "border-[#2a2f3a] bg-[rgba(18,21,26,0.88)] text-[#C7CCD6]"
      }`}
    >
      {live && <span className="text-[var(--color-heat-warn)] mr-1">●</span>}
      {p.name}
      <small className="block text-[10.5px] text-[#8A93A3] mt-0.5">
        {p.neighborhood} · LST {p.lst.toFixed(1)}°C
      </small>
    </button>
  );
}
