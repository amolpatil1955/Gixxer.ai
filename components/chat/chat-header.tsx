"use client";

import { Check, Ellipsis, Folder, Pencil, Pin, PinOff, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteConversationAction, pinConversationAction, renameConversationAction } from "@/lib/chat/actions";
import { cn } from "@/lib/utils/cn";
import { workspaceRoutes } from "@/lib/workspace/routes";

export interface ChatHeaderProps {
  conversationId: string;
  title: string;
  pinned: boolean;
  project: { id: string; name: string } | null;
}

/** The bar above a conversation: its title, where it lives, and what can be done to it. */
export function ChatHeader({ conversationId, title, pinned, project }: ChatHeaderProps) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!menu) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setMenu(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function save() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    startTransition(async () => {
      const result = await renameConversationAction({ conversationId, title: next });
      if (!result.ok) setDraft(title);
      router.refresh();
    });
  }

  function togglePin() {
    setMenu(false);
    startTransition(async () => {
      await pinConversationAction({ conversationId, pinned: !pinned });
      router.refresh();
    });
  }

  function remove() {
    setMenu(false);
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteConversationAction({ conversationId });
    });
  }

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 px-3 sm:px-5" data-chat-header>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {editing ? (
          <>
            <input
              ref={input}
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, 120))}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
                if (event.key === "Escape") {
                  setEditing(false);
                  setDraft(title);
                }
              }}
              aria-label="Conversation title"
              className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-ink-900 px-2.5 text-[14px] text-ink-50 outline-none focus:border-ink-400 sm:max-w-md"
            />
            <button type="button" onClick={save} aria-label="Save title" className="rounded-lg p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-50">
              <Check className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(title);
              }}
              aria-label="Cancel"
              className="rounded-lg p-1.5 text-ink-300 hover:bg-ink-800 hover:text-ink-50"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            {pinned ? <Pin className="size-3.5 shrink-0 text-ink-400" aria-label="Pinned" /> : null}
            <h1 className="truncate text-[14px] font-medium text-ink-100">{title}</h1>
            {project ? (
              <Link href={workspaceRoutes.project(project.id)} className="hidden shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11.5px] text-ink-300 hover:border-ink-400 hover:text-ink-50 sm:inline-flex">
                <Folder className="size-3" aria-hidden="true" />
                {project.name}
              </Link>
            ) : null}
          </>
        )}
      </div>
      <div ref={root} className="relative">
        <button
          type="button"
          onClick={() => setMenu((value) => !value)}
          aria-label="Conversation options"
          aria-haspopup="menu"
          aria-expanded={menu}
          disabled={pending}
          className={cn("flex size-9 items-center justify-center rounded-full text-ink-300 hover:bg-ink-800 hover:text-ink-50 disabled:opacity-50")}
        >
          <Ellipsis className="size-4.5" aria-hidden="true" />
        </button>
        {menu ? (
          <div role="menu" aria-label="Conversation options" className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-line bg-ink-900 p-1 shadow-lift">
            <button type="button" role="menuitem" onClick={togglePin} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-100 hover:bg-ink-800">
              {pinned ? <PinOff className="size-3.5" aria-hidden="true" /> : <Pin className="size-3.5" aria-hidden="true" />}
              {pinned ? "Unpin" : "Pin"}
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
            <button type="button" role="menuitem" onClick={remove} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-danger hover:bg-ink-800">
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
