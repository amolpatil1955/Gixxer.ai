"use client";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOutEverywhereAction } from "@/lib/settings/actions";
import type { ShellUser } from "../account-menu";
import { SettingRow } from "./settings-dialog";

export function SecuritySection({ user }: { user: ShellUser }) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  async function signOutEverywhere() {
    if (!(await confirm({ title: "Sign out everywhere?", body: "Every session on every device ends, including this one.", confirmLabel: "Sign out", tone: "default" }))) return;
    startTransition(() => signOutEverywhereAction());
  }

  return (
    <div>
      <SettingRow title="Session" description="Your session is verified against the database on every request, so a revoked session stops working at once." />
      <SettingRow title="Sign-in method">
        <span className="text-[13px] text-ink-200">{user.provider === "google" ? "Google" : "Email and password"}</span>
      </SettingRow>
      <SettingRow title="Sign out everywhere" description="Ends every active session for this account, on every device. You will sign in again here.">
        <Button size="sm" variant="secondary" onClick={signOutEverywhere} loading={pending} loadingLabel="Signing out…">
          Sign out everywhere
        </Button>
      </SettingRow>
      <SettingRow title="Password" description="Password changes and resets are not built yet. Sign out everywhere if you believe a session was compromised." />
      {dialog}
    </div>
  );
}
