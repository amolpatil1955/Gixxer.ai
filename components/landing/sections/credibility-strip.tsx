import { credibility } from "@/lib/landing/content";
import { Reveal } from "../primitives/reveal";

const LABEL = "font-mono text-[10.5px] uppercase tracking-[0.3em] text-ink-400";

/**
 * What the product stands on. No customer logos, because there are no
 * customers to name yet: the providers, the formats and the places a bot can
 * live are the credible facts, so they get the typographic treatment.
 */
export function CredibilityStrip() {
  return (
    <>
    </>
    // <section aria-label="What Gixxer runs on" className="relative border-y border-line bg-ink-900/40">
    //   <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-line lg:block" aria-hidden="true" />
    //   <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,3fr)_minmax(0,3fr)] lg:gap-12 lg:py-14">
    //     <Reveal>
    //       <p className={LABEL}>{credibility.label}</p>
    //       <ul className="mt-5 flex flex-wrap gap-x-10 gap-y-6">
    //         {credibility.providers.map((provider) => (
    //           <li key={provider.name}>
    //             <p className="text-[26px] font-semibold leading-none tracking-[-0.035em] text-ink-50 sm:text-[30px]">
    //               {provider.name}
    //             </p>
    //             <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">{provider.role}</p>
    //           </li>
    //         ))}
    //       </ul>
    //     </Reveal>

    //     <Reveal delay={0.08}>
    //       <p className={LABEL}>{credibility.formatsLabel}</p>
    //       <ul className="mt-5 flex flex-wrap gap-2">
    //         {credibility.formats.map((format) => (
    //           <li
    //             key={format}
    //             className="rounded-lg border border-line-strong bg-ink-950/60 px-3 py-1.5 font-mono text-[12px] tracking-wide text-ink-100"
    //           >
    //             {format}
    //           </li>
    //         ))}
    //       </ul>
    //     </Reveal>

    //     <Reveal delay={0.16}>
    //       <p className={LABEL}>{credibility.embedLabel}</p>
    //       <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px] text-ink-200">
    //         {credibility.embeds.map((target) => (
    //           <li key={target} className="flex items-center gap-2">
    //             <span className="size-1 rounded-full bg-ink-500" aria-hidden="true" />
    //             {target}
    //           </li>
    //         ))}
    //       </ul>
    //       <p className="mt-4 text-[12.5px] text-ink-400">{credibility.note}</p>
    //     </Reveal>
    //   </div>
    // </section>
  );
}
