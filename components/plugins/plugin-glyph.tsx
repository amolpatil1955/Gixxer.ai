import { CalendarClock, Globe, Library, Puzzle } from "lucide-react";
import { BRAND_MARKS } from "@/components/landing/primitives/brand-marks";
import { cn } from "@/lib/utils/cn";

/*
 * Plugin tiles in colour. Built-in plugins get a tinted tile and an icon;
 * services get their own mark in their brand colour (Simple Icons paths,
 * CC0; each trademark belongs to its owner and names the service only).
 */

const BUILT_IN: Record<string, { Icon: typeof Globe; from: string; to: string }> = {
  "web-reader": { Icon: Globe, from: "#2f7cf6", to: "#7c3aed" },
  library: { Icon: Library, from: "#f59e0b", to: "#ef4444" },
  datetime: { Icon: CalendarClock, from: "#10b981", to: "#0ea5e9" },
};

const BRANDED: Record<string, { mark: keyof typeof BRAND_MARKS; color: string; bg: string }> = {
  slack: { mark: "slack", color: "#ffffff", bg: "#4a154b" },
  "google-calendar": { mark: "googlecalendar", color: "#ffffff", bg: "#4285f4" },
  cloudflare: { mark: "cloudflare", color: "#ffffff", bg: "#f6821f" },
  n8n: { mark: "n8n", color: "#ffffff", bg: "#ea4b71" },
};

function GmailMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#fff" d="M3 6.5v11h3.5v-6.6L12 15l5.5-4.1v6.6H21v-11L12 13.2z" />
      <path fill="#EA4335" d="M12 13.2 3 6.5l1.4-1.1L12 10.9l7.6-5.5L21 6.5z" />
      <path fill="#FBBC04" d="M3 6.5 4.4 5.4 6.5 7v3.9L3 8.3z" />
      <path fill="#34A853" d="M21 6.5 19.6 5.4 17.5 7v3.9L21 8.3z" />
      <path fill="#4285F4" d="M6.5 10.9v6.6H3V8.3z" />
      <path fill="#188038" d="M17.5 10.9v6.6H21V8.3z" />
    </svg>
  );
}

function DriveMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#0066DA" d="m8.3 3.5-6 10.4 3.6 6.2 6-10.4z" />
      <path fill="#00AC47" d="M8.3 3.5h7.4l6 10.4h-7.4z" />
      <path fill="#FFBA00" d="m2.3 13.9 3.6 6.2h12.2l3.6-6.2z" />
      <path fill="#00832D" d="m8.3 3.5 3.7 6.4 3.7-6.4z" opacity=".6" />
    </svg>
  );
}

/** A coloured tile with the plugin's icon. `bare` renders the icon alone. */
export function PluginGlyph({ id, bare = false, className }: { id: string; bare?: boolean; className?: string }) {
  const builtIn = BUILT_IN[id];
  const branded = BRANDED[id];
  const tile = cn("flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]", className);
  if (branded) {
    const icon = (
      <svg viewBox="0 0 24 24" fill={branded.color} className="size-5" aria-hidden="true">
        <path d={BRAND_MARKS[branded.mark].path} />
      </svg>
    );
    return bare ? icon : (
      <span className={tile} style={{ background: branded.bg }} aria-hidden="true">
        {icon}
      </span>
    );
  }
  if (id === "gmail" || id === "google-drive") {
    const icon = id === "gmail" ? <GmailMark /> : <DriveMark />;
    return bare ? icon : (
      <span className={cn(tile, "bg-white")} aria-hidden="true">
        {icon}
      </span>
    );
  }
  const Icon = builtIn?.Icon ?? Puzzle;
  if (bare) return <Icon className={cn("size-5", className)} aria-hidden="true" />;
  return (
    <span className={tile} style={{ background: `linear-gradient(135deg, ${builtIn?.from ?? "#444"}, ${builtIn?.to ?? "#222"})` }} aria-hidden="true">
      <Icon className="size-5" />
    </span>
  );
}
