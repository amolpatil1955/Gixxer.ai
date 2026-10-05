"use client";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { Check, Folder, MessageSquare, Pencil, SquarePen, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IconButton, Panel, timeAgo } from "@/components/workspace/primitives";
import type { ConversationDto } from "@/lib/chat/types";
import { deleteProjectAction, updateProjectAction } from "@/lib/projects/actions";
import type { ProjectDto } from "@/lib/projects/types";
import { PROJECT_INSTRUCTIONS_MAX, PROJECT_NAME_MAX } from "@/lib/projects/validation";
import { workspaceRoutes } from "@/lib/workspace/routes";

/** One project: its name, its standing instructions, and the chats inside it. */
export function ProjectView({ project, conversations }: { project: ProjectDto; conversations: ConversationDto[] }) {
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const nameInput = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (editingName) nameInput.current?.select();
  }, [editingName]);

  function saveName() {
    const next = name.trim();
    setEditingName(false);
    if (!next || next === project.name) {
      setName(project.name);
      return;
    }
    startTransition(async () => {
      const result = await updateProjectAction({ projectId: project.id, name: next });
      if (!result.ok) {
        setName(project.name);
        setMessage({ tone: "error", text: result.message });
        return;
      }
      router.refresh();
    });
  }

  function saveInstructions() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateProjectAction({ projectId: project.id, instructions });
      setMessage(result.ok ? { tone: "ok", text: "Saved. Every chat in this project follows these." } : { tone: "error", text: result.message });
      if (result.ok) router.refresh();
    });
  }

  async function remove() {
    if (!(await confirm({ title: `Delete "${project.name}"?`, body: "Its chats are kept and become ordinary chats." }))) return;
    startTransition(async () => {
      const result = await deleteProjectAction({ projectId: project.id });
      if (result && !result.ok) setMessage({ tone: "error", text: result.message });
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-ink-900 text-ink-200" aria-hidden="true">
          <Folder className="size-5" />
        </span>
        {editingName ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <input
              ref={nameInput}
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, PROJECT_NAME_MAX))}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveName();
                if (event.key === "Escape") {
                  setEditingName(false);
                  setName(project.name);
                }
              }}
              aria-label="Project name"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-ink-900 px-3 text-[20px] font-semibold tracking-[-0.02em] text-ink-50 outline-none focus:border-ink-400 sm:max-w-md"
            />
            <IconButton label="Save name" onClick={saveName}>
              <Check className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Cancel"
              onClick={() => {
                setEditingName(false);
                setName(project.name);
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <h1 className="truncate text-[24px] font-semibold tracking-[-0.02em] text-ink-50 sm:text-[28px]">{project.name}</h1>
            <IconButton label="Rename project" size="sm" onClick={() => setEditingName(true)}>
              <Pencil className="size-3.5" aria-hidden="true" />
            </IconButton>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Link href={`${workspaceRoutes.home}?project=${project.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-50 pl-3.5 pr-4 text-[13px] font-medium text-ink-950 transition-colors hover:bg-white">
            <SquarePen className="size-4" aria-hidden="true" />
            New chat
          </Link>
          <IconButton label="Delete project" onClick={remove} disabled={pending} className="hover:text-danger">
            <Trash2 className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {message?.tone === "error" ? <Alert>{message.text}</Alert> : null}

      <section aria-labelledby="project-instructions" className="rounded-2xl border border-line bg-ink-900/40 p-4 sm:p-5">
        <h2 id="project-instructions" className="text-[15px] font-semibold text-ink-50">
          Instructions
        </h2>
        <p className="mt-1 text-[13px] text-ink-400">Every chat in this project starts with these, ahead of your personal instructions.</p>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value.slice(0, PROJECT_INSTRUCTIONS_MAX))}
          rows={5}
          aria-label="Project instructions"
          placeholder="Who the work is for, what to assume, how answers should be laid out…"
          className="mt-3 w-full resize-y rounded-xl border border-line bg-ink-950/60 px-3 py-2.5 text-[13.5px] leading-relaxed text-ink-50 outline-none transition-colors placeholder:text-ink-500 hover:border-line-strong focus:border-ink-400"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p role="status" className="text-[12.5px] text-ink-300">
            {message?.tone === "ok" ? message.text : `${instructions.length}/${PROJECT_INSTRUCTIONS_MAX}`}
          </p>
          <Button size="sm" onClick={saveInstructions} disabled={instructions === project.instructions} loading={pending} loadingLabel="Saving…">
            Save instructions
          </Button>
        </div>
      </section>

      <section aria-labelledby="project-chats">
        <h2 id="project-chats" className="text-[15px] font-semibold text-ink-50">
          Chats
        </h2>
        {conversations.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-ink-400">No chats in this project yet. Start one, or move an existing chat here from its menu in the sidebar.</p>
        ) : (
          <Panel className="mt-3">
            <ul aria-label="Project chats">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link href={workspaceRoutes.chat(conversation.id)} className="flex items-center gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-ink-900/70">
                    <MessageSquare className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink-50">{conversation.title}</span>
                    <span className="shrink-0 text-[12px] text-ink-400">{timeAgo(conversation.lastMessageAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>
      {dialog}
    </div>
  );
}
