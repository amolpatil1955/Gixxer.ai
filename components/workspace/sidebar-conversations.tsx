"use client";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { Check, ChevronRight, Ellipsis, Folder, Pencil, Pin, PinOff, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteConversationAction, moveConversationAction, pinConversationAction, renameConversationAction } from "@/lib/chat/actions";
import type { ConversationDto } from "@/lib/chat/types";
import type { ProjectSummaryDto } from "@/lib/projects/types";
import { cn } from "@/lib/utils/cn";
import { workspaceRoutes } from "@/lib/workspace/routes";

function ConversationRow({ conversation, projects }: { conversation: ConversationDto; projects: ProjectSummaryDto[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname === workspaceRoutes.chat(conversation.id);
  const [menu, setMenu] = useState(false);
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLLIElement>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) {
        setMenu(false);
        setMoving(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        setMoving(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function save() {
    const next = title.trim();
    setEditing(false);
    if (!next || next === conversation.title) {
      setTitle(conversation.title);
      return;
    }
    startTransition(async () => {
      const result = await renameConversationAction({ conversationId: conversation.id, title: next });
      if (!result.ok) setTitle(conversation.title);
      router.refresh();
    });
  }

  function togglePin() {
    setMenu(false);
    startTransition(async () => {
      await pinConversationAction({ conversationId: conversation.id, pinned: !conversation.pinned });
      router.refresh();
    });
  }

  function move(projectId: string | null) {
    setMenu(false);
    setMoving(false);
    if (projectId === conversation.projectId) return;
    startTransition(async () => {
      await moveConversationAction({ conversationId: conversation.id, projectId });
      router.refresh();
    });
  }

  async function remove() {
    setMenu(false);
    if (!(await confirm({ title: "Delete this chat?", body: `"${conversation.title}" and its files will be deleted. This cannot be undone.` }))) return;
    startTransition(async () => {
      await deleteConversationAction({ conversationId: conversation.id });
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li className="flex items-center gap-1 rounded-lg bg-ink-800 px-2 py-1">
        <input
          ref={input}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") {
              setEditing(false);
              setTitle(conversation.title);
            }
          }}
          aria-label="Conversation title"
          maxLength={120}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-50 outline-none"
        />
        <button type="button" onClick={save} aria-label="Save title" className="rounded p-1 text-ink-300 hover:text-ink-50">
          <Check className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setTitle(conversation.title);
          }}
          aria-label="Cancel"
          className="rounded p-1 text-ink-300 hover:text-ink-50"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </li>
    );
  }

  const project = conversation.projectId ? projects.find((item) => item.id === conversation.projectId) : null;

  return (
    <li ref={root} className={cn("group relative flex items-center rounded-lg", active ? "bg-ink-700" : "hover:bg-ink-800", pending && "opacity-60")}>
      <Link
        href={workspaceRoutes.chat(conversation.id)}
        aria-current={active ? "page" : undefined}
        title={project ? `${conversation.title} · ${project.name}` : conversation.title}
        className={cn("flex min-w-0 flex-1 items-center gap-2 px-2.5 py-[7px] text-[13px]", active ? "text-ink-50" : "text-ink-200 group-hover:text-ink-50")}
      >
        {conversation.pinned ? <Pin className="size-3 shrink-0 text-ink-400" aria-hidden="true" /> : null}
        <span className="truncate">{conversation.title}</span>
        {project ? <Folder className="ml-auto size-3 shrink-0 text-ink-500" aria-label={`In project ${project.name}`} /> : null}
      </Link>
      <button
        type="button"
        onClick={() => {
          setMenu((value) => !value);
          setMoving(false);
        }}
        aria-label={`Options for ${conversation.title}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        className={cn(
          "mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-ink-300 hover:text-ink-50",
          menu ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
        )}
      >
        <Ellipsis className="size-4" aria-hidden="true" />
      </button>
      {menu ? (
        <div role="menu" aria-label={`Options for ${conversation.title}`} className="absolute right-1 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-ink-900 p-1 shadow-lift">
          {moving ? (
            <>
              <p className="px-2.5 pb-1 pt-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-400">Move to</p>
              <button type="button" role="menuitem" onClick={() => move(null)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-100 hover:bg-ink-800">
                {conversation.projectId === null ? <Check className="size-3.5" aria-hidden="true" /> : <span className="size-3.5" aria-hidden="true" />}
                No project
              </button>
              {projects.map((item) => (
                <button key={item.id} type="button" role="menuitem" onClick={() => move(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-100 hover:bg-ink-800">
                  {conversation.projectId === item.id ? <Check className="size-3.5" aria-hidden="true" /> : <Folder className="size-3.5 text-ink-400" aria-hidden="true" />}
                  <span className="truncate">{item.name}</span>
                </button>
              ))}
              {projects.length === 0 ? <p className="px-2.5 py-2 text-[12px] text-ink-400">No projects yet.</p> : null}
            </>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={togglePin} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-100 hover:bg-ink-800">
                {conversation.pinned ? <PinOff className="size-3.5" aria-hidden="true" /> : <Pin className="size-3.5" aria-hidden="true" />}
                {conversation.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  setEditing(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-100 hover:bg-ink-800"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Rename
              </button>
              <button type="button" role="menuitem" aria-haspopup="menu" onClick={() => setMoving(true)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-100 hover:bg-ink-800">
                <Folder className="size-3.5" aria-hidden="true" />
                Move to project
                <ChevronRight className="ml-auto size-3.5 text-ink-400" aria-hidden="true" />
              </button>
              <button type="button" role="menuitem" onClick={remove} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-danger hover:bg-ink-800">
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete
              </button>
            </>
          )}
        </div>
      ) : null}
      {dialog}
    </li>
  );
}

function Group({ label, items, projects }: { label: string; items: ConversationDto[]; projects: ProjectSummaryDto[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="px-2.5 pb-1.5 text-[12px] font-medium text-ink-400">{label}</p>
      <ul className="space-y-px">
        {items.map((conversation) => (
          <ConversationRow key={conversation.id} conversation={conversation} projects={projects} />
        ))}
      </ul>
    </div>
  );
}

/** Pinned chats first, then everything else newest first, as the sidebar of a chat app. */
export function SidebarConversations({ conversations, projects }: { conversations: ConversationDto[]; projects: ProjectSummaryDto[] }) {
  if (conversations.length === 0) {
    return <p className="px-2.5 text-[12.5px] leading-relaxed text-ink-400">Your chats will appear here.</p>;
  }
  const pinned = conversations.filter((conversation) => conversation.pinned);
  const recents = conversations.filter((conversation) => !conversation.pinned);
  return (
    <div className="space-y-5">
      <Group label="Pinned" items={pinned} projects={projects} />
      <Group label="Recents" items={recents} projects={projects} />
    </div>
  );
}
