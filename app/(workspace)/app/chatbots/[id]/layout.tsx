import { notFound } from "next/navigation";
import { BotHeader } from "@/components/chatbots/bot-header";
import { requireUser } from "@/lib/auth/session";
import { getBot } from "@/lib/bots/repository";
import { toBotDto } from "@/lib/bots/serialize";

export default async function BotLayout({ children, params }: LayoutProps<"/app/chatbots/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const bot = await getBot(user.id, id);
  if (!bot) notFound();
  return (
    <div className="flex flex-1 flex-col">
      <BotHeader bot={toBotDto(bot)} />
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">{children}</div>
    </div>
  );
}
