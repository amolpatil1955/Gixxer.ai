import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { routes } from "@/lib/auth/routes";
import { footerColumns, hero } from "@/lib/landing/content";

export function LandingFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="relative overflow-hidden border-t border-line px-5 pb-10 pt-16 sm:px-8 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 surface-dots opacity-40 mask-fade-t" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,2fr))] lg:gap-8">
          <div>
            <Wordmark size="md" />
            <p className="mt-5 max-w-sm text-pretty text-[15px] leading-relaxed text-ink-300">
              {hero.lines.join(" ")} Chat, images, documents and the chatbot on your website, with the model
              chosen for you.
            </p>
            <div className="mt-7 flex items-center gap-3">
              <ThemeToggle />
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-400">Theme</span>
            </div>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-400">{column.heading}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <a
                      href={link.href}
                      className="group inline-flex items-center gap-2 text-[14.5px] text-ink-300 transition-colors hover:text-ink-50"
                    >
                      <span className="h-px w-0 bg-ink-50 transition-all duration-300 group-hover:w-3" aria-hidden="true" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <nav aria-label="Account">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-400">Account</p>
            <ul className="mt-4 space-y-2.5">
              {signedIn ? (
                <li>
                  <Link href={routes.app} className="text-[14.5px] text-ink-300 transition-colors hover:text-ink-50">
                    Workspace
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link href={routes.login} className="text-[14.5px] text-ink-300 transition-colors hover:text-ink-50">
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link href={routes.register} className="text-[14.5px] text-ink-300 transition-colors hover:text-ink-50">
                      Create account
                    </Link>
                  </li>
                </>
              )}
              <li>
                <a href="#top" className="text-[14.5px] text-ink-300 transition-colors hover:text-ink-50">
                  Back to top
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Watermark: the wordmark at architectural scale, outlined, fading into the floor. */}
        <div
          className="pointer-events-none mt-16 select-none overflow-hidden mask-fade-b sm:mt-20"
          aria-hidden="true"
        >
          <p className="whitespace-nowrap font-display text-[24vw] font-black italic leading-[0.8] tracking-[-0.05em] text-outline sm:text-[19vw] lg:text-[15.5vw]">
            Gixxer.ai
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] tracking-wide text-ink-400">© {new Date().getFullYear()} Gixxer.ai</p>
          <p className="font-mono text-[11px] tracking-wide text-ink-400">Multi-model AI workspace</p>
        </div>
      </div>
    </footer>
  );
}
