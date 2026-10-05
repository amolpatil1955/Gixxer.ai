"use client";

import { ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Lightbox, type LightboxImage } from "@/components/images/lightbox";
import { Alert } from "@/components/ui/alert";
import { switchBranchAction } from "@/lib/chat/actions";
import type { ArtifactDto, ChatWireEvent, CitationDto, ThreadMessageDto } from "@/lib/chat/types";
import { errorMessageFrom, readNdjson } from "@/lib/stream/ndjson-client";
import { cn } from "@/lib/utils/cn";
import { useBooster } from "@/lib/workspace/booster-store";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { artifactUrl } from "./artifact-card";
import { ArtifactPanel } from "./artifact-panel";
import type { PendingAttachment } from "./attachments";
import { ChatHeader, type ChatHeaderProps } from "./chat-header";
import { Composer } from "./composer";
import { ChatMessage, messageClassName } from "./message";
import { Welcome } from "./welcome";

interface ChatViewProps {
  conversationId: string | null;
  initialThread: ThreadMessageDto[];
  /** What to call the reader in the greeting. */
  greetingName: string;
  /** Files to attach to the first message, e.g. when arriving from the library. */
  initialAttachments?: PendingAttachment[];
  /** Start the chat inside this project. */
  project?: { id: string; name: string } | null;
  /** The bar above an existing conversation. */
  header?: Omit<ChatHeaderProps, "conversationId"> | null;
}

/** A picture is never shown in a blink: the loader stays at least this long, so the wait reads as real work. */
const IMAGE_MIN_LOADER_MS = 3200;
const IMAGE_DONE_HOLD_MS = 650;

function draftMessage(partial: Partial<ThreadMessageDto> & { id: string; role: "user" | "assistant" }): ThreadMessageDto {
  return {
    content: "",
    parentId: null,
    status: "complete",
    feedback: null,
    attachments: [],
    citations: [],
    artifacts: [],
    errorMessage: null,
    createdAt: new Date().toISOString(),
    siblingIndex: 0,
    siblingCount: 1,
    siblingIds: [partial.id],
    ...partial,
  };
}

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/**
 * The conversation screen. Owns the visible thread, streams replies from
 * POST /api/chat, and reconciles with the server (router.refresh) once a
 * turn has settled, so the sidebar and branch counts stay truthful.
 */
export function ChatView({ conversationId, initialThread, greetingName, initialAttachments = [], project = null, header = null }: ChatViewProps) {
  const router = useRouter();
  const [thread, setThread] = useState<ThreadMessageDto[]>(initialThread);
  const [attachments, setAttachments] = useState<PendingAttachment[]>(initialAttachments);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [think, setThink] = useBooster();
  const [boosterPulse, setBoosterPulse] = useState(false);
  const [openFile, setOpenFile] = useState<ArtifactDto | null>(null);
  const [openImage, setOpenImage] = useState<LightboxImage | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const abort = useRef<AbortController | null>(null);
  const currentId = useRef<string | null>(conversationId);
  // The same id as state, for what is rendered: the header appears once the server has named the chat.
  const [liveId, setLiveId] = useState(conversationId);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [busy, setBusy] = useState(false);
  const [adopted, setAdopted] = useState(initialThread);

  // A refresh hands us the server's thread. Adopt it once no turn is in flight, so
  // ids, branch counts and statuses come from the source of truth. Adjusted during
  // render, as React recommends for state derived from a prop.
  if (adopted !== initialThread && !busy && streamingId === null) {
    setAdopted(initialThread);
    setThread(initialThread);
  }

  // An opened conversation starts at its end, before the first paint, so nothing jumps.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, []);

  // Follow the reply while the reader is at the bottom; leave them alone once they scroll up.
  useEffect(() => {
    const element = scroller.current;
    if (!element || !stickToBottom.current) return;
    element.scrollTop = element.scrollHeight;
  }, [thread]);

  useEffect(() => () => abort.current?.abort(), []);

  // Booster: the composer glows for a few seconds when switched on.
  useEffect(() => {
    if (!boosterPulse) return;
    const timer = window.setTimeout(() => setBoosterPulse(false), 3200);
    return () => window.clearTimeout(timer);
  }, [boosterPulse]);

  const changeThink = useCallback(
    (next: boolean) => {
      setThink(next);
      setBoosterPulse(next);
    },
    [setThink],
  );

  const openArtifact = useCallback((artifact: ArtifactDto) => {
    if (artifact.kind === "image") setOpenImage({ src: artifactUrl(artifact), downloadHref: artifactUrl(artifact, true), alt: artifact.prompt, caption: artifact.prompt });
    else setOpenFile(artifact);
  }, []);

  // Escape stops a streaming reply.
  useEffect(() => {
    if (streamingId === null) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && abort.current?.abort();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [streamingId]);

  const onScroll = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    const near = distance < 80;
    stickToBottom.current = near;
    setAtBottom(near);
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    stickToBottom.current = true;
    setAtBottom(true);
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, []);

  const patch = useCallback((id: string, update: (message: ThreadMessageDto) => ThreadMessageDto) => {
    setThread((current) => current.map((message) => (message.id === id ? update(message) : message)));
  }, []);

  // Timers that let an image loader finish properly before the picture takes its place.
  const reveals = useRef<number[]>([]);
  const pendingReveals = useRef<Promise<void>[]>([]);
  /** When the current turn started making an image, so the loader can be held for a minimum time. */
  const imageStartedAt = useRef<number | null>(null);
  useEffect(
    () => () => {
      for (const timer of reveals.current) window.clearTimeout(timer);
    },
    [],
  );

  /**
   * Completes the loader to 100%, holds a moment, then reveals the picture. The returned
   * promise settles once the picture is showing, so the turn's final refresh can wait for it.
   */
  const revealImage = useCallback(
    (id: string, startedAt: number) => {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, IMAGE_MIN_LOADER_MS - elapsed);
      const done = new Promise<void>((resolve) => {
        reveals.current.push(
          window.setTimeout(() => {
            patch(id, (message) => ({ ...message, working: "image-done" }));
            reveals.current.push(
              window.setTimeout(() => {
                patch(id, (message) => ({ ...message, working: undefined }));
                resolve();
              }, IMAGE_DONE_HOLD_MS),
            );
          }, wait),
        );
      });
      pendingReveals.current.push(done);
    },
    [patch],
  );

  /** Runs one turn: optimistic messages, then the stream, then a server refresh. */
  const run = useCallback(
    async (body: Record<string, unknown>, optimistic: { user?: ThreadMessageDto; keepUpTo: number }) => {
      setError(null);
      setBusy(true);
      stickToBottom.current = true;
      setAtBottom(true);
      const controller = new AbortController();
      abort.current = controller;
      const temporaryAssistantId = `pending-${Date.now()}`;
      const assistant = draftMessage({ id: temporaryAssistantId, role: "assistant", status: "streaming" });

      setThread((current) => {
        const kept = current.slice(0, optimistic.keepUpTo);
        return optimistic.user ? [...kept, optimistic.user, assistant] : [...kept, assistant];
      });
      setStreamingId(temporaryAssistantId);
      let assistantId = temporaryAssistantId;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...body, think, timeZone: browserTimeZone() }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const message = await errorMessageFrom(response);
          setThread((current) => current.filter((item) => item.id !== temporaryAssistantId && item.id !== optimistic.user?.id));
          setError(message);
          return;
        }
        await readNdjson<ChatWireEvent>(response, (event) => {
          switch (event.type) {
            case "meta": {
              assistantId = event.assistantMessageId;
              setStreamingId(event.assistantMessageId);
              setThread((current) =>
                current.map((message) =>
                  message.id === temporaryAssistantId
                    ? { ...message, id: event.assistantMessageId, parentId: event.userMessageId, siblingIds: [event.assistantMessageId] }
                    : optimistic.user && message.id === optimistic.user.id
                      ? { ...message, id: event.userMessageId, siblingIds: [event.userMessageId] }
                      : message,
                ),
              );
              if (!currentId.current) {
                currentId.current = event.conversationId;
                setLiveId(event.conversationId);
                window.history.replaceState(null, "", workspaceRoutes.chat(event.conversationId));
              }
              break;
            }
            case "status": {
              const now = Date.now();
              imageStartedAt.current = event.working === "image" ? now : null;
              patch(assistantId, (message) => ({ ...message, working: event.working, workingSince: now }));
              break;
            }
            case "artifact": {
              patch(assistantId, (message) => ({ ...message, artifacts: [...message.artifacts.filter((item) => item.refId !== event.item.refId), event.item] }));
              // The loader finishes on its own clock; the picture appears once it has.
              if (event.item.kind === "image" && imageStartedAt.current !== null) {
                revealImage(assistantId, imageStartedAt.current);
                imageStartedAt.current = null;
              }
              break;
            }
            case "token":
              patch(assistantId, (message) => ({ ...message, content: message.content + event.text }));
              break;
            case "citations":
              patch(assistantId, (message) => ({ ...message, citations: event.items as CitationDto[] }));
              break;
            case "done":
              patch(assistantId, (message) => ({ ...message, status: event.status }));
              break;
            case "error":
              patch(assistantId, (message) => ({ ...message, status: "error", errorMessage: event.message }));
              break;
          }
        });
      } catch {
        if (controller.signal.aborted) {
          patch(assistantId, (message) => ({ ...message, status: "stopped" }));
        } else {
          patch(assistantId, (message) => ({ ...message, status: "error", errorMessage: "The connection dropped. Please try again." }));
        }
      } finally {
        setStreamingId(null);
        setBusy(false);
        abort.current = null;
        // A new chat's first turn remounts the page on refresh, which would cut an image loader short.
        const reveals = pendingReveals.current.splice(0);
        if (reveals.length > 0) await Promise.all(reveals);
        router.refresh();
      }
    },
    [patch, revealImage, router, think],
  );

  const send = useCallback(
    (content: string, attachmentIds: string[]) => {
      const user = draftMessage({
        id: `pending-user-${Date.now()}`,
        role: "user",
        content,
        attachments: attachments.filter((attachment) => attachmentIds.includes(attachment.fileId)).map((attachment) => ({ fileId: attachment.fileId, name: attachment.name })),
      });
      setAttachments([]);
      const parentId = thread.length ? thread[thread.length - 1]!.id : null;
      void run(
        {
          kind: "send",
          conversationId: currentId.current ?? undefined,
          parentId: currentId.current ? parentId : undefined,
          projectId: currentId.current ? undefined : (project?.id ?? undefined),
          content,
          attachmentIds,
        },
        { user, keepUpTo: thread.length },
      );
    },
    [attachments, project, run, thread],
  );

  const regenerate = useCallback(
    (userMessageId: string) => {
      if (!currentId.current) return;
      const index = thread.findIndex((message) => message.id === userMessageId);
      if (index === -1) return;
      void run({ kind: "regenerate", conversationId: currentId.current, userMessageId }, { keepUpTo: index + 1 });
    },
    [run, thread],
  );

  const edit = useCallback(
    (message: ThreadMessageDto, content: string) => {
      if (!currentId.current) return;
      const index = thread.findIndex((item) => item.id === message.id);
      if (index === -1) return;
      const user = draftMessage({ id: `pending-user-${Date.now()}`, role: "user", content, attachments: message.attachments });
      void run(
        {
          kind: "send",
          conversationId: currentId.current,
          parentId: message.parentId,
          content,
          attachmentIds: message.attachments.map((attachment) => attachment.fileId),
        },
        { user, keepUpTo: index },
      );
    },
    [run, thread],
  );

  const switchBranch = useCallback(
    async (messageId: string) => {
      if (!currentId.current || busy) return;
      setBusy(true);
      const result = await switchBranchAction({ conversationId: currentId.current, messageId });
      if (!result.ok) setError(result.message);
      router.refresh();
      setBusy(false);
    },
    [busy, router],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const empty = thread.length === 0;

  const composer = (
    <Composer
      onSend={send}
      onStop={stop}
      streaming={streamingId !== null}
      disabled={busy && streamingId === null}
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      think={think}
      onThinkChange={changeThink}
      boosterGlow={boosterPulse || (think && streamingId !== null)}
      autoFocus
      conversationId={liveId}
      placeholder={project ? `Ask anything in ${project.name}` : undefined}
    />
  );

  if (empty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {project ? (
          <div className="flex h-12 shrink-0 items-center px-5 text-[13px] text-ink-400">
            New chat in <span className="ml-1 text-ink-100">{project.name}</span>
          </div>
        ) : null}
        <div className="scrollbar-thin flex flex-1 flex-col justify-center overflow-y-auto px-4 py-10 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <Welcome name={greetingName} />
            <div className="mt-7">
              {error ? <Alert className="mb-3">{error}</Alert> : null}
              {composer}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {header && liveId ? <ChatHeader conversationId={liveId} {...header} /> : null}
      <div ref={scroller} onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-6 sm:px-6">
          <ol className="space-y-7" aria-live="polite" aria-label="Conversation">
            {thread.map((message) => (
              <li key={message.id} className={messageClassName(message.role)}>
                <ChatMessage message={message} streaming={message.id === streamingId} busy={busy} onRegenerate={regenerate} onEdit={edit} onSwitchBranch={switchBranch} onOpenArtifact={openArtifact} />
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="relative shrink-0 px-4 pb-3 pt-1 sm:px-6">
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          aria-hidden={atBottom}
          tabIndex={atBottom ? -1 : 0}
          className={cn(
            "absolute -top-12 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-ink-900 text-ink-100 shadow-lift transition-[opacity,transform] hover:bg-ink-800",
            atBottom ? "pointer-events-none translate-y-2 opacity-0" : "opacity-100",
          )}
        >
          <ArrowDown className="size-4" aria-hidden="true" />
        </button>
        <div className="mx-auto w-full max-w-3xl">
          {error ? <Alert className="mb-3">{error}</Alert> : null}
          {composer}
          <p className="pt-2 text-center text-[11px] text-ink-500">Gixxer can make mistakes. Check important details.</p>
        </div>
      </div>
      <ArtifactPanel artifact={openFile} onClose={() => setOpenFile(null)} />
      <Lightbox image={openImage} onClose={() => setOpenImage(null)} />
    </div>
  );
}
