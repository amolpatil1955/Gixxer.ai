"use client";

import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createBotForWizardAction, publishBotAction, updateThemeAction } from "@/lib/bots/actions";
import { BOT_USE_CASES, USE_CASES, type BotUseCase } from "@/lib/bots/constants";
import { BOT_THEMES, DEFAULT_THEME_KEY, tokensFor } from "@/lib/bots/themes";
import { sourceWorking, type SourceDto } from "@/lib/bots/types";
import { cn } from "@/lib/utils/cn";
import { workspaceRoutes } from "@/lib/workspace/routes";
import { BotKnowledge } from "./bot-knowledge";
import { WidgetCard, WidgetOnPage, type PreviewContent } from "./widget-preview";

/*
 * Making a chatbot, one step at a time: name it, say what it is for, give it
 * knowledge, watch that knowledge being learned, choose how it looks, then put
 * it on a website. The bot is created at the end of the first step, so nothing
 * typed later is lost and the owner can leave and come back.
 */

const STEPS = ["Name", "Use case", "Knowledge", "Training", "Theme", "Publish"] as const;
type Step = (typeof STEPS)[number];

interface Props {
  origin: string;
  libraryFiles: { id: string; name: string }[];
  crawlingAvailable: boolean;
}

function Stepper({ index }: { index: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Steps">
      {STEPS.map((step, position) => {
        const done = position < index;
        const current = position === index;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                done ? "bg-ink-50 text-ink-950" : current ? "bg-accent text-on-accent" : "border border-line text-ink-400",
              )}
              aria-hidden="true"
            >
              {done ? <Check className="size-3.5" /> : position + 1}
            </span>
            <span className={cn("text-[12.5px]", current ? "text-ink-50" : done ? "text-ink-300" : "text-ink-500")} aria-current={current ? "step" : undefined}>
              {step}
            </span>
            {position < STEPS.length - 1 ? <span className="hidden h-px w-5 bg-line sm:block" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The training step: a calm progress read-out while the knowledge is learned. */
function Training({ sources }: { sources: SourceDto[] }) {
  const ready = sources.filter((source) => source.status === "indexed");
  const failed = sources.filter((source) => source.status === "failed");
  const working = sources.filter((source) => sourceWorking(source.status));
  const passages = ready.reduce((total, source) => total + source.chunkCount, 0);
  const pages = ready.reduce((total, source) => total + source.pageCount, 0);
  const done = working.length === 0;
  const percent = sources.length === 0 ? 0 : Math.round(((ready.length + failed.length) / sources.length) * 100);

  return (
    <div className="plate rounded-2xl p-6">
      <div className="flex items-center gap-3">
        {done ? (
          <span className="flex size-10 items-center justify-center rounded-full bg-success/15 text-success" aria-hidden="true">
            <Check className="size-5" />
          </span>
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden="true">
            <LoaderCircle className="size-5 animate-spin" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-ink-50">{done ? "Training complete" : "Learning your knowledge"}</p>
          <p className="text-[13px] text-ink-400">
            {done
              ? `${passages} passage${passages === 1 ? "" : "s"}${pages > 0 ? ` from ${pages} page${pages === 1 ? "" : "s"}` : ""} ready to answer from.`
              : `${ready.length} of ${sources.length} source${sources.length === 1 ? "" : "s"} done.`}
          </p>
        </div>
      </div>

      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Training progress">
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", done ? "bg-success" : "bg-accent")} style={{ width: `${Math.max(4, percent)}%` }} />
      </div>

      <ul className="mt-5 space-y-2" aria-label="Training steps">
        {sources.map((source) => (
          <li key={source.id} className="flex items-center gap-2.5 text-[13px]">
            {source.status === "indexed" ? (
              <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
            ) : source.status === "failed" ? (
              <span className="size-3.5 shrink-0 text-danger" aria-hidden="true">
                ✕
              </span>
            ) : (
              <LoaderCircle className="size-3.5 shrink-0 animate-spin text-accent" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate text-ink-100">{source.title ?? source.name}</span>
            <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-400">
              {source.status === "indexed" ? `${source.chunkCount} passages` : source.status === "failed" ? "failed" : source.status}
            </span>
          </li>
        ))}
      </ul>
      {failed.length > 0 ? <p className="mt-4 text-[12.5px] text-ink-400">A source that failed can be removed or tried again on the Knowledge step. The rest still work.</p> : null}
    </div>
  );
}

export function BotWizard({ origin, libraryFiles, crawlingAvailable }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("Name");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [useCase, setUseCase] = useState<BotUseCase>("support");
  const [botId, setBotId] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [preset, setPreset] = useState(DEFAULT_THEME_KEY);
  const [position, setPosition] = useState<"left" | "right">("right");
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const index = STEPS.indexOf(step);
  const detail = USE_CASES[useCase];
  const tokens = tokensFor(preset, BOT_THEMES.find((theme) => theme.key === preset)?.light.accent);
  const content: PreviewContent = {
    name: name.trim() || "Your assistant",
    businessName: businessName.trim(),
    avatarLetter: (name.trim()[0] ?? "G").toUpperCase(),
    welcomeMessage: detail.welcome,
    suggestedQuestions: detail.questions,
    position,
  };

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  /** Creates the bot once, then moves on. Later steps only update it. */
  function createThenContinue() {
    setError(null);
    setFieldErrors({});
    if (botId) {
      setStep("Knowledge");
      return;
    }
    startTransition(async () => {
      const result = await createBotForWizardAction({ name: name.trim(), useCase });
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setBotId(result.botId ?? null);
      setStep("Knowledge");
      router.refresh();
    });
  }

  function saveThemeThenContinue() {
    if (!botId) return;
    setError(null);
    startTransition(async () => {
      const chosen = BOT_THEMES.find((theme) => theme.key === preset);
      const result = await updateThemeAction({ botId, preset, position, accent: chosen?.light.accent ?? "#2563eb" });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStep("Publish");
      router.refresh();
    });
  }

  function publish() {
    if (!botId) return;
    setError(null);
    startTransition(async () => {
      const result = await publishBotAction({ botId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPublished(true);
      router.refresh();
    });
  }

  const snippet = publicKey ? `<script src="${origin}/widget.js" data-bot="${publicKey}" async></script>` : "";
  const working = sources.some((source) => sourceWorking(source.status));
  const ready = sources.filter((source) => source.status === "indexed").length;

  // The public key is only known after the bot exists; read it from the bot list route.
  useEffect(() => {
    if (!botId || publicKey) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/bots/${botId}/key`);
        if (!response.ok || cancelled) return;
        const json = (await response.json()) as { publicKey?: string };
        if (json.publicKey) setPublicKey(json.publicKey);
      } catch {
        // The Publish step offers the dashboard link instead.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [botId, publicKey]);

  return (
    <div className="space-y-7">
      <Stepper index={index} />
      {error ? <Alert>{error}</Alert> : null}

      {step === "Name" ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setStep("Use case");
            }}
            className="plate space-y-5 rounded-2xl p-5"
          >
            <Field id="bot-name" label="What should the chatbot be called?" error={fieldErrors.name} hint="Visitors see this at the top of the chat.">
              <Input id="bot-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Aria" maxLength={60} autoFocus {...fieldAria("bot-name", fieldErrors.name, true)} />
            </Field>
            <Field id="business-name" label="Your business name" hint="Optional. Shown under the chatbot's name.">
              <Input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Northwind Cycles" maxLength={80} />
            </Field>
            <Button type="submit" disabled={name.trim().length === 0}>
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </form>
          <WidgetCard content={content} tokens={tokens} />
        </div>
      ) : null}

      {step === "Use case" ? (
        <div className="space-y-5">
          <p className="text-[14px] text-ink-300">What will it mostly do? This sets its opening line, its instructions and its first questions. All of it can be changed later.</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Use cases">
            {BOT_USE_CASES.map((option) => {
              const item = USE_CASES[option];
              const active = useCase === option;
              return (
                <li key={option}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setUseCase(option)}
                    className={cn("h-full w-full rounded-2xl border p-4 text-left transition-colors", active ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}
                  >
                    <span className="block text-[14.5px] font-medium text-ink-50">{item.label}</span>
                    <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-400">{item.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setStep("Name")}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
            <Button onClick={createThenContinue} loading={pending} loadingLabel="Creating…">
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === "Knowledge" && botId ? (
        <div className="space-y-6">
          <p className="text-[14px] text-ink-300">Give it something to answer from. Add as many sources as you like; you can come back to this any time.</p>
          <BotKnowledge botId={botId} sources={sources} libraryFiles={libraryFiles} crawlingAvailable={crawlingAvailable} compact onSourcesChange={setSources} />
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setStep("Use case")}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
            <Button onClick={() => setStep("Training")} disabled={sources.length === 0}>
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            {sources.length === 0 ? <span className="text-[12.5px] text-ink-400">Add at least one source.</span> : null}
          </div>
        </div>
      ) : null}

      {step === "Training" && botId ? (
        <div className="space-y-6">
          <Training sources={sources} />
          {/* Mounted but hidden: it keeps advancing the crawls while this step is shown. */}
          <div className="sr-only">
            <BotKnowledge botId={botId} sources={sources} libraryFiles={libraryFiles} crawlingAvailable={crawlingAvailable} compact onSourcesChange={setSources} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setStep("Knowledge")}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
            <Button onClick={() => setStep("Theme")} disabled={working || ready === 0}>
              {working ? "Training…" : "Continue"}
              {working ? null : <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "Theme" ? (
        <div className="space-y-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <p className="text-[14px] text-ink-300">Five ready-made looks. Each one is a complete design, not a colour swap.</p>
              <ul className="grid gap-3 sm:grid-cols-2" aria-label="Themes">
                {BOT_THEMES.map((theme) => {
                  const active = preset === theme.key;
                  return (
                    <li key={theme.key}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPreset(theme.key)}
                        className={cn("flex h-full w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors", active ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong")}
                      >
                        <span className="mt-0.5 flex shrink-0 gap-1" aria-hidden="true">
                          <span className="size-5 rounded-full" style={{ background: theme.light.accent }} />
                          <span className="size-5 rounded-full border" style={{ background: theme.light.surface, borderColor: theme.light.border }} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium text-ink-50">{theme.name}</span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-ink-400">{theme.description}</span>
                          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{theme.industry}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <fieldset>
                <legend className="text-[13px] font-medium text-ink-200">Position on the page</legend>
                <div className="mt-2 flex gap-2">
                  {(["left", "right"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      aria-pressed={position === side}
                      onClick={() => setPosition(side)}
                      className={cn("rounded-full border px-3.5 py-1.5 text-[13px] capitalize transition-colors", position === side ? "border-transparent bg-ink-50 text-ink-950" : "border-line-strong text-ink-200 hover:border-ink-400")}
                    >
                      Bottom {side}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400">Live preview</p>
              <WidgetCard content={content} tokens={tokens} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setStep("Training")}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
            <Button onClick={saveThemeThenContinue} loading={pending} loadingLabel="Saving…">
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === "Publish" && botId ? (
        <div className="space-y-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div className="space-y-5">
              <div className="plate rounded-2xl p-5">
                <p className="text-[15px] font-medium text-ink-50">{published ? "Live and answering" : "Ready to go live"}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-400">
                  {published
                    ? "The widget now answers on any site carrying the snippet below."
                    : "Going live lets the widget answer visitors. Until then it stays hidden, and you can keep editing."}
                </p>
                {published ? null : (
                  <Button className="mt-4" onClick={publish} loading={pending} loadingLabel="Publishing…">
                    Go live
                  </Button>
                )}
                {published && publicKey ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/embed/${publicKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] text-ink-100 hover:border-ink-400"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      Open the public preview
                    </Link>
                    <Link href={workspaceRoutes.chatbot(botId, "overview")} className="inline-flex h-9 items-center rounded-full bg-ink-50 px-4 text-[13px] font-medium text-ink-950 hover:bg-white">
                      Go to the dashboard
                    </Link>
                  </div>
                ) : null}
              </div>

              {publicKey ? (
                <div className="plate rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400">Add it to your website</p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(snippet);
                          setCopied(true);
                        } catch {
                          // The snippet is selectable either way.
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-ink-900 px-2.5 py-1 text-[12px] text-ink-200 hover:border-ink-400 hover:text-ink-50"
                    >
                      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-ink-950/70 px-4 py-3 font-mono text-[12px] leading-relaxed text-ink-200">
                    <code>{snippet}</code>
                  </pre>
                  <p className="mt-3 text-[12.5px] text-ink-400">Paste it once, before the closing body tag of any page. Nothing else to install.</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400">On your website</p>
              <WidgetOnPage content={content} preset={preset} accent={BOT_THEMES.find((theme) => theme.key === preset)?.light.accent} />
            </div>
          </div>
          {published ? null : (
            <Button variant="secondary" onClick={() => setStep("Theme")}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
