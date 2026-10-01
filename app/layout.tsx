import type { Metadata, Viewport } from "next";
import { Exo_2, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { headers } from "next/headers";
import { MotionProvider } from "@/components/motion-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
  weight: ["800", "900"],
  style: ["italic"],
  display: "swap",
});
/* The editorial accent face: one italic phrase per headline, never body copy. */
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Gixxer.ai", template: "%s · Gixxer.ai" },
  description:
    "Gixxer.ai is a premium multi-model AI workspace: chat, image generation, file intelligence and custom business chatbots.",
  applicationName: "Gixxer.ai",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#030000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading a header opts every page into per-request rendering, which the
  // proxy's CSP nonce requires, and gives us the nonce for the theme script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} ${exo2.variable} ${instrument.variable} h-full`}
    >
      <head>
        {/* Applies the saved theme before first paint so the page never flashes. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-ink-950 text-ink-50">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
