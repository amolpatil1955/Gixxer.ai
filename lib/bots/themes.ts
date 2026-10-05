/**
 * The five chatbot themes. Client-safe: colours and copy only.
 *
 * Each is a complete visual system, not a tint of one design: its own surface,
 * bubble treatment, radius, shadow and typographic weight, so two bots built on
 * different themes do not look like the same widget in another colour. A theme
 * supplies every colour the widget draws with, so nothing inherits the
 * workspace's own palette.
 */

export interface BotThemeTokens {
  /** The launcher, the visitor's bubbles and the send control. */
  accent: string;
  /** Text on the accent. */
  onAccent: string;
  /** The panel behind the conversation. */
  surface: string;
  /** The header band. */
  header: string;
  headerText: string;
  /** The assistant's bubbles. */
  bubble: string;
  bubbleText: string;
  /** Borders and dividers. */
  border: string;
  /** Quiet text: timestamps, the footer. */
  muted: string;
  /** Corner radius of the panel, in pixels. */
  radius: number;
  /** Corner radius of a bubble, in pixels. */
  bubbleRadius: number;
  shadow: string;
  /** Font stack for the whole widget. */
  font: string;
  /** Weight of the bot's name in the header. */
  headingWeight: number;
}

export interface BotTheme {
  key: string;
  name: string;
  /** One line a reader can choose by. */
  description: string;
  /** Who it suits, shown under the name. */
  industry: string;
  light: BotThemeTokens;
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const GEOMETRIC = "'Avenir Next', 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Iowan Old Style', Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace";

export const BOT_THEMES: readonly BotTheme[] = [
  {
    key: "clarity",
    name: "Clarity",
    description: "White, airy and unmistakably professional. The safe choice for any website.",
    industry: "SaaS, agencies, professional services",
    light: {
      accent: "#2563eb",
      onAccent: "#ffffff",
      surface: "#ffffff",
      header: "#ffffff",
      headerText: "#0f172a",
      bubble: "#f1f5f9",
      bubbleText: "#1e293b",
      border: "#e2e8f0",
      muted: "#64748b",
      radius: 18,
      bubbleRadius: 16,
      shadow: "0 24px 60px -16px rgba(15, 23, 42, 0.22)",
      font: SANS,
      headingWeight: 600,
    },
  },
  {
    key: "midnight",
    name: "Midnight",
    description: "A dark, high-contrast panel with an electric edge. Looks built, not bolted on.",
    industry: "Technology, gaming, developer tools",
    light: {
      accent: "#6366f1",
      onAccent: "#ffffff",
      surface: "#0f1120",
      header: "#171a2e",
      headerText: "#f8fafc",
      bubble: "#1d2039",
      bubbleText: "#e2e8f0",
      border: "rgba(255, 255, 255, 0.09)",
      muted: "#8b93b5",
      radius: 20,
      bubbleRadius: 14,
      shadow: "0 30px 70px -18px rgba(0, 0, 0, 0.65)",
      font: GEOMETRIC,
      headingWeight: 600,
    },
  },
  {
    key: "warmth",
    name: "Warmth",
    description: "Cream paper, soft terracotta and a serif name. Reads hospitable rather than corporate.",
    industry: "Restaurants, hotels, wellness, retail",
    light: {
      accent: "#c2522f",
      onAccent: "#fffaf4",
      surface: "#fdf8f1",
      header: "#f6ebdd",
      headerText: "#3c2a1e",
      bubble: "#ffffff",
      bubbleText: "#433024",
      border: "#e8d8c5",
      muted: "#917a66",
      radius: 22,
      bubbleRadius: 18,
      shadow: "0 24px 56px -18px rgba(90, 58, 36, 0.28)",
      font: SERIF,
      headingWeight: 600,
    },
  },
  {
    key: "forest",
    name: "Forest",
    description: "Deep green on a calm, cool white. Steady and trustworthy.",
    industry: "Healthcare, finance, education, non-profits",
    light: {
      accent: "#0f766e",
      onAccent: "#ffffff",
      surface: "#f7faf9",
      header: "#0f766e",
      headerText: "#ffffff",
      bubble: "#ffffff",
      bubbleText: "#14342f",
      border: "#d4e4e0",
      muted: "#5d7b75",
      radius: 16,
      bubbleRadius: 14,
      shadow: "0 22px 54px -18px rgba(15, 52, 47, 0.26)",
      font: SANS,
      headingWeight: 600,
    },
  },
  {
    key: "monochrome",
    name: "Monochrome",
    description: "Black, white and a monospaced label. Editorial, exact, no decoration.",
    industry: "Studios, architecture, fashion, publishing",
    light: {
      accent: "#111111",
      onAccent: "#ffffff",
      surface: "#ffffff",
      header: "#111111",
      headerText: "#ffffff",
      bubble: "#f4f4f4",
      bubbleText: "#1a1a1a",
      border: "#e4e4e4",
      muted: "#767676",
      radius: 6,
      bubbleRadius: 6,
      shadow: "0 20px 48px -18px rgba(0, 0, 0, 0.3)",
      font: MONO,
      headingWeight: 700,
    },
  },
];

export const DEFAULT_THEME_KEY = "clarity";

export function themeFor(key: string | null | undefined): BotTheme {
  return BOT_THEMES.find((theme) => theme.key === key) ?? BOT_THEMES[0]!;
}

/**
 * The theme a bot draws with. A bot keeps its own accent, so an owner who picked
 * a brand colour under Appearance keeps it while every other token comes from
 * the preset.
 */
export function tokensFor(preset: string | null | undefined, accent?: string | null): BotThemeTokens {
  const theme = themeFor(preset);
  return accent && /^#[0-9a-f]{6}$/i.test(accent) ? { ...theme.light, accent } : theme.light;
}
