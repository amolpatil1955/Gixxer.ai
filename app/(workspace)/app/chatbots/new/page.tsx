import type { Metadata } from "next";
import { BotWizard } from "@/components/chatbots/bot-wizard";
import { PageHeader } from "@/components/workspace/page-header";
import { requireUser } from "@/lib/auth/session";
import { firecrawlConfigured } from "@/lib/crawl/firecrawl";
import { getEnv } from "@/lib/env";
import { listFiles } from "@/lib/files/repository";

export const metadata: Metadata = { title: "New chatbot" };

/** The creation wizard: name, use case, knowledge, training, theme, publish. */
export default async function NewBotPage() {
  const user = await requireUser();
  const files = await listFiles(user.id, { scopes: ["library"] });
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <PageHeader eyebrow="Chatbot Pro" title="Create a chatbot" description="Six steps: name it, say what it does, feed it your knowledge, let it train, choose a look, and put it on your site." />
      <div className="mt-8">
        <BotWizard
          origin={new URL(getEnv().APP_URL).origin}
          libraryFiles={files.filter((file) => file.kind !== "image" && file.status === "indexed").map((file) => ({ id: file.id, name: file.name }))}
          crawlingAvailable={firecrawlConfigured()}
        />
      </div>
    </div>
  );
}
