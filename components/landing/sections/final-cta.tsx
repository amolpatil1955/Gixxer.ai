"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { buttonClassName } from "@/components/ui/button";
import { routes } from "@/lib/auth/routes";
import { finalCta, landingSections } from "@/lib/landing/content";
import { useGsapEffect } from "@/lib/motion/gsap";
import { Magnetic } from "../primitives/magnetic";
import { Reveal } from "../primitives/reveal";

/** The last frame: a beam of light, the headline growing as it arrives, and the two things a visitor can do. */
export function FinalCta({ signedIn }: { signedIn: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);

  useGsapEffect(stage, ({ gsap, reduceMotion }) => {
    if (reduceMotion || !headline.current) return;
    gsap.fromTo(
      headline.current,
      { scale: 0.88, y: 30 },
      { scale: 1, y: 0, ease: "none", scrollTrigger: { trigger: stage.current, start: "top 90%", end: "center 55%", scrub: 0.6 } },
    );
  });

  return (
    <section id={landingSections.start} className="relative overflow-hidden border-t border-line px-5 pb-24 pt-20 sm:px-8 sm:pb-40 sm:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full light-beam" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-50" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 glow-warm" aria-hidden="true" />

      <div ref={stage} className="relative mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-4xl text-center">
          <h2 ref={headline} className="text-balance text-[52px] font-semibold leading-[0.95] tracking-[-0.05em] text-ink-50 sm:text-[84px] lg:text-[112px]">
            {finalCta.title} <span className="accent-serif text-[1.06em] text-ink-100">{finalCta.accent}</span>
          </h2>
          <p className="mx-auto mt-8 max-w-lg text-pretty text-[17px] leading-relaxed text-ink-300 sm:text-lg">{finalCta.description}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {signedIn ? (
              <Magnetic>
                <Link href={routes.app} className={buttonClassName({ variant: "primary", size: "lg", className: "btn-sheen sm:min-w-56" })}>
                  Open workspace
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Magnetic>
            ) : (
              <>
                <Magnetic>
                  <Link href={routes.register} className={buttonClassName({ variant: "primary", size: "lg", className: "btn-sheen sm:min-w-56" })}>
                    {finalCta.primary}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Magnetic>
                <Link href={routes.login} className={buttonClassName({ variant: "secondary", size: "lg", className: "sm:min-w-40" })}>
                  {finalCta.secondary}
                </Link>
              </>
            )}
          </div>
          {!signedIn ? <p className="mt-5 text-[13px] text-ink-400">{finalCta.reassurance}</p> : null}
        </Reveal>
      </div>
    </section>
  );
}
