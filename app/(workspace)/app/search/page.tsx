import { MessageSquare, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle, Panel } from "@/components/workspace/primitives";
import { requireUser } from "@/lib/auth/session";
import { searchConversations } from "@/lib/chat/repository";
import { searchSchema } from "@/lib/chat/validation";
import { workspaceRoutes } from "@/lib/workspace/routes";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/app/search">) {
  const user = await requireUser();
  const params = await searchParams;
  const query = searchSchema.parse({ query: typeof params.q === "string" ? params.q : "" }).query;
  const results = await searchConversations(user.id, query);
  const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <PageTitle title="Search chats" description="Titles and every message you have exchanged." />
      <form action={workspaceRoutes.search} method="get" role="search" className="relative mt-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search your chats…"
          aria-label="Search conversations"
          autoFocus
          className="raised h-12 w-full rounded-full pl-11 pr-4 text-[15px] text-ink-50 outline-none placeholder:text-ink-400 focus:border-line-strong"
        />
      </form>

      {results.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="text-[16px] font-medium text-ink-50">{query ? "Nothing matched" : "No conversations yet"}</p>
          <p className="mt-1.5 text-[13.5px] text-ink-400">{query ? "Try a different word or two." : "Start a chat and it will show up here."}</p>
        </div>
      ) : (
        <Panel className="mt-6">
          <ul>
            {results.map((conversation) => (
              <li key={conversation.id}>
                <Link href={workspaceRoutes.chat(conversation.id)} className="flex items-center gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-ink-900/70">
                  <MessageSquare className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink-50">{conversation.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-400">{formatter.format(conversation.lastMessageAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
