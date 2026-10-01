import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmbedChat } from "@/components/widget/embed-chat";
import { getLiveBotByKey, toPublicConfig } from "@/lib/bots/repository";

export const metadata: Metadata = { title: "Chat", robots: { index: false, follow: false } };

/**
 * The public chat page a widget iframes. No session, no workspace: only a
 * live bot's public configuration reaches this page.
 */
export default async function EmbedPage({ params, searchParams }: PageProps<"/embed/[key]">) {
  const { key } = await params;
  const query = await searchParams;
  const found = await getLiveBotByKey(key);
  if (!found) notFound();
  const host = typeof query.host === "string" ? query.host : null;
  const framed = host !== null;
  return <EmbedChat bot={toPublicConfig(found.bot)} host={host} framed={framed} />;
}
