import { redirect } from "next/navigation";
import { workspaceRoutes } from "@/lib/workspace/routes";

export default async function BotIndexPage({ params }: PageProps<"/app/chatbots/[id]">) {
  const { id } = await params;
  redirect(workspaceRoutes.chatbot(id, "overview"));
}
