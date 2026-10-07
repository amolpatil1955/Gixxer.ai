"use client";

import { Check, LogIn, Search, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input, inputClassName } from "@/components/ui/input";
import { setUserRoleAction, startImpersonationAction } from "@/lib/admin/actions";
import { cn } from "@/lib/utils/cn";
import { workspaceRoutes } from "@/lib/workspace/routes";

/*
 * The admin area. It shows who is registered and what each account has been
 * doing, in counts and titles, and it is the one place a sitting inside
 * someone's account can be started. It never shows the contents of a chat or a
 * file: to read those an admin signs in as the account, which is recorded.
 */

export interface UserRow {
  id: string;
  name: string;
  email: string;
  provider: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ActivityDto {
  conversations: number;
  messages: number;
  files: number;
  images: number;
  bots: number;
  schedules: number;
  recent: { kind: string; label: string; at: string }[];
  lastActiveAt: string | null;
}

export interface SittingDto {
  id: string;
  actorEmail: string;
  targetId: string;
  targetEmail: string;
  reason: string;
  startedAt: string;
  endedAt: string | null;
  endedBy: string | null;
}

function when(iso: string | null): string {
  if (!iso) return "never";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

const card = "rounded-2xl border border-line bg-ink-900/60 p-5";
const label = "font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400";

export function UserDirectory({ users, total, query, adminId }: { users: UserRow[]; total: number; query: string; adminId: string }) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  /** One click from the list into the account, with one confirmation so a misclick cannot land in the wrong one. */
  async function logInAs(user: UserRow) {
    setError(null);
    const confirmed = await confirm({
      title: `Log in to ${user.email}?`,
      body: "You will be signed in as this person and can see and do everything in their account. The whole sitting is recorded against your name and shown to you throughout.",
      confirmLabel: "Log in to this account",
      tone: "default",
    });
    if (!confirmed) return;
    setOpening(user.id);
    startTransition(async () => {
      const result = await startImpersonationAction({ userId: user.id, reason: "" });
      if (result && !result.ok) {
        setError(result.message);
        setOpening(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(search.trim() ? `${workspaceRoutes.admin}?q=${encodeURIComponent(search.trim())}` : workspaceRoutes.admin);
        }}
        className="flex items-center gap-2 rounded-full border border-line bg-ink-900 py-1 pl-4 pr-1 focus-within:border-line-strong"
      >
        <Search className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value.slice(0, 120))}
          placeholder="Search by name or email"
          aria-label="Search accounts"
          className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-ink-50 outline-none placeholder:text-ink-400"
        />
        <Button type="submit" size="sm" className="rounded-full">
          Search
        </Button>
      </form>

      <p className={label} role="status">
        {users.length} of {total} account{total === 1 ? "" : "s"}
      </p>

      {error ? <Alert>{error}</Alert> : null}

      {users.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center text-[13.5px] text-ink-400">Nothing matches.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line" aria-label="Accounts">
          {users.map((user) => {
            const self = user.id === adminId;
            return (
              <li key={user.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-900/70" data-user-row={user.email}>
                <Link href={workspaceRoutes.adminUser(user.id)} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-ink-800 text-ink-300" aria-hidden="true">
                    <UserRound className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] text-ink-50">{user.name}</span>
                      {user.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-200">
                          <ShieldCheck className="size-3" aria-hidden="true" />
                          Admin
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-400">{user.email}</span>
                  </span>
                  <span className="hidden shrink-0 text-right text-[11.5px] text-ink-400 lg:block">
                    <span className="block">joined {when(user.createdAt)}</span>
                    <span className="block">last seen {when(user.lastLoginAt)}</span>
                  </span>
                </Link>
                {user.role === "admin" || self ? (
                  <span className="shrink-0 text-[11.5px] text-ink-500">{self ? "You" : "Administrator"}</span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => void logInAs(user)}
                    loading={pending && opening === user.id}
                    loadingLabel="Opening…"
                    disabled={pending}
                  >
                    <LogIn className="size-4" aria-hidden="true" />
                    Log in to this account
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {dialog}
    </div>
  );
}

export function UserDetail({ user, activity, sittings, isSelf }: { user: UserRow; activity: ActivityDto; sittings: SittingDto[]; isSelf: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const counts: { label: string; value: number }[] = [
    { label: "Chats", value: activity.conversations },
    { label: "Messages", value: activity.messages },
    { label: "Files", value: activity.files },
    { label: "Images", value: activity.images },
    { label: "Chatbots", value: activity.bots },
    { label: "Schedules", value: activity.schedules },
  ];

  async function signInAs() {
    setError(null);
    const confirmed = await confirm({
      title: `Log in to ${user.email}?`,
      body: "You will be signed in as this person and can see everything in their account. The sitting is recorded against your name and shown to you the whole time.",
      confirmLabel: "Log in to this account",
      tone: "default",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await startImpersonationAction({ userId: user.id, reason: reason.trim() });
      if (result && !result.ok) setError(result.message);
    });
  }

  function changeRole(role: "user" | "admin") {
    setError(null);
    startTransition(async () => {
      const result = await setUserRoleAction({ userId: user.id, role });
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(card, "lg:col-span-2")}>
          <p className={label}>Account</p>
          <p className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-ink-50">{user.name}</p>
          <p className="text-[13.5px] text-ink-300">{user.email}</p>
          <p className="mt-3 text-[12.5px] text-ink-400">
            Signs in with {user.provider === "google" ? "Google" : "email and password"} · joined {when(user.createdAt)} · last seen {when(user.lastLoginAt)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {user.role === "admin" ? (
              <Button size="sm" variant="secondary" onClick={() => changeRole("user")} disabled={pending || isSelf}>
                Remove admin
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => changeRole("admin")} disabled={pending}>
                Make admin
              </Button>
            )}
            {isSelf ? <span className="text-[12.5px] text-ink-400">This is your own account.</span> : null}
          </div>
        </div>

        <div className={card}>
          <p className={label}>Sign in as this account</p>
          {user.role === "admin" ? (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-400">An administrator&rsquo;s account cannot be opened this way.</p>
          ) : (
            <>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">Recorded against your name, visible to you throughout, and it ends after an hour.</p>
              <Field id="reason" label="Why (optional, kept in the record)" className="mt-3">
                <input
                  id="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value.slice(0, 300))}
                  placeholder="Reproducing their billing report issue"
                  className={inputClassName}
                />
              </Field>
              <Button className="mt-3" onClick={() => void signInAs()} loading={pending} loadingLabel="Opening…" disabled={isSelf}>
                <LogIn className="size-4" aria-hidden="true" />
                Log in to this account
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={card}>
        <p className={label}>Activity</p>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {counts.map((item) => (
            <li key={item.label}>
              <span className="block text-[24px] font-semibold leading-none tracking-[-0.02em] text-ink-50">{item.value}</span>
              <span className="mt-1 block text-[12px] text-ink-400">{item.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] text-ink-400">Last active {when(activity.lastActiveAt)}</p>
        {activity.recent.length > 0 ? (
          <ul className="mt-4 divide-y divide-line border-t border-line" aria-label="Recent activity">
            {activity.recent.map((item, index) => (
              <li key={index} className="flex items-center gap-3 py-2.5 text-[13px]">
                <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">{item.kind}</span>
                <span className="min-w-0 flex-1 truncate text-ink-100">{item.label}</span>
                <span className="shrink-0 text-[11.5px] text-ink-400">{when(item.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-ink-400">Nothing yet.</p>
        )}
      </div>

      <div className={card}>
        <p className={label}>Times this account was opened by an admin</p>
        {sittings.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-400">Never.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line" aria-label="Impersonation history">
            {sittings.map((sitting) => (
              <li key={sitting.id} className="py-2.5 text-[13px]">
                <span className="flex flex-wrap items-center gap-x-2 text-ink-100">
                  {sitting.actorEmail}
                  <span className="text-ink-400">{when(sitting.startedAt)}</span>
                  {sitting.endedAt ? (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">ended {sitting.endedBy}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-success">
                      <Check className="size-3" aria-hidden="true" />
                      open
                    </span>
                  )}
                </span>
                {sitting.reason ? <span className="mt-0.5 block text-[12.5px] text-ink-400">{sitting.reason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {dialog}
    </div>
  );
}
