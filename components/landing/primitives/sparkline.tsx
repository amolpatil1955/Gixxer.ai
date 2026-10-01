"use client";

import { useId, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils/cn";

interface SparklineProps {
  data: readonly number[];
  /** Accessible description of the series. */
  label: string;
  className?: string;
  /** Show a crosshair and value while the pointer is over the chart. */
  interactive?: boolean;
}

const W = 320;
const H = 96;
const PAD = 6;

/**
 * A single-series line with a soft area beneath it. One hue, a 2px line, the
 * latest point marked. Text stays in text tokens; only the mark carries the
 * series. Hover shows a crosshair and the value under the pointer.
 */
export function Sparkline({ data, label, className, interactive = true }: SparklineProps) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = Math.max(1, max - min);
  const step = (W - PAD * 2) / Math.max(1, data.length - 1);
  const points = data.map((value, index) => ({
    x: PAD + index * step,
    y: PAD + (1 - (value - min) / span) * (H - PAD * 2),
    value,
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${(points.at(-1)?.x ?? PAD).toFixed(1)} ${H - PAD} L${PAD} ${H - PAD} Z`;
  const last = points.at(-1);
  const active = hover === null ? null : points[hover];

  function onMove(event: PointerEvent<SVGSVGElement>) {
    if (!interactive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round((x - PAD) / step))));
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={cn("block h-24 w-full overflow-visible", className)}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-ink-50)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--color-ink-50)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Recessive baseline */}
      <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="var(--color-line-strong)" strokeWidth="1" />
      <path d={area} fill={`url(#${id}-fill)`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-ink-50)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {last ? (
        <g>
          <circle cx={last.x} cy={last.y} r="7" fill="var(--color-ink-950)" />
          <circle cx={last.x} cy={last.y} r="4" fill="var(--color-ink-50)" />
        </g>
      ) : null}
      {active ? (
        <g>
          <line
            x1={active.x}
            x2={active.x}
            y1={PAD}
            y2={H - PAD}
            stroke="var(--color-ink-400)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={active.x} cy={active.y} r="5" fill="var(--color-ink-50)" stroke="var(--color-ink-950)" strokeWidth="2" />
        </g>
      ) : null}
      {active ? (
        <text
          x={Math.min(W - 26, Math.max(26, active.x))}
          y={Math.max(14, active.y - 12)}
          textAnchor="middle"
          fill="var(--color-ink-100)"
          fontSize="12"
          fontFamily="var(--font-mono)"
          style={{ transform: "scale(1, 1)" }}
        >
          {active.value}
        </text>
      ) : null}
    </svg>
  );
}
