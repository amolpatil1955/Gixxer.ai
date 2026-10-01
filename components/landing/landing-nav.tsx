"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonClassName } from "@/components/ui/button";
import { routes } from "@/lib/auth/routes";
import { mobileNavLinks, navLinks } from "@/lib/landing/content";
import { cn } from "@/lib/utils/cn";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Which anchored section is currently under the reader. */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      // A band across the upper-middle of the viewport decides.
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

const SECTION_IDS = navLinks.map((link) => link.href.slice(1));

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useActiveSection(SECTION_IDS);

  useMotionValueEvent(scrollY, "change", (latest) => setScrolled(latest > 32));

  // Close the sheet on resize to desktop and on Escape; lock the page behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 1024 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const ctas = signedIn ? (
    <Link href={routes.app} className={buttonClassName({ variant: "primary", size: "sm", className: "btn-sheen" })}>
      Open workspace
    </Link>
  ) : (
    <>
      <Link href={routes.login} className={buttonClassName({ variant: "ghost", size: "sm" })}>
        Sign in
      </Link>
      <Link href={routes.register} className={buttonClassName({ variant: "primary", size: "sm", className: "btn-sheen" })}>
        Get started
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      {/* Reading progress: a hairline that fills as you go. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px origin-left bg-ink-50/70"
        style={{ scaleX: progress }}
      />

      <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-5 sm:pt-4">
        <div
          className={cn(
            "rounded-2xl border transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500",
            scrolled || open ? "glass shadow-lift" : "border-transparent",
          )}
        >
          <nav className="flex h-14 items-center justify-between pl-4 pr-2.5 sm:pl-5" aria-label="Primary">
            <Link href={routes.home} aria-label="Gixxer.ai home" onClick={() => setOpen(false)} className="shrink-0">
              <Wordmark size="sm" />
            </Link>

            <ul className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => {
                const current = active === link.href.slice(1);
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      aria-current={current ? "location" : undefined}
                      className={cn(
                        "relative flex items-center rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                        current ? "text-ink-50" : "text-ink-300 hover:text-ink-50",
                      )}
                    >
                      {current ? (
                        <motion.span
                          layoutId="nav-active"
                          transition={{ type: "spring", stiffness: 380, damping: 34 }}
                          className="absolute inset-0 rounded-lg bg-ink-800/80"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="relative">{link.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>

            <div className="hidden items-center gap-2 lg:flex">
              <ThemeToggle />
              <span className="mx-1 h-5 w-px bg-line-strong" aria-hidden="true" />
              {ctas}
            </div>

            <div className="flex items-center gap-1.5 lg:hidden">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label={open ? "Close menu" : "Open menu"}
                className="flex size-10 items-center justify-center rounded-xl text-ink-100 transition-colors hover:bg-ink-800"
              >
                {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
              </button>
            </div>
          </nav>

          <AnimatePresence>
            {open ? (
              <motion.div
                id="mobile-menu"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.32, ease: EASE }}
                className="overflow-hidden lg:hidden"
              >
                <div className="max-h-[calc(100svh-6rem)] overflow-y-auto border-t border-line px-3 pb-5 pt-3">
                  <motion.ul
                    className="grid grid-cols-2 gap-1"
                    initial="hidden"
                    animate="visible"
                    transition={{ staggerChildren: 0.035, delayChildren: 0.08 }}
                  >
                    {mobileNavLinks.map((link) => (
                      <motion.li
                        key={link.href}
                        variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                        transition={{ duration: 0.35, ease: EASE }}
                      >
                        <a
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-xl px-3 py-3 text-[15px] font-medium text-ink-100 transition-colors hover:bg-ink-800"
                        >
                          {link.label}
                        </a>
                      </motion.li>
                    ))}
                  </motion.ul>
                  <div className="mt-4 flex flex-col gap-2 [&>a]:w-full">{ctas}</div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
