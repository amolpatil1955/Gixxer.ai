"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { decideHeroVisual, type HeroDecision } from "@/lib/motion/capabilities";
import { useGsapEffect } from "@/lib/motion/gsap";
import { useResolvedTheme } from "@/lib/theme/use-theme";
import { cn } from "@/lib/utils/cn";
import type { Pointer } from "./hero-scene";
import { HeroStatic } from "./hero-static";

// Three.js only ever loads in the browser, after the page is interactive.
const HeroScene = dynamic(() => import("./hero-scene").then((module) => module.HeroScene), { ssr: false });

/*
 * The device decision is an external fact about the browser, read through
 * useSyncExternalStore: the server snapshot renders the static image, the
 * client snapshot is computed once and refreshed if the visitor toggles
 * reduced motion while the page is open.
 */
const SERVER_SNAPSHOT: HeroDecision = { mode: "static", reason: "server", quality: "low" };
let clientSnapshot: HeroDecision | null = null;

function getSnapshot(): HeroDecision {
  clientSnapshot ??= decideHeroVisual();
  return clientSnapshot;
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = () => {
    clientSnapshot = decideHeroVisual();
    onChange();
  };
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}

/** Runs once the browser has a quiet moment, so the scene never competes with first paint. */
function whenIdle(callback: () => void): () => void {
  const idle: typeof window.requestIdleCallback | undefined = window.requestIdleCallback;
  if (typeof idle === "function") {
    const id = idle.call(window, callback, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 350);
  return () => window.clearTimeout(id);
}

/**
 * Chooses between the WebGL scene and the static composition, fades the scene
 * in over the static image once its first frame has rendered, stops the
 * scene entirely while the hero is off screen or the tab is hidden, and
 * drifts the whole visual as the page scrolls away from it.
 *
 * `data-hero-visual` and `data-hero-ready` report the decision and the first
 * rendered frame, which is what the end-to-end tests assert against.
 */
export function HeroVisual({ className }: { className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const drift = useRef<HTMLDivElement>(null);
  const pointer = useRef<Pointer>({ x: 0, y: 0 });
  const decision = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  const theme = useResolvedTheme();
  const [idle, setIdle] = useState(false);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const stop = whenIdle(() => {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--font-exo2").trim();
      const fonts = typeof document.fonts?.load === "function" && family ? document.fonts.load(`italic 900 64px ${family}`) : Promise.resolve();
      fonts
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) setIdle(true);
        });
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.05 });
    observer.observe(element);
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (decision.mode !== "scene") return;
    const onMove = (event: PointerEvent) => {
      pointer.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -((event.clientY / window.innerHeight) * 2 - 1),
      };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [decision.mode]);

  // Parallax: scroll-driven, so it costs nothing while the page is still.
  useGsapEffect(container, ({ gsap, reduceMotion }) => {
    if (reduceMotion || !drift.current) return;
    const section = container.current?.closest("section");
    if (!section) return;
    gsap.to(drift.current, {
      yPercent: 14,
      opacity: 0.2,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: 0.4 },
    });
  });

  const sceneMounted = decision.mode === "scene" && idle;
  const sceneShown = sceneMounted && ready;

  return (
    <div
      ref={container}
      className={cn("absolute inset-0", className)}
      aria-hidden="true"
      data-hero-visual={decision.mode}
      data-hero-reason={decision.reason}
      data-hero-ready={sceneShown || decision.mode === "static" ? "true" : "false"}
    >
      <div ref={drift} className="absolute inset-0">
        <HeroStatic className={cn("transition-opacity duration-1000", sceneShown ? "opacity-0" : "opacity-100")} />
        {sceneMounted ? (
          <div className={cn("absolute inset-0 transition-opacity duration-1000", sceneShown ? "opacity-100" : "opacity-0")}>
            <HeroScene pointer={pointer} active={visible && tabVisible} quality={decision.quality} theme={theme} onReady={() => setReady(true)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
