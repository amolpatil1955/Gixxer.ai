import { cn } from "@/lib/utils/cn";

type WordmarkSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<WordmarkSize, string> = {
  sm: "text-[22px]",
  md: "text-[34px]",
  lg: "text-[48px] sm:text-[60px]",
  xl: "text-[56px] sm:text-[76px] xl:text-[92px]",
};

interface WordmarkProps {
  size?: WordmarkSize;
  className?: string;
}

/**
 * The Gixxer.ai wordmark: heavy italic display type sliced by a shallow speed
 * slash, with two motion trails escaping to the right. The slash is cut out of
 * the glyphs by the `wordmark-slash` utility and the trails sit outside them,
 * so the mark stays sharp from 22px to 92px and the text stays real text.
 */
export function Wordmark({ size = "md", className }: WordmarkProps) {
  return (
    <span
      className={cn(
        "relative inline-flex items-baseline font-display font-black italic leading-none tracking-[-0.045em] text-ink-50 select-none",
        SIZE_CLASSES[size],
        className,
      )}
      aria-label="Gixxer.ai"
    >
      <span aria-hidden="true" className="wordmark-slash inline-flex items-baseline">
        <span>Gixxer</span>
        <span className="text-ink-300">.ai</span>
      </span>
      <span aria-hidden="true" className="pointer-events-none absolute left-full top-0 h-full w-0">
        <span className="absolute left-[0.05em] top-[34%] h-[0.035em] w-[0.30em] origin-left rotate-[-12deg] rounded-full bg-ink-50" />
        <span className="absolute left-[0.10em] top-[52%] h-[0.028em] w-[0.18em] origin-left rotate-[-12deg] rounded-full bg-ink-300" />
      </span>
    </span>
  );
}
