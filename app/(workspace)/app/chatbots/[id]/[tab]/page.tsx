import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppearanceForm, BehaviorForm, InstructionsForm, SettingsForm } from "@/components/chatbots/bot-forms";
import { BotKnowledge } from "@/components/chatbots/bot-knowledge";
import { Analytics, Conversations, Embed, Leads, Overview } from "@/components/chatbots/bot-panels";
import { requireUser } from "@/lib/auth/session";
import { botAnalytics, getBot, listBotConversations, listLeads, listSources } from "@/lib/bots/repository";
import { toBotDto, toSourceDto } from "@/lib/bots/serialize";
import { firecrawlConfigured } from "@/lib/crawl/firecrawl";
import { getEnv } from "@/lib/env";
import { listFiles } from "@/lib/files/repository";
import { BOT_TAB_LABELS, isBotTab } from "@/lib/workspace/routes";

export async function generateMetadata({ params }: PageProps<"/app/chatbots/[id]/[tab]">): Promise<Metadata> {
  const { tab } = await params;
  return { title: isBotTab(tab) ? BOT_TAB_LABELS[tab] : "Chatbot" };
}

function serializeConversations(list: Awaited<ReturnType<typeof listBotConversations>>) {
  return list.map((conversation) => ({
    id: conversation.id,
    sessionId: conversation.sessionId,
    origin: conversation.origin,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    messages: conversation.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() })),
  }));
}

export default async function BotTabPage({ params }: PageProps<"/app/chatbots/[id]/[tab]">) {
  const user = await requireUser();
  const { id, tab } = await params;
  if (!isBotTab(tab)) notFound();
  const record = await getBot(user.id, id);
  if (!record) notFound();
  const bot = toBotDto(record);

  switch (tab) {
    case "overview": {
      const [analytics, sources, latest] = await Promise.all([botAnalytics(user.id, id), listSources(user.id, id), listBotConversations(user.id, id, 5)]);
      return <Overview bot={bot} analytics={analytics} sourceCount={sources.length} latest={serializeConversations(latest)} />;
    }
    case "settings":
      return <SettingsForm bot={bot} />;
    case "instructions":
      return <InstructionsForm bot={bot} />;
    case "knowledge": {
      const [sources, files] = await Promise.all([listSources(user.id, id), listFiles(user.id, { scopes: ["library"] })]);
      return (
        <BotKnowledge
          botId={id}
          crawlingAvailable={firecrawlConfigured()}
          sources={sources.map(toSourceDto)}
          libraryFiles={files.filter((file) => file.kind !== "image" && file.status === "indexed").map((file) => ({ id: file.id, name: file.name }))}
        />
      );
    }
    case "appearance":
      return <AppearanceForm bot={bot} />;
    case "behavior":
      return <BehaviorForm bot={bot} />;
    case "conversations":
      return <Conversations conversations={serializeConversations(await listBotConversations(user.id, id))} />;
    case "leads": {
      const leads = await listLeads(user.id, id);
      return <Leads leads={leads.map((lead) => ({ id: lead.id, name: lead.name, email: lead.email, message: lead.message, createdAt: lead.createdAt.toISOString() }))} />;
    }
    case "analytics":
      return <Analytics analytics={await botAnalytics(user.id, id)} />;
    case "embed":
      return <Embed bot={bot} origin={new URL(getEnv().APP_URL).origin} />;
  }
}
