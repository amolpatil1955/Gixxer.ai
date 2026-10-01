"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { deleteAllConversationsAction } from "@/lib/settings/actions";
import { SettingRow } from "./settings-dialog";

export function DataSection() {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function deleteAll() {
    if (!window.confirm("Delete every chat and message? Files, images, bots and projects stay. This cannot be undone.")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteAllConversationsAction();
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setMessage({ tone: "ok", text: "All chats deleted." });
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <div>
      <SettingRow title="Where your data lives" description="Chats, files, images, bots and settings are stored under your account only. Nothing is shared with other accounts, and providers receive only what a request needs." />
      <SettingRow title="Export your data" description="One JSON file with your chats, settings, projects, schedules and the records of your files and images.">
        <a href="/api/export" download className={buttonClassName({ variant: "secondary", size: "sm" })}>
          Download export
        </a>
      </SettingRow>
      <SettingRow title="Delete all chats" description="Removes every conversation and message. Your library, images, bots and projects are kept.">
        <Button size="sm" variant="secondary" onClick={deleteAll} loading={pending} loadingLabel="Deleting…" className="text-danger hover:text-danger">
          Delete all chats
        </Button>
      </SettingRow>
      <SettingRow title="Delete account" description="Account deletion is not self-service yet. Contact the owner of this deployment." />
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "pt-3 text-[13px] text-danger" : "pt-3 text-[13px] text-ink-300"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
