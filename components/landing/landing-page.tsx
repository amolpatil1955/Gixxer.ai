import { Hero } from "./hero/hero";
import { LandingFooter } from "./landing-footer";
import { LandingNav } from "./landing-nav";
import { Capabilities } from "./sections/capabilities";
import { CredibilityStrip } from "./sections/credibility-strip";
import { DeployGuide } from "./sections/deploy-guide";
import { Faq } from "./sections/faq";
import { FinalCta } from "./sections/final-cta";
import { Knowledge } from "./sections/knowledge";
import { WorkspaceShowcase } from "./sections/workspace-showcase";

/**
 * The landing page, top to bottom. Every section is self-contained and reads
 * its copy from `lib/landing/content.ts`; this file only decides the order.
 */
export function LandingPage({ signedIn }: { signedIn: boolean }) {
  return (
    <div id="top" className="flex min-h-dvh flex-col overflow-x-clip">
      <a href="#main" className="sr-only z-50 rounded-lg bg-ink-50 px-4 py-2 text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <LandingNav signedIn={signedIn} />
      <main id="main" className="flex-1">
        <Hero signedIn={signedIn} />
        <CredibilityStrip />
        <WorkspaceShowcase />
        <Capabilities />
        <DeployGuide signedIn={signedIn} />
        <Knowledge />
        <Faq />
        <FinalCta signedIn={signedIn} />
      </main>
      <LandingFooter signedIn={signedIn} />
    </div>
  );
}
