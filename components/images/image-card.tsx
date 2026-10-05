"use client";

import type { ReactNode } from "react";
import { GMark } from "@/components/brand/g-mark";
import { cn } from "@/lib/utils/cn";

/*
 * The one card every picture on the Images page uses: generated images, style
 * examples and reference photos. Same radius, border, aspect and overlay; the
 * slots differ. Pictures Gixxer made carry a small G mark; photographs from
 * elsewhere never do.
 */

interface ImageCardProps {
  src: string;
  alt: string;
  /** Accessible name of the open control. */
  openLabel: string;
  onOpen: () => void;
  /** Shown on the gradient at the foot of the card. */
  caption?: ReactNode;
  /** Controls in the top-right corner, shown on hover and focus. */
  actions?: ReactNode;
  /** A Gixxer-made picture: shows the brand mark. */
  branded?: boolean;
  selected?: boolean;
  /** Placeholder colour while the picture loads. */
  color?: string;
  className?: string;
  imageClassName?: string;
}

export function ImageCard({ src, alt, openLabel, onOpen, caption, actions, branded = false, selected = false, color, className, imageClassName }: ImageCardProps) {
  return (
    <div
      className={cn(
        "group relative aspect-[4/3] overflow-hidden rounded-2xl border bg-ink-900 transition-[border-color,transform] duration-200 hover:-translate-y-0.5",
        selected ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-line-strong",
        className,
      )}
      style={color ? { background: color } : undefined}
      data-image-card
    >
      <button type="button" onClick={onOpen} className="absolute inset-0 block h-full w-full" aria-label={openLabel} aria-pressed={selected || undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- our own authenticated route or Unsplash's CDN, sized by the grid */}
        <img src={src} alt={alt} className={cn("absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]", imageClassName)} loading="lazy" />
      </button>
      {caption ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/35 to-transparent p-3 pt-10">
          <div className="pointer-events-auto text-[12.5px] leading-snug text-white">{caption}</div>
        </div>
      ) : null}
      {branded ? (
        <span className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-1 text-white/90 backdrop-blur-sm" title="Made with Gixxer.ai">
          <GMark className="size-3" />
          <span className="sr-only">Made with Gixxer.ai</span>
        </span>
      ) : null}
      {actions ? <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">{actions}</div> : null}
    </div>
  );
}

/** The round control used in a card's corner. */
export const cardAction = "flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80 disabled:opacity-60";
