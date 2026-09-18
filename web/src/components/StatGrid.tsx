export interface Stat {
  label: string;
  value: string;
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
      {stats.map((s) => (
        <div key={s.label} className="text-xs">
          <span className="block text-[10.5px] text-[var(--color-ink-soft)]">{s.label}</span>
          <span className="font-[var(--font-mono)] text-sm font-semibold">{s.value}</span>
        </div>
      ))}
    </div>
  );
}
