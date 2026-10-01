"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={isPending}
      loadingLabel="Signing out…"
      onClick={() => startTransition(() => logoutAction())}
    >
      <LogOut className="size-4" aria-hidden="true" />
      Log out
    </Button>
  );
}
