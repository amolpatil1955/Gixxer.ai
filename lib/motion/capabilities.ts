/**
 * Decides whether the visitor's device should run the heavy hero visual.
 * Runs in the browser only; on the server there is no device to ask.
 */
export type VisualQuality = "high" | "low";

export type HeroDecisionReason =
  | "ok"
  | "server"
  | "reduced-motion"
  | "reduced-data"
  | "weak-device"
  | "no-webgl"
  | "software-gl";

export interface HeroDecision {
  mode: "scene" | "static";
  reason: HeroDecisionReason;
  quality: VisualQuality;
}

/**
 * Opt back into the WebGL scene on a machine that would otherwise be refused.
 * Exists so the 3D hero can be verified in headless browsers, which render
 * through SwiftShader. It can only ever turn the richer visual on.
 */
const FORCE_KEY = "gixxer-force-webgl";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Rendering the hero through a CPU rasteriser (SwiftShader, llvmpipe, Mesa
 * software) costs hundreds of milliseconds of main thread just to compile the
 * shader, which is exactly the case the static fallback exists for.
 */
function isSoftwareRenderer(renderer: string): boolean {
  return /swiftshader|llvmpipe|software|microsoft basic render|generic renderer/i.test(renderer);
}

interface GlProbe {
  supported: boolean;
  renderer: string;
}

/** One throwaway context answers both "is there WebGL" and "is it real hardware". */
function probeWebGl(): GlProbe {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { supported: false, renderer: "" };

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? "")
      : String(gl.getParameter(gl.RENDERER) ?? "");

    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { supported: true, renderer };
  } catch {
    return { supported: false, renderer: "" };
  }
}

function forced(): boolean {
  try {
    return localStorage.getItem(FORCE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Lower particle counts and pixel ratio on phones and small CPUs. */
export function pickVisualQuality(): VisualQuality {
  if (typeof window === "undefined") return "low";
  const smallScreen = window.innerWidth < 900;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  return smallScreen || fewCores ? "low" : "high";
}

/** The full decision, with the reason kept so it can be surfaced for debugging. */
export function decideHeroVisual(): HeroDecision {
  const quality = pickVisualQuality();
  if (typeof window === "undefined") return { mode: "static", reason: "server", quality };

  const override = forced();
  if (!override) {
    if (prefersReducedMotion()) return { mode: "static", reason: "reduced-motion", quality };
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) {
      return { mode: "static", reason: "reduced-data", quality };
    }
    const nav = navigator as Navigator & { deviceMemory?: number };
    if ((nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) < 2) {
      return { mode: "static", reason: "weak-device", quality };
    }
  }

  const gl = probeWebGl();
  if (!gl.supported) return { mode: "static", reason: "no-webgl", quality };
  if (!override && isSoftwareRenderer(gl.renderer)) {
    return { mode: "static", reason: "software-gl", quality };
  }

  return { mode: "scene", reason: "ok", quality };
}
