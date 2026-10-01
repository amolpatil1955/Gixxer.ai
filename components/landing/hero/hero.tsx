import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { buttonClassName } from "@/components/ui/button";
import { routes } from "@/lib/auth/routes";
import { hero, landingSections } from "@/lib/landing/content";
import { Magnetic } from "../primitives/magnetic";
import { HeroVisual } from "./hero-visual";

/**
 * The hero is a server component and its entrance is pure CSS. The copy is in
 * the initial HTML and starts animating at first paint, so the headline is not
 * held invisible waiting for JavaScript. Only the WebGL visual and the
 * magnetic button are client-side, and neither gates any content. Every
 * animation here runs once; nothing loops.
 */
const rise = (delay: number): CSSProperties => ({ animationDelay: `${delay}ms` });

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden" aria-labelledby="hero-title">
      {/* The relief sits to the right on desktop. On phones it fills the top of the screen and fades out before the copy. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[54svh] [mask-image:linear-gradient(to_bottom,black_45%,transparent_94%)] lg:inset-0 lg:left-[38%] lg:h-auto lg:[mask-image:none]">
        <HeroVisual />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-ink-950/0 via-ink-950/0 to-ink-950" />
      <div className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-ink-950 via-ink-950/60 to-transparent lg:block" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] light-beam opacity-70" aria-hidden="true" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-5 pb-16 pt-[44svh] sm:px-8 lg:justify-center lg:pb-28 lg:pt-36">
        <div className="max-w-3xl">
          <p
            className="inline-flex animate-rise items-center gap-2.5 rounded-full border border-line bg-ink-900/70 py-1.5 pl-2.5 pr-3.5 font-mono text-[10.5px] uppercase tracking-[0.28em] text-ink-300"
            style={rise(0)}
          >
            <span className="size-2 rounded-full bg-ink-50" aria-hidden="true" />
            {hero.eyebrow}
          </p>

          <h1 id="hero-title" className="mt-7 text-[46px] font-semibold leading-[0.95] tracking-[-0.045em] text-ink-50 sm:text-[72px] lg:text-[94px]">
            {hero.lines.map((line, index) => (
              <span key={line} className="block animate-rise" style={rise(70 + index * 80)}>
                {line}
              </span>
            ))}
            <span className="mt-1 block animate-rise" style={rise(70 + hero.lines.length * 80)}>
              <span className="accent-serif inline-block text-[1.08em] text-ink-100">{hero.accent}</span>
            </span>
          </h1>

          <p className="mt-8 max-w-xl animate-rise text-pretty text-[17px] leading-relaxed text-ink-300 sm:text-[18.5px]" style={rise(320)}>
            {hero.description}
          </p>

          <div className="mt-10 flex animate-rise flex-col gap-3 sm:flex-row sm:items-center" style={rise(400)}>
            <Magnetic>
              <Link
                href={signedIn ? routes.app : routes.register}
                className={buttonClassName({ variant: "primary", size: "lg", className: "btn-sheen w-full sm:min-w-48" })}
              >
                {signedIn ? "Open workspace" : hero.primaryCta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Magnetic>
            <a href={`#${landingSections.workspace}`} className={buttonClassName({ variant: "secondary", size: "lg", className: "sm:min-w-44" })}>
              {hero.secondaryCta}
            </a>
          </div>

          <ul aria-label="Capabilities" className="mt-12 flex animate-rise flex-wrap gap-x-7 gap-y-2 font-mono text-[11px] uppercase tracking-[0.28em] text-ink-400" style={rise(480)}>
            {hero.capabilities.map((item, index) => (
              <li key={item} className="flex items-center gap-3">
                {index > 0 ? <span className="size-1 rounded-full bg-ink-600" aria-hidden="true" /> : null}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-7 left-1/2 hidden -translate-x-1/2 lg:block">
        <a
          href={`#${landingSections.workspace}`}
          aria-label="Scroll to the workspace preview"
          style={rise(900)}
          className="pointer-events-auto flex animate-rise flex-col items-center gap-2 text-ink-500 transition-colors hover:text-ink-200"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.32em]">Scroll</span>
          <span className="flex size-9 items-center justify-center rounded-full border border-line">
            <ArrowDown className="size-3.5" aria-hidden="true" />
          </span>
        </a>
      </div>
    </section>
  );
}
