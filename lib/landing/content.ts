/**
 * Copy and structure for the landing page, kept out of the components so the
 * sections stay about layout and motion. Client-safe; no secrets, no env.
 *
 * Everything claimed here is something the product actually does. There are
 * no invented customer counts, latency figures or uptime numbers. Where a
 * mockup shows sample data it is labelled as a preview in the interface.
 */

export const landingSections = {
  workspace: "workspace",
  capabilities: "capabilities",
  deploy: "deploy",
  knowledge: "knowledge",
  faq: "faq",
  start: "start",
} as const;

export type SectionId = (typeof landingSections)[keyof typeof landingSections];

export const navLinks = [
  { label: "Workspace", href: `#${landingSections.workspace}` },
  { label: "Capabilities", href: `#${landingSections.capabilities}` },
  { label: "Chatbot", href: `#${landingSections.deploy}` },
  { label: "Knowledge", href: `#${landingSections.knowledge}` },
  { label: "FAQ", href: `#${landingSections.faq}` },
] as const;

export const mobileNavLinks = navLinks;

/* ------------------------------------------------------------------ */
/* 01 — Hero                                                           */
/* ------------------------------------------------------------------ */

export const hero = {
  eyebrow: "Multi-model AI workspace",
  lines: ["Every model.", "One workspace."],
  accent: "Full throttle.",
  description:
    "Chat with the best models, generate images, read your documents and put a trained chatbot on your website. When one provider slows down, Gixxer switches to the next, so you never have to.",
  primaryCta: "Start free",
  secondaryCta: "See it in action",
  capabilities: ["Chat", "Images", "Files", "Chatbots"],
} as const;

/* ------------------------------------------------------------------ */
/* Credibility strip (currently disabled in the page)                  */
/* ------------------------------------------------------------------ */

export const credibility = {
  label: "Built on",
  providers: [
    { name: "Groq", role: "Chat, reasoning and voice" },
    { name: "Hugging Face", role: "Images and embeddings" },
  ],
  formatsLabel: "Reads",
  formats: ["PDF", "DOCX", "TXT", "CSV", "XLS", "XLSX"],
  embedLabel: "Embeds on",
  embeds: ["Any HTML page", "WordPress", "Shopify", "Webflow", "React", "Static sites"],
  note: "One script tag. Wherever a script tag works, the bot works.",
} as const;

/* ------------------------------------------------------------------ */
/* 02 — The workspace showcase                                         */
/* ------------------------------------------------------------------ */

export type WorkspaceViewKey = "chat" | "images" | "files" | "chatbot";

export interface WorkspaceView {
  key: WorkspaceViewKey;
  /** Sidebar label. */
  label: string;
  /** Label on narrow screens. */
  short: string;
  /** Shown as the open editor tab. */
  tab: string;
  caption: string;
}

export const workspaceViews: readonly WorkspaceView[] = [
  { key: "chat", label: "New Chat", short: "Chat", tab: "Q3 review", caption: "Ask anything. Groq answers in a blink; Think mode reasons first." },
  { key: "images", label: "Images", short: "Images", tab: "robot-portrait", caption: "Describe it, watch it resolve at full size." },
  { key: "files", label: "Library", short: "Library", tab: "Q3-financials.xlsx", caption: "Answers that cite the page and the cell." },
  { key: "chatbot", label: "Chatbot Pro", short: "Bots", tab: "Aria · dashboard", caption: "Your business bot, trained and deployed." },
];

export const showcase = {
  index: "01",
  eyebrow: "The workspace",
  title: "One conversation,",
  accent: "every capability.",
  description:
    "Pick an area to see how it behaves. Gixxer routes each request to the right model and streams the answer as it forms.",
  /** The full sidebar, matching the product. Only the four above are interactive here. */
  sidebar: ["New Chat", "Search", "Images", "Library", "Scheduled", "Plugins", "Projects", "Chatbot Pro"],
  recent: ["Launch email, warmer", "Churn drivers, Q3", "Robot portrait, seed 4471"],
  status: { model: "Groq · qwen3.8", fallback: "gpt-oss · standby", session: "Session verified" },

  chat: {
    userMessage: "Summarize the attached Q3 report and flag anything the board should worry about.",
    attachment: "Q3-financials.xlsx",
    assistantMessage:
      "Revenue grew 18% quarter over quarter, led by the enterprise tier. Two things deserve the board's attention: SMB churn rose from 2.1% to 3.4%, and cash runway shortened to 14 months at the current burn rate.",
    citation: "Retention · B14:F31",
    models: ["Groq", "Think mode"],
  },

  images: {
    prompt: "Portrait of a friendly robot assistant, glossy white and graphite, studio light",
    size: "768 × 960",
    meta: ["Hugging Face", "Seed 4471"],
    actions: ["Download", "Regenerate", "Variations"],
    alt: "A generated portrait of a glossy white and graphite robot assistant",
  },

  files: {
    items: [
      { name: "Q3-financials.xlsx", detail: "4 sheets · 1,280 rows", state: "Indexed" },
      { name: "Board-deck.pdf", detail: "28 pages", state: "Indexed" },
      { name: "Support-log.csv", detail: "9,412 rows", state: "Indexing" },
    ],
    question: "What drove the churn increase?",
    answer:
      "Support volume for the billing flow tripled in August. Of the accounts that churned, 61% filed a billing ticket in the 30 days before leaving.",
    citations: ["Support-log.csv · rows 4,102–4,860", "Board-deck.pdf · p.17"],
  },

  chatbot: {
    bots: [
      { name: "Aria", business: "Northwind Cycles", conversations: "1,204 chats", status: "Live" },
      { name: "Vale", business: "Harborline Legal", conversations: "318 chats", status: "Live" },
      { name: "Pip", business: "Cedar Coffee", conversations: "Draft", status: "Draft" },
    ],
    activeBot: "Aria",
    transcript: [
      { from: "visitor", text: "Do you service electric bikes?" },
      { from: "bot", text: "Yes. We service most e-bike brands, and diagnostics are free with any tune-up." },
    ],
    sourceNote: "Answered from: Services page, Pricing FAQ",
  },
} as const;

/* ------------------------------------------------------------------ */
/* 03 — Capabilities                                                   */
/* ------------------------------------------------------------------ */

export type CapabilityKey = "chat" | "images" | "files" | "bots";

export const capabilities = {
  index: "02",
  eyebrow: "Capabilities",
  title: "One assistant.",
  accent: "Every capability.",
  description: "Chat, images, files and a bot for your website, in one workspace that picks the right model for you.",
  items: [
    { key: "chat", label: "AI Chat", title: "Answers that never stall", detail: "Groq answers first; if a model stalls, a second one continues the same reply." },
    { key: "images", label: "Images", title: "From prompt to picture", detail: "Generated at full size, kept in your library, seed-locked for variations." },
    { key: "files", label: "Files", title: "Answers that cite the cell", detail: "PDFs keep their pages, spreadsheets keep their cells, and every answer shows its source." },
    { key: "bots", label: "Chatbot Pro", title: "A bot that knows your business", detail: "Trained on your pages and files, live on your site with one script tag." },
  ] as readonly { key: CapabilityKey; label: string; title: string; detail: string }[],
  chat: {
    question: "Draft a launch note for the new plan, warm but direct.",
    reply: "We built the new plan for the teams who outgrew us last year. Same product, more room, and it ships Tuesday.",
    handover: "qwen3.8 → gpt-oss, same reply",
  },
  images: {
    prompt: "Elegant humanoid robot assistant, glossy white ceramic, dark graphite joints, black studio background",
    meta: "Hugging Face · FLUX.1-schnell · seed 90210",
    actions: ["Download", "Regenerate", "Variations"],
    note: "This portrait was generated with the same model Gixxer uses.",
  },
  files: {
    file: "Q3-financials.xlsx",
    columns: ["Segment", "Aug", "Sep"],
    rows: [
      ["Enterprise", "0.9%", "0.8%"],
      ["SMB", "2.9%", "3.4%"],
      ["Runway (mo)", "16", "14"],
    ],
    highlight: 1,
    citation: "Retention!B3:C3",
  },
  bots: {
    visitor: "Do you service electric bikes?",
    reply: "Yes, most brands. Diagnostics are free with any tune-up.",
    source: "Services page",
  },
  status: { name: "Gixxer assistant", state: "Online", models: "Groq · Think mode ready" },
  alt: "A glossy white humanoid robot assistant against a black background, generated with Hugging Face",
  providers: ["Groq", "Hugging Face"],
  /** Honest labels: the widget embeds on these today; the connectors arrive with Plugins. */
  embedsOn: { label: "Your bot embeds on", marks: ["wordpress", "shopify", "webflow"] },
  connectors: { label: "Connectors", badge: "Coming with Plugins", marks: ["slack", "googlecalendar", "cloudflare", "n8n"] },
} as const;

/* ------------------------------------------------------------------ */
/* 04 — Chatbot Pro: build and deploy                                  */
/* ------------------------------------------------------------------ */

export const botTones = [
  { key: "friendly", label: "Friendly" },
  { key: "professional", label: "Professional" },
  { key: "concise", label: "Concise" },
] as const;

export type BotToneKey = (typeof botTones)[number]["key"];

export const botPurposes = [
  { key: "support", label: "Customer support", line: "Ask me about orders, servicing or opening hours." },
  { key: "sales", label: "Sales and leads", line: "Tell me how you ride and I will suggest a bike." },
  { key: "bookings", label: "Bookings", line: "I can book a fitting or a service for you." },
] as const;

export type BotPurposeKey = (typeof botPurposes)[number]["key"];

export type DeployStepKey = "identity" | "train" | "test" | "install";

export interface DeployStep {
  key: DeployStepKey;
  n: string;
  short: string;
  title: string;
  detail: string;
  does: readonly string[];
  /** Where this happens in the product. */
  where: string;
}

export type PlatformKey = "html" | "wordpress" | "shopify" | "webflow" | "nextjs";

export const deploy = {
  index: "03",
  eyebrow: "Chatbot Pro",
  title: "From a name to live on your site,",
  accent: "in four steps.",
  description:
    "This is the real setup, the same screens you use in the dashboard. Click through it: nothing here calls a model, but every step behaves the way the product does.",
  host: "northwindcycles.example",
  botKey: "gx_nwCycles8Kq2Lm4Zp",
  steps: [
    {
      key: "identity",
      n: "01",
      short: "Name",
      title: "Name it and give it a job",
      detail: "A name, the business it speaks for, and what it is there to do. The welcome line writes itself from these.",
      does: ["Pick a name and a tone of voice", "Choose its purpose", "Tell it which business it speaks for"],
      where: "Chatbot Pro → New bot → Settings",
    },
    {
      key: "train",
      n: "02",
      short: "Train",
      title: "Train it on your data",
      detail: "Add pages from your site, upload files and paste your FAQ. Each source is read, split into passages and indexed in seconds.",
      does: ["Public pages from your website", "PDF, DOCX, TXT, CSV, XLS and XLSX", "Pasted FAQs, policies and prices"],
      where: "Your bot → Knowledge",
    },
    {
      key: "test",
      n: "03",
      short: "Test",
      title: "Test it, then go live",
      detail: "Ask it what your customers ask. Every answer names the source it came from. When you are happy, switch it live.",
      does: ["Answers only from your sources", "Says so when it does not know", "Offers the visitor a contact form"],
      where: "Your bot → Overview → Go live",
    },
    {
      key: "install",
      n: "04",
      short: "Install",
      title: "Add it to your website",
      detail: "Copy one script tag into your site, just before the closing body tag. A launcher appears in the corner and visitors can start chatting.",
      does: ["Works on any site that can load a script", "Lock it to your own domains", "Conversations and leads land in your dashboard"],
      where: "Your bot → Embed",
    },
  ] as readonly DeployStep[],
  sources: [
    { type: "URL", name: "northwindcycles.example/services", passages: 18 },
    { type: "PDF", name: "catalog-2026.pdf", passages: 64 },
    { type: "Text", name: "Pricing FAQ", passages: 9 },
  ],
  platforms: [
    { key: "html", label: "HTML", where: "Paste it just before </body> on every page, or once in your shared footer." },
    { key: "wordpress", label: "WordPress", where: "Use a header-and-footer code plugin's footer box, or your theme's footer.php before </body>." },
    { key: "shopify", label: "Shopify", where: "Online Store → Themes → Edit code → layout/theme.liquid, just before </body>." },
    { key: "webflow", label: "Webflow", where: "Site settings → Custom code → Footer code, then publish the site." },
    { key: "nextjs", label: "Next.js", where: "Add it to your root layout with next/script, loaded lazily." },
  ] as readonly { key: PlatformKey; label: string; where: string }[],
  site: {
    nav: ["Bikes", "Service", "E-bikes", "Contact"],
    headline: "Built for the long way home.",
    sub: "Road, gravel and electric bikes, fitted by people who ride them.",
    cta: "Book a fitting",
    products: [
      { name: "Ridgeline Gravel", price: "$2,190" },
      { name: "Commuter E-8", price: "$3,450" },
      { name: "Northwind Road", price: "$1,780" },
    ],
  },
  defaults: {
    name: "Aria",
    business: "Northwind Cycles",
    purpose: "support" as BotPurposeKey,
    tone: "friendly" as BotToneKey,
    side: "right" as "left" | "right",
  },
  /** Canned exchanges. Clicking a question shows its answer; nothing calls a model. */
  suggestions: [
    {
      question: "Do you service electric bikes?",
      answer: "Yes. We service most e-bike brands, and diagnostics are free with any tune-up. Want me to book a slot?",
      source: "northwindcycles.example/services",
    },
    {
      question: "Is the Commuter E-8 in stock?",
      answer: "Yes, in medium and large. It is $3,450 and comes with a free first service.",
      source: "catalog-2026.pdf",
    },
    {
      question: "Do you price match?",
      answer: "We match any local retailer on identical stock items. Bring the quote and we will handle the rest.",
      source: "Pricing FAQ",
    },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* 06 — Knowledge and memory                                           */
/* ------------------------------------------------------------------ */

export const knowledge = {
  index: "04",
  eyebrow: "Knowledge and memory",
  title: "It remembers",
  accent: "what you gave it.",
  description:
    "Your bot answers from the sources you chose and shows which one it used. Your own workspace keeps every thread, file and image where you left it.",
  sources: [
    { label: "Services page", kind: "URL" },
    { label: "Pricing FAQ", kind: "Text" },
    { label: "catalog-2026.pdf", kind: "PDF" },
    { label: "Warranty terms", kind: "DOCX" },
    { label: "Opening hours", kind: "Text" },
    { label: "E-bike care guide", kind: "URL" },
  ],
  hub: "Aria",
  forYou: [
    { title: "Conversation history", detail: "Rename, search and delete. Every thread stays where you left it." },
    { title: "Library", detail: "Files you uploaded and images you generated, kept and searchable." },
    { title: "Projects", detail: "Group chats, files and bots by what they are for." },
  ],
  forBots: [
    { title: "Knowledge base", detail: "Files, pages and FAQs the bot answers from, with the source shown." },
    { title: "Instructions", detail: "Tone, boundaries and behaviour you set once and it keeps." },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* 07 — FAQ                                                            */
/* ------------------------------------------------------------------ */

export const faqSection = {
  index: "05",
  eyebrow: "FAQ",
  title: "Questions",
  accent: "worth asking.",
} as const;

export const faqs = [
  {
    question: "Which models does Gixxer use?",
    answer:
      "Chat runs on Groq: a fast model answers everyday questions, a reasoning model takes over in Think mode, and a second model continues any reply that stalls. Voice input is transcribed by Whisper on Groq. Images and document embeddings run on Hugging Face. You do not need an account with any of them.",
  },
  {
    question: "What happens when a provider fails?",
    answer:
      "Recoverable failures such as a timeout, a rate limit or a temporary error trigger a controlled retry, then a switch to the fallback provider in the same conversation. If every provider fails, you get a clear, retryable error rather than a silent stall.",
  },
  {
    question: "Can other people see my files and conversations?",
    answer:
      "No. Chats, files, images, bots and analytics are isolated to your workspace, and every request is authorized on the server rather than trusted from the browser.",
  },
  {
    question: "Do I need to write code to use the chatbot?",
    answer:
      "Only to install it, and only one line. You configure the bot in the dashboard, then paste a single script tag into your site. It works on any stack.",
  },
  {
    question: "Can I bring my own API keys?",
    answer:
      "Not yet. Gixxer manages provider access for you today so there is nothing to configure, and nothing sensitive in your browser.",
  },
] as const;

/* ------------------------------------------------------------------ */
/* 08 — Final call to action and footer                                */
/* ------------------------------------------------------------------ */

export const finalCta = {
  title: "Ready when",
  accent: "you are.",
  description: "Create your account and start working with every model in one place.",
  primary: "Create your account",
  secondary: "Sign in",
  reassurance: "No credit card. Google sign-in coming soon.",
} as const;

export const footerColumns = [
  {
    heading: "Product",
    links: [
      { label: "Workspace", href: `#${landingSections.workspace}` },
      { label: "Capabilities", href: `#${landingSections.capabilities}` },
      { label: "Chatbot Pro", href: `#${landingSections.deploy}` },
      { label: "Knowledge", href: `#${landingSections.knowledge}` },
    ],
  },
  {
    heading: "Help",
    links: [
      { label: "FAQ", href: `#${landingSections.faq}` },
      { label: "Back to top", href: "#top" },
    ],
  },
] as const;
