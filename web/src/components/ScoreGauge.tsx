import { GRADE_COLOR } from "../lib/model";
import type { ScoreResult } from "../types";

const CIRCUMFERENCE = 283;

export function ScoreGauge({ result }: { result: ScoreResult }) {
  const color = GRADE_COLOR[result.grade];
  const offset = CIRCUMFERENCE * (1 - result.score / 100);

  return (
    <div className="relative w-[130px] shrink-0">
      <svg viewBox="0 0 200 110" className="w-full">
        <path
          d="M10,100 A90,90 0 0,1 190,100"
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={14}
        />
        <path
          d="M10,100 A90,90 0 0,1 190,100"
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.35s ease, stroke 0.35s ease" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1.5 text-center">
        <div className="font-[var(--font-head)] font-bold text-[30px] leading-none" style={{ color }}>
          {result.grade}
        </div>
        <div className="text-[9px] tracking-[1px] text-[var(--color-ink-soft)]">GRADE</div>
      </div>
    </div>
  );
}
