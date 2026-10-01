"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, inputClassName } from "@/components/ui/input";
import { updateAppearanceAction, updateBehaviorAction, updateInstructionsAction, updateSettingsAction, type ActionResult } from "@/lib/bots/actions";
import { BOT_TONES, TONE_GUIDANCE, TONE_LABELS, WIDGET_POSITIONS, type BotTone, type WidgetPosition } from "@/lib/bots/constants";
import type { BotDto } from "@/lib/bots/types";
import { cn } from "@/lib/utils/cn";

const textareaClassName = `${inputClassName} h-auto min-h-[120px] resize-y py-3 leading-relaxed`;

function useSave(action: (input: unknown) => Promise<ActionResult>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function save(input: unknown) {
    setError(null);
    setFieldErrors({});
    setSaved(false);
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 2000);
    });
  }

  return { save, pending, error, fieldErrors, saved };
}

function FormShell({ onSubmit, pending, saved, error, children }: { onSubmit: () => void; pending: boolean; saved: boolean; error: string | null; children: ReactNode }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-6"
      aria-busy={pending}
    >
      {error ? <Alert>{error}</Alert> : null}
      {children}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} loadingLabel="Saving…">
          Save changes
        </Button>
        <span role="status" className="text-[13px] text-ink-400">
          {saved ? "Saved." : ""}
        </span>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function SettingsForm({ bot }: { bot: BotDto }) {
  const { save, pending, error, fieldErrors, saved } = useSave(updateSettingsAction);
  const [name, setName] = useState(bot.name);
  const [businessName, setBusinessName] = useState(bot.businessName);
  const [businessInfo, setBusinessInfo] = useState(bot.businessInfo);
  const [welcomeMessage, setWelcomeMessage] = useState(bot.welcomeMessage);
  const [questions, setQuestions] = useState(bot.suggestedQuestions.join("\n"));
  const [origins, setOrigins] = useState(bot.allowedOrigins.join("\n"));

  return (
    <FormShell
      pending={pending}
      saved={saved}
      error={error}
      onSubmit={() =>
        save({
          botId: bot.id,
          name,
          businessName,
          businessInfo,
          welcomeMessage,
          suggestedQuestions: questions.split("\n").map((line) => line.trim()).filter(Boolean),
          allowedOrigins: origins.split("\n").map((line) => line.trim()).filter(Boolean),
        })
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Bot name" error={fieldErrors.name}>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} {...fieldAria("name", fieldErrors.name)} />
        </Field>
        <Field id="businessName" label="Business name" error={fieldErrors.businessName}>
          <Input id="businessName" value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={80} placeholder="Northwind Cycles" />
        </Field>
      </div>
      <Field id="welcomeMessage" label="Welcome message" error={fieldErrors.welcomeMessage} hint="The first thing a visitor reads.">
        <Input id="welcomeMessage" value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} maxLength={300} {...fieldAria("welcomeMessage", fieldErrors.welcomeMessage, true)} />
      </Field>
      <Field id="businessInfo" label="About the business" hint="What you do, where you are, hours, anything the bot should always know.">
        <textarea id="businessInfo" value={businessInfo} onChange={(event) => setBusinessInfo(event.target.value)} maxLength={4000} className={textareaClassName} />
      </Field>
      <Field id="questions" label="Suggested questions" hint="One per line, up to six. Shown as buttons in the widget." error={fieldErrors.suggestedQuestions}>
        <textarea id="questions" value={questions} onChange={(event) => setQuestions(event.target.value)} className={`${textareaClassName} min-h-[90px]`} />
      </Field>
      <Field id="origins" label="Allowed websites" hint="One origin per line, like https://example.com. Leave empty to allow any site." error={fieldErrors.allowedOrigins}>
        <textarea id="origins" value={origins} onChange={(event) => setOrigins(event.target.value)} className={`${textareaClassName} min-h-[70px] font-mono text-[13px]`} />
      </Field>
    </FormShell>
  );
}

export function InstructionsForm({ bot }: { bot: BotDto }) {
  const { save, pending, error, fieldErrors, saved } = useSave(updateInstructionsAction);
  const [instructions, setInstructions] = useState(bot.instructions);
  const [tone, setTone] = useState<BotTone>(bot.tone);

  return (
    <FormShell pending={pending} saved={saved} error={error} onSubmit={() => save({ botId: bot.id, instructions, tone })}>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-200">Tone</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {BOT_TONES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={tone === option}
              onClick={() => setTone(option)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                tone === option ? "border-ink-50 bg-ink-800" : "border-line hover:border-ink-400",
              )}
            >
              <span className="block text-[14px] font-medium text-ink-50">{TONE_LABELS[option]}</span>
              <span className="mt-1 block text-[12px] leading-snug text-ink-400">{TONE_GUIDANCE[option]}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Field id="instructions" label="Instructions" hint="Boundaries, priorities, what to do when unsure. The bot follows these on every reply." error={fieldErrors.instructions}>
        <textarea
          id="instructions"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          maxLength={4000}
          placeholder="Never quote prices that are not in the catalog. Offer to book a call for anything about warranties."
          className={`${textareaClassName} min-h-[180px]`}
        />
      </Field>
    </FormShell>
  );
}

const SWATCHES = ["#030000", "#1f2937", "#0f766e", "#1d4ed8", "#7c3aed", "#b91c1c", "#c2410c", "#a16207"];

export function AppearanceForm({ bot }: { bot: BotDto }) {
  const { save, pending, error, fieldErrors, saved } = useSave(updateAppearanceAction);
  const [avatarLetter, setAvatarLetter] = useState(bot.avatarLetter);
  const [accent, setAccent] = useState(bot.theme.accent);
  const [position, setPosition] = useState<WidgetPosition>(bot.theme.position);

  return (
    <FormShell pending={pending} saved={saved} error={error} onSubmit={() => save({ botId: bot.id, avatarLetter, accent, position })}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Field id="avatarLetter" label="Avatar letters" hint="One or two characters." error={fieldErrors.avatarLetter}>
            <Input id="avatarLetter" value={avatarLetter} onChange={(event) => setAvatarLetter(event.target.value.slice(0, 2))} maxLength={2} className="w-24 uppercase" />
          </Field>
          <fieldset>
            <legend className="text-[13px] font-medium text-ink-200">Accent</legend>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Accent ${swatch}`}
                  aria-pressed={accent === swatch}
                  onClick={() => setAccent(swatch)}
                  className={cn("size-8 rounded-full border border-line-strong", accent === swatch && "ring-2 ring-ink-50 ring-offset-2 ring-offset-ink-950")}
                  style={{ background: swatch }}
                />
              ))}
              <label className="ml-2 flex items-center gap-2 font-mono text-[11px] text-ink-400">
                Custom
                <input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} aria-label="Custom accent colour" className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" />
              </label>
            </div>
            {fieldErrors.accent ? <p className="mt-1 text-[13px] text-danger">{fieldErrors.accent}</p> : null}
          </fieldset>
          <fieldset>
            <legend className="text-[13px] font-medium text-ink-200">Position</legend>
            <div className="mt-2 flex gap-2">
              {WIDGET_POSITIONS.map((side) => (
                <button
                  key={side}
                  type="button"
                  aria-pressed={position === side}
                  onClick={() => setPosition(side)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[13px] capitalize transition-colors",
                    position === side ? "border-transparent bg-ink-50 text-ink-950" : "border-line-strong text-ink-200 hover:border-ink-400",
                  )}
                >
                  Bottom {side}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Live preview of the launcher on a host page */}
        <div aria-hidden="true" className="relative h-64 overflow-hidden rounded-2xl border border-line bg-ink-900/60 p-4">
          <div className="h-2 w-20 rounded bg-ink-600" />
          <div className="mt-3 h-3 w-2/3 rounded bg-ink-500" />
          <div className="mt-2 h-2 w-1/2 rounded bg-ink-700" />
          <div className="mt-2 h-2 w-3/5 rounded bg-ink-700" />
          <div className={cn("absolute bottom-4 flex flex-col items-end gap-2", position === "right" ? "right-4" : "left-4 items-start")}>
            <div className="w-40 rounded-xl border border-line bg-ink-950 p-2.5 shadow-lift">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: accent }}>
                  {avatarLetter || bot.avatarLetter}
                </span>
                <span className="text-[11px] text-ink-100">{bot.name}</span>
              </div>
              <p className="mt-2 rounded-lg bg-ink-800 px-2 py-1.5 text-[10px] leading-snug text-ink-200">{bot.welcomeMessage}</p>
            </div>
            <span className="flex size-11 items-center justify-center rounded-full shadow-lift" style={{ background: accent }}>
              <span className="size-4 rounded-sm border-2 border-white/90" />
            </span>
          </div>
        </div>
      </div>
    </FormShell>
  );
}

export function BehaviorForm({ bot }: { bot: BotDto }) {
  const { save, pending, error, saved } = useSave(updateBehaviorAction);
  const [values, setValues] = useState(bot.behavior);
  const items: { key: keyof typeof values; label: string; detail: string }[] = [
    { key: "knowledgeOnly", label: "Answer only from knowledge", detail: "When the answer is not in the sources, the bot says so instead of guessing." },
    { key: "citeSources", label: "Mention sources", detail: "Replies name the page or file they came from." },
    { key: "collectLeads", label: "Collect leads", detail: "Visitors can leave their name and email; they appear in the Leads tab." },
  ];

  return (
    <FormShell pending={pending} saved={saved} error={error} onSubmit={() => save({ botId: bot.id, ...values })}>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-4 px-4 py-4">
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-medium text-ink-50">{item.label}</span>
              <span className="block text-[12.5px] text-ink-400">{item.detail}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={values[item.key]}
              aria-label={item.label}
              onClick={() => setValues((current) => ({ ...current, [item.key]: !current[item.key] }))}
              className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", values[item.key] ? "bg-ink-50" : "bg-ink-700")}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full transition-all", values[item.key] ? "left-[22px] bg-ink-950" : "left-0.5 bg-ink-300")} />
            </button>
          </li>
        ))}
      </ul>
    </FormShell>
  );
}
