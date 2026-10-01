import { cn } from "@/lib/utils/cn";

/**
 * The hero visual without WebGL: a sphere of dots in plain CSS, with no
 * lines or orbits. It is the placeholder while the scene loads, and the
 * final image for reduced-motion visitors and devices that should not run a
 * 3D scene. Nothing in it moves.
 */
export function HeroStatic({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center", className)} aria-hidden="true">
      <div className="relative aspect-square w-[72vmin] max-w-175 lg:w-[78vmin]">
        <div className="absolute inset-[14%] rounded-full glow-warm blur-3xl" />
        {/* The lit side of the sphere */}
        <div
          className="absolute inset-[26%] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 38% 34%, color-mix(in oklab, var(--color-ink-50) 22%, transparent), color-mix(in oklab, var(--color-ink-50) 4%, transparent) 55%, transparent 72%)",
          }}
        />
        {/* Dense dots, fading toward the rim so the ball reads as round */}
        <div
          className="absolute inset-[26%] rounded-full"
          style={{
            backgroundImage: "radial-gradient(color-mix(in oklab, var(--color-ink-50) 75%, transparent) 0.8px, transparent 1.3px)",
            backgroundSize: "7px 7px",
            maskImage: "radial-gradient(circle at 42% 38%, black 20%, rgba(0,0,0,0.35) 58%, transparent 71%)",
          }}
        />
        {/* A sparser outer shell of dust */}
        <div
          className="absolute inset-[6%] rounded-full opacity-50"
          style={{
            backgroundImage: "radial-gradient(color-mix(in oklab, var(--color-ink-50) 55%, transparent) 0.7px, transparent 1.1px)",
            backgroundSize: "23px 19px",
            maskImage: "radial-gradient(circle, transparent 38%, black 50%, transparent 72%)",
          }}
        />
      </div>
    </div>
  );
}
