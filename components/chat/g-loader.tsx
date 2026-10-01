"use client";

import { GMark } from "@/components/brand/g-mark";
import { Star } from "@/components/images/sparkles";

/**
 * The one loading state for a reply: the Gixxer G at the centre of a small
 * ring, a thin arc of light running around it, and two tiny sparkles. Every
 * moving part is a CSS transform or opacity animation.
 */
export function GLoader({ label = "Gixxer is working" }: { label?: string }) {
  return (
    <span className="g-loader" role="status" aria-label={label}>
      <span className="g-ring" aria-hidden="true" />
      <span className="g-ring g-ring-inner" aria-hidden="true" />
      <span className="g-arc" aria-hidden="true" />
      <span className="g-mark" aria-hidden="true">
        <GMark className="size-[15px]" />
      </span>
      <span className="g-spark" style={{ top: 1, right: 2, width: 7, height: 7 }} aria-hidden="true">
        <Star className="h-full w-full" />
      </span>
      <span className="g-spark" style={{ bottom: 3, left: 1, width: 5, height: 5, animationDelay: "0.8s" }} aria-hidden="true">
        <Star className="h-full w-full" />
      </span>
    </span>
  );
}
