"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { savePersonalizationAction } from "@/lib/settings/actions";
import { RESPONSE_TONES, TONE_LABELS, type ResponseTone, type UserSettingsDto } from "@/lib/settings/types";
import { CUSTOM_INSTRUCTIONS_MAX } from "@/lib/settings/validation";
import { SettingRow } from "./settings-dialog";

const TONE_HINTS: Record<ResponseTone, string> = {
  default: "Balanced answers, sized to the question.",
  concise: "Answer first, no preamble.",
  friendly: "Warm and plain-spoken.",
  professional: "Courteous and precise.",
  detailed: "Thorough, with examples and edge cases.",
};

const selectClass =
  "h-9 rounded-xl border border-line bg-ink-800 px-3 pr-8 text-[13px] text-ink-50 outline-none transition-colors hover:border-line-strong focus:border-ink-400";
const inputClass =
  "h-9 w-full rounded-xl border border-line bg-ink-800 px-3 text-[13px] text-ink-50 outline-none transition-colors placeholder:text-ink-500 hover:border-line-strong focus:border-ink-400";

export function PersonalizationSection({ settings, onSaved }: { settings: UserSettingsDto; onSaved: (settings: UserSettingsDto) => void }) {
  const [tone, setTone] = useState<ResponseTone>(settings.tone);
  const [nickname, setNickname] = useState(settings.nickname);
  const [instructions, setInstructions] = useState(settings.customInstructions);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = tone !== settings.tone || nickname !== settings.nickname || instructions !== settings.customInstructions;

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await savePersonalizationAction({ tone, nickname, customInstructions: instructions });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      onSaved(result.settings);
      setMessage({ tone: "ok", text: "Saved. Every new reply uses these." });
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <SettingRow title="Base style and tone" description={TONE_HINTS[tone]}>
        <select value={tone} onChange={(event) => setTone(event.target.value as ResponseTone)} aria-label="Base style and tone" className={selectClass}>
          {RESPONSE_TONES.map((option) => (
            <option key={option} value={option}>
              {TONE_LABELS[option]}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow title="What should Gixxer call you?" description="Leave empty to be greeted by your first name.">
        <input value={nickname} onChange={(event) => setNickname(event.target.value.slice(0, 40))} placeholder="Nickname" aria-label="Nickname" className={`${inputClass} sm:w-56`} />
      </SettingRow>
      <SettingRow title="Custom instructions" description="Standing guidance added to every chat: your role, your tools, how you like answers laid out." stacked>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value.slice(0, CUSTOM_INSTRUCTIONS_MAX))}
          rows={5}
          aria-label="Custom instructions"
          placeholder="Additional behavior, style, and tone preferences"
          className="w-full resize-y rounded-xl border border-line bg-ink-800 px-3 py-2.5 text-[13.5px] leading-relaxed text-ink-50 outline-none transition-colors placeholder:text-ink-500 hover:border-line-strong focus:border-ink-400"
        />
        <p className="text-right font-mono text-[10.5px] text-ink-500">
          {instructions.length}/{CUSTOM_INSTRUCTIONS_MAX}
        </p>
      </SettingRow>
      <div className="flex items-center justify-between gap-3 pt-4">
        <p role={message?.tone === "error" ? "alert" : "status"} className={message?.tone === "error" ? "text-[13px] text-danger" : "text-[13px] text-ink-300"}>
          {message?.text ?? ""}
        </p>
        <Button type="submit" size="sm" disabled={!dirty} loading={pending} loadingLabel="Saving…">
          Save
        </Button>
      </div>
    </form>
  );
}
