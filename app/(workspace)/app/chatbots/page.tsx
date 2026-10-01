import type { Metadata } from "next";
import { BotList } from "@/components/chatbots/bot-list";
import { PageHeader } from "@/components/workspace/page-header";
import { requireUser } from "@/lib/auth/session";
import { listBots } from "@/lib/bots/repository";
import { toBotDto } from "@/lib/bots/serialize";

export const metadata: Metadata = { title: "Chatbot Pro" };

export default async function ChatbotsPage() {
  const user = await requireUser();
  const bots = await listBots(user.id);
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <PageHeader eyebrow="Chatbot Pro" title="Your chatbots" description="Train a bot on your pages, FAQs and files, shape its voice, and put it on your website with one script tag." />
      <div className="mt-8">
        <BotList bots={bots.map(toBotDto)} />
      </div>
    </div>
  );
}
