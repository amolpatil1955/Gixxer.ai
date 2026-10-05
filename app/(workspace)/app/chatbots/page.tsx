import type { Metadata } from "next";
import Link from "next/link";
import { BotList } from "@/components/chatbots/bot-list";
import { buttonClassName } from "@/components/ui/button";
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
      <PageHeader
        eyebrow="Chatbot Pro"
        title="Your chatbots"
        description="Train a bot on your website, FAQs and files, shape its voice, and put it on your site with one script tag."
        actions={
          bots.length > 0 ? (
            <Link href="/app/chatbots/new" className={buttonClassName({ size: "sm" })}>
              New chatbot
            </Link>
          ) : null
        }
      />
      <div className="mt-8">
        <BotList bots={bots.map(toBotDto)} />
      </div>
    </div>
  );
}
