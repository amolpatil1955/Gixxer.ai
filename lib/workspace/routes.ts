/** Route table for the signed-in workspace. Client-safe. */
export const workspaceRoutes = {
  home: "/app",
  chat: (id: string) => `/app/chat/${id}`,
  search: "/app/search",
  images: "/app/images",
  library: "/app/library",
  scheduled: "/app/scheduled",
  plugins: "/app/plugins",
  projects: "/app/projects",
  project: (id: string) => `/app/projects/${id}`,
  chatbots: "/app/chatbots",
  newChatbot: "/app/chatbots/new",
  chatbot: (id: string, tab: BotTab = "overview") => `/app/chatbots/${id}/${tab}`,
  account: "/app/account",
  admin: "/app/admin",
  adminUser: (id: string) => `/app/admin/${id}`,
} as const;

export const BOT_TABS = [
  "overview",
  "settings",
  "instructions",
  "knowledge",
  "appearance",
  "behavior",
  "conversations",
  "leads",
  "analytics",
  "embed",
] as const;
export type BotTab = (typeof BOT_TABS)[number];

export function isBotTab(value: string): value is BotTab {
  return (BOT_TABS as readonly string[]).includes(value);
}

export const BOT_TAB_LABELS: Record<BotTab, string> = {
  overview: "Overview",
  settings: "Settings",
  instructions: "Instructions",
  knowledge: "Knowledge",
  appearance: "Appearance",
  behavior: "Behavior",
  conversations: "Conversations",
  leads: "Leads",
  analytics: "Analytics",
  embed: "Embed",
};
