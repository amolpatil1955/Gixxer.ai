/**
 * The plugin catalogue. Client-safe: names, copy and ids only.
 *
 * A plugin is something Gixxer does around a chat turn. The ones marked
 * `available` work today and run inside `lib/plugins/apply.ts`; the ones
 * marked `soon` need an account connection that is not built yet, and the
 * page says so instead of pretending.
 */

export type PluginId = "web-reader" | "library" | "datetime";

export interface PluginEntry {
  id: PluginId;
  name: string;
  tagline: string;
  description: string;
  /** One line shown under the toggle: what it needs, what it reads. */
  detail: string;
  status: "available";
}

export interface UpcomingEntry {
  id: string;
  name: string;
  tagline: string;
  /** Brand mark key in components/landing/primitives/brand-marks.tsx, or null for a plain icon. */
  mark: "slack" | "googlecalendar" | "cloudflare" | "n8n" | null;
  status: "soon";
}

export const PLUGINS: readonly PluginEntry[] = [
  {
    id: "web-reader",
    name: "Web page reader",
    tagline: "Reads links you paste before answering",
    description: "Paste up to two public links in a message. Gixxer fetches each page, keeps the readable text and answers from it, citing the page.",
    detail: "Public https pages only, 2 MB each. Private networks are never contacted.",
    status: "available",
  },
  {
    id: "library",
    name: "Library knowledge",
    tagline: "Answers from every file in your library",
    description: "Every indexed document in your library is searched for each question, not only the files you attach. Answers cite the page or cell range.",
    detail: "Runs the same retrieval as attachments, across your whole library.",
    status: "available",
  },
  {
    id: "datetime",
    name: "Date & time",
    tagline: "Knows today's date and your time zone",
    description: "Gixxer is told the current date, time and your time zone with every message, so \"next Friday\" and \"this quarter\" mean what you mean.",
    detail: "Uses the time zone your browser reports. Nothing is stored.",
    status: "available",
  },
];

export const UPCOMING: readonly UpcomingEntry[] = [
  { id: "slack", name: "Slack", tagline: "Post replies and summaries to a channel", mark: "slack", status: "soon" },
  { id: "google-calendar", name: "Google Calendar", tagline: "Read your day and draft events", mark: "googlecalendar", status: "soon" },
  { id: "cloudflare", name: "Cloudflare", tagline: "Inspect zones, DNS and deployments", mark: "cloudflare", status: "soon" },
  { id: "n8n", name: "n8n", tagline: "Trigger a workflow from a chat", mark: "n8n", status: "soon" },
  { id: "gmail", name: "Gmail", tagline: "Summarise threads and draft replies", mark: null, status: "soon" },
  { id: "google-drive", name: "Google Drive", tagline: "Bring Docs and Sheets into a chat", mark: null, status: "soon" },
];

export const PLUGIN_IDS: readonly PluginId[] = PLUGINS.map((plugin) => plugin.id);

export function isPluginId(value: string): value is PluginId {
  return (PLUGIN_IDS as readonly string[]).includes(value);
}
