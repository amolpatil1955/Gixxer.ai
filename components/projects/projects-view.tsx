"use client";

import { Folder, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Panel, SearchField, timeAgo } from "@/components/workspace/primitives";
import { createProjectAction } from "@/lib/projects/actions";
import type { ProjectDto } from "@/lib/projects/types";
import { PROJECT_NAME_MAX } from "@/lib/projects/validation";
import { workspaceRoutes } from "@/lib/workspace/routes";

/** The projects table and the little form that makes a new one. */
export function ProjectsView({ projects }: { projects: ProjectDto[] }) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createProjectAction({ name });
      // A successful action redirects to the new project.
      if (result && !result.ok) setError(result.message);
    });
  }

  const visible = projects.filter((project) => !query.trim() || project.name.toLowerCase().includes(query.trim().toLowerCase()));
  const formatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <SearchField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" aria-label="Search projects" className="w-full sm:w-64" />
        {creating ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              create();
            }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, PROJECT_NAME_MAX))}
              onKeyDown={(event) => event.key === "Escape" && setCreating(false)}
              placeholder="Project name"
              aria-label="Project name"
              className="h-10 w-48 rounded-full border border-line bg-ink-900 px-4 text-[13.5px] text-ink-50 outline-none focus:border-ink-400"
            />
            <button type="submit" disabled={!name.trim() || pending} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-50 px-4 text-[13px] font-medium text-ink-950 transition-colors hover:bg-white disabled:opacity-60">
              {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              Create project
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex h-10 items-center rounded-full bg-ink-50 px-4 text-[13px] font-medium text-ink-950 transition-colors hover:bg-white">
            New
          </button>
        )}
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
          <Folder className="mx-auto size-6 text-ink-300" aria-hidden="true" />
          <p className="mt-3 text-[15px] font-medium text-ink-50">No projects yet</p>
          <p className="mt-1.5 text-[13.5px] text-ink-400">A project keeps related chats together and gives every one of them the same instructions.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-ink-400">Nothing matches.</p>
      ) : (
        <Panel>
          <div className="grid grid-cols-[minmax(0,1fr)_80px_90px] gap-3 border-b border-line px-4 py-2 text-[12px] text-ink-400">
            <span>Name</span>
            <span>Chats</span>
            <span>Modified</span>
          </div>
          <ul aria-label="Projects">
            {visible.map((project) => (
              <li key={project.id}>
                <Link href={workspaceRoutes.project(project.id)} className="grid grid-cols-[minmax(0,1fr)_80px_90px] items-center gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-ink-900/70">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-900 text-ink-200" aria-hidden="true">
                      <Folder className="size-4" />
                    </span>
                    <span className="truncate text-[14px] font-medium text-ink-50">{project.name}</span>
                  </span>
                  <span className="font-mono text-[12px] text-ink-300">{project.conversationCount}</span>
                  <span className="text-[12.5px] text-ink-300" title={timeAgo(project.updatedAt)}>
                    {formatter.format(new Date(project.updatedAt))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
