"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveProfileAction, usageAction } from "@/lib/settings/actions";
import type { UsageDto } from "@/lib/settings/types";
import { Avatar, type ShellUser } from "../account-menu";
import { SettingRow } from "./settings-dialog";

const inputClass =
  "h-9 w-full rounded-xl border border-line bg-ink-800 px-3 text-[13px] text-ink-50 outline-none transition-colors hover:border-line-strong focus:border-ink-400 aria-invalid:border-danger/70";

export function ProfileSection({ user }: { user: ShellUser }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [usage, setUsage] = useState<UsageDto | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    usageAction().then((result) => {
      if (!cancelled) setUsage(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveProfileAction({ name });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setMessage({ tone: "ok", text: "Saved." });
      router.refresh();
    });
  }

  const memberSince = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(user.createdAt));

  return (
    <div>
      <div className="flex items-center gap-4 pb-2">
        <Avatar user={user} className="size-14 text-[18px]" />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-ink-50">{user.name}</p>
          <p className="truncate text-[13px] text-ink-400">{user.email}</p>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <SettingRow title="Name" description="How you appear in the workspace.">
          <div className="flex items-center gap-2">
            <input value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} aria-label="Name" aria-invalid={message?.tone === "error" || undefined} className={`${inputClass} sm:w-56`} />
            <Button type="submit" size="sm" variant="secondary" disabled={name.trim() === user.name || name.trim().length < 2} loading={pending} loadingLabel="Saving…">
              Save
            </Button>
          </div>
        </SettingRow>
      </form>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "py-2 text-[13px] text-danger" : "py-2 text-[13px] text-ink-300"}>
          {message.text}
        </p>
      ) : null}
      <SettingRow title="Email" description="Sign-in email. Changing it is not supported yet.">
        <span className="text-[13px] text-ink-200">{user.email}</span>
      </SettingRow>
      <SettingRow title="Sign-in method">
        <span className="text-[13px] text-ink-200">{user.provider === "google" ? "Google" : "Email and password"}</span>
      </SettingRow>
      <SettingRow title="Member since">
        <span className="text-[13px] text-ink-200">{memberSince}</span>
      </SettingRow>
      <SettingRow title="Usage" description="What your account holds right now." stacked>
        {usage === "loading" ? (
          <p className="text-[13px] text-ink-400">Counting…</p>
        ) : usage === null ? (
          <p className="text-[13px] text-ink-400">Counts are unavailable right now.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["Chats", usage.conversations],
                ["Messages", usage.messages],
                ["Files", usage.files],
                ["Images", usage.images],
                ["Chatbots", usage.bots],
                ["Schedules", usage.schedules],
                ["Projects", usage.projects],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-ink-800/70 px-3 py-2.5">
                <dt className="text-[11.5px] text-ink-400">{label}</dt>
                <dd className="mt-0.5 font-mono text-[15px] text-ink-50">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </SettingRow>
    </div>
  );
}
