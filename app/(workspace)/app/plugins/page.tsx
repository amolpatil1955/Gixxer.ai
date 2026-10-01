import type { Metadata } from "next";
import { PluginsView } from "@/components/plugins/plugins-view";
import { PageTitle } from "@/components/workspace/primitives";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/repository";

export const metadata: Metadata = { title: "Plugins" };

export default async function PluginsPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <PageTitle title="Plugins" description="Work with Gixxer across your tools. A plugin runs around every chat turn once it is on." />
      <div className="mt-6">
        <PluginsView enabled={settings.plugins} />
      </div>
    </div>
  );
}
