import { cn } from "@/lib/utils/cn";
import { Reveal } from "./reveal";

interface SectionHeadingProps {
  /** Two-digit section number, shown beside the eyebrow like a chapter mark. */
  index?: string;
  eyebrow: string;
  title: string;
  /** The italic serif phrase that finishes the headline. */
  accent?: string;
  description?: string;
  align?: "left" | "center";
  size?: "md" | "lg" | "xl";
  as?: "h2" | "h3";
  className?: string;
  /** Renders the accent on its own line instead of inline. */
  accentBreak?: boolean;
}

const SIZE: Record<NonNullable<SectionHeadingProps["size"]>, string> = {
  md: "text-[34px] sm:text-[46px] lg:text-[56px]",
  lg: "text-[40px] sm:text-[58px] lg:text-[72px]",
  xl: "text-[44px] sm:text-[68px] lg:text-[92px]",
};

/**
 * The editorial header every section starts with: a numbered eyebrow, a
 * headline that ends in an italic serif phrase, and one line of context.
 * Sections differ in what follows, never in this rhythm.
 */
export function SectionHeading({
  index,
  eyebrow,
  title,
  accent,
  description,
  align = "left",
  size = "md",
  as: Heading = "h2",
  className,
  accentBreak = false,
}: SectionHeadingProps) {
  return (
    <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      <p
        className={cn(
          "flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.32em] text-ink-400",
          align === "center" && "justify-center",
        )}
      >
        {index ? (
          <>
            <span className="text-ink-300">{index}</span>
            <span className="h-px w-8 bg-line-strong" aria-hidden="true" />
          </>
        ) : null}
        <span>{eyebrow}</span>
      </p>
      <Heading
        className={cn(
          "mt-5 text-balance font-semibold leading-[0.98] tracking-[-0.04em] text-ink-50",
          SIZE[size],
        )}
      >
        {title}
        {accent ? (
          <>
            {" "}
            {accentBreak ? <br /> : null}
            <span className="accent-serif text-[1.06em] text-ink-100">{accent}</span>
          </>
        ) : null}
      </Heading>
      {description ? (
        <p
          className={cn(
            "mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-ink-300 sm:text-[18px]",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
