import type { MitigationPackage } from "../types";
import { fmtMoney } from "../lib/model";

export function MitigationPanel({ pkg, deltaLST }: { pkg: MitigationPackage; deltaLST: number }) {
  if (deltaLST <= 0.5) {
    return <div className="text-xs italic text-[var(--color-ink-soft)]">No mitigation required at current proposed design.</div>;
  }

  return (
    <div>
      <ul className="list-none m-0 p-0">
        {pkg.items.map((item) => (
          <li key={item.name} className="flex justify-between items-center py-2 border-b border-dashed border-[var(--color-line)] text-xs last:border-b-0">
            <span className="flex-1">{item.name}</span>
            <span className="font-[var(--font-mono)] text-[var(--color-ink-soft)] ml-2.5 whitespace-nowrap">{fmtMoney(item.cost)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-2 border-t border-[var(--color-ink)] flex justify-between text-xs font-semibold">
        <span>Total to clear threshold</span>
        <span>{fmtMoney(pkg.totalCost)}</span>
      </div>
      <div className="mt-1.5 text-[11.5px] text-[var(--color-heat-cool)]">
        {pkg.ok
          ? `✓ Brings block back under threshold (est. cooling ${pkg.achieved.toFixed(1)} °C)${pkg.paybackYears ? ` · ${pkg.paybackYears.toFixed(1)} yr payback` : ""}`
          : "Partial mitigation — additional measures recommended"}
      </div>
    </div>
  );
}
