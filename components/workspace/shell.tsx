"use client";

import { Bot, Clock, Folder, ImageIcon, Library, Menu, PanelLeft, Puzzle, Search, ShieldCheck, SquarePen, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { routes } from "@/lib/auth/routes";
import type { ConversationDto } from "@/lib/chat/types";
import type { ProjectSummaryDto } from "@/lib/projects/types";
import type { UserSettingsDto } from "@/lib/settings/types";
import { cn } from "@/lib/utils/cn";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { useSidebarCollapsed } from "@/lib/workspace/sidebar-store";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { AccountMenu, type ShellUser } from "./account-menu";
import { SettingsDialog, type SettingsSection } from "./settings/settings-dialog";
import { SidebarConversations } from "./sidebar-conversations";

const NAV = [
  { label: "New chat", href: workspaceRoutes.home, Icon: SquarePen, exact: true },
  { label: "Images", href: workspaceRoutes.images, Icon: ImageIcon },
  { label: "Library", href: workspaceRoutes.library, Icon: Library },
  { label: "Scheduled", href: workspaceRoutes.scheduled, Icon: Clock },
  { label: "Plugins", href: workspaceRoutes.plugins, Icon: Puzzle },
  { label: "Projects", href: workspaceRoutes.projects, Icon: Folder },
  { label: "Chatbot Pro", href: workspaceRoutes.chatbots, Icon: Bot },
] as const;

interface ShellProps {
  user: ShellUser;
  conversations: ConversationDto[];
  projects: ProjectSummaryDto[];
  settings: UserSettingsDto;
  /** Shows the Admin entry. False while acting as someone else: no admin powers then. */
  isAdmin?: boolean;
  /** Set for the whole time this session is acting as another account. */
  impersonation?: { email: string; actorEmail: string } | null;
  children: ReactNode;
}

/**
 * The workspace frame: a sidebar that collapses to a rail on wide screens
 * and becomes a drawer on phones, the account menu, and the settings
 * dialog. Everything else is the page.
 */
export function WorkspaceShell({ user, conversations, projects, settings, isAdmin = false, impersonation = null, children }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);

  // A navigation closes the drawer. Adjusted during render, as React recommends.
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  // Escape closes it too, and the page behind it stops scrolling.
  useEffect(() => {
    if (!open) return;
    // While the settings window is up, Escape belongs to it.
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !settingsSection && setOpen(false);
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, settingsSection]);

  const nav = (rail: boolean) => (
    <nav aria-label="Workspace" className={cn(rail ? "px-2" : "px-2.5")}>
      <ul className="space-y-0.5">
        {[...NAV, ...(isAdmin ? [{ label: "Admin", href: workspaceRoutes.admin, Icon: ShieldCheck } as const] : [])].map((item) => {
          const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={rail ? item.label : undefined}
                title={rail ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl text-[13.5px] transition-colors",
                  rail ? "size-10 justify-center" : "h-9 px-2.5",
                  active ? "bg-ink-700 text-ink-50" : "text-ink-200 hover:bg-ink-800 hover:text-ink-50",
                )}
              >
                <item.Icon className="size-4.5 shrink-0" aria-hidden="true" />
                {rail ? null : item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const sidebar = (mode: "drawer" | "panel") => (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between pl-4 pr-2">
        <Link href={routes.home} aria-label="Gixxer.ai home" className="shrink-0">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-0.5">
          <Link href={workspaceRoutes.search} aria-label="Search chats" title="Search chats" className="flex size-9 items-center justify-center rounded-lg text-ink-300 hover:bg-ink-800 hover:text-ink-50">
            <Search className="size-4.5" aria-hidden="true" />
          </Link>
          {mode === "drawer" ? (
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-9 items-center justify-center rounded-lg text-ink-300 hover:bg-ink-800 hover:text-ink-50">
              <X className="size-4.5" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar" className="flex size-9 items-center justify-center rounded-lg text-ink-300 hover:bg-ink-800 hover:text-ink-50">
              <PanelLeft className="size-4.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {nav(false)}

      <div className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        <SidebarConversations conversations={conversations} projects={projects} />
      </div>

      <div className="border-t border-line p-2">
        <AccountMenu user={user} onOpenSettings={setSettingsSection} />
      </div>
    </div>
  );

  const rail = (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-14 items-center">
        <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar" className="flex size-10 items-center justify-center rounded-xl text-ink-300 hover:bg-ink-800 hover:text-ink-50">
          <PanelLeft className="size-4.5" aria-hidden="true" />
        </button>
      </div>
      {nav(true)}
      <div className="mt-1 px-2">
        <Link href={workspaceRoutes.search} aria-label="Search chats" title="Search chats" className="flex size-10 items-center justify-center rounded-xl text-ink-200 hover:bg-ink-800 hover:text-ink-50">
          <Search className="size-4.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-auto p-2">
        <AccountMenu user={user} onOpenSettings={setSettingsSection} compact />
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink-950">
      {impersonation ? <ImpersonationBanner email={impersonation.email} actorEmail={impersonation.actorEmail} /> : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside
        className={cn("hidden shrink-0 border-r border-line bg-ink-950 transition-[width] duration-200 ease-out lg:block", collapsed ? "w-16" : "w-66")}
        aria-label="Sidebar"
      >
        {collapsed ? rail : sidebar("panel")}
      </aside>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              key="drawer"
              id="workspace-drawer"
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-[min(300px,86vw)] border-r border-line bg-ink-950 lg:hidden"
            >
              {sidebar("drawer")}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-2 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-controls="workspace-drawer"
            aria-expanded={open}
            className="flex size-9 items-center justify-center rounded-lg text-ink-100 hover:bg-ink-800"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Link href={routes.home} aria-label="Gixxer.ai home">
            <Wordmark size="sm" />
          </Link>
          <Link href={workspaceRoutes.home} aria-label="New chat" className="ml-auto flex size-9 items-center justify-center rounded-lg text-ink-100 hover:bg-ink-800">
            <SquarePen className="size-4.5" aria-hidden="true" />
          </Link>
        </header>
        <main id="main" className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>

      </div>
      {settingsSection ? <SettingsDialog user={user} initialSettings={settings} section={settingsSection} onSectionChange={setSettingsSection} onClose={() => setSettingsSection(null)} /> : null}
    </div>
  );
}
