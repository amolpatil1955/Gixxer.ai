"use client";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { ArrowUp, CalendarClock, ExternalLink, LoaderCircle, Pause, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IconButton, PillTabs } from "@/components/workspace/primitives";
import { createScheduleAction, deleteScheduleAction, runScheduleNowAction, setScheduleActiveAction } from "@/lib/schedules/actions";
import { CADENCE_LABELS, CADENCES, describeCadence, nextRunAfter, wallTimeIn, type Cadence } from "@/lib/schedules/timing";
import { SCHEDULE_TEMPLATES, type ScheduleDto, type ScheduleTemplate } from "@/lib/schedules/types";
import { cn } from "@/lib/utils/cn";
import { workspaceRoutes } from "@/lib/workspace/routes";

type Filter = "active" | "paused" | "all";

const TEMPLATE_ICONS = ["🌅", "🗣️", "🧠", "🗓️", "📣"];

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function relative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const label = minutes < 60 ? `${Math.max(1, minutes)} min` : minutes < 60 * 24 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / (60 * 24))} d`;
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}

/** Prompts on a timer: describe one, pick when, and find the answer waiting as a chat. */
export function ScheduledView({ initialSchedules }: { initialSchedules: ScheduleDto[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("active");
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [time, setTime] = useState("09:00");
  const [details, setDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { confirm, dialog } = useConfirm();
  const zone = browserZone();

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(200, element.scrollHeight)}px`;
  }, [prompt]);

  const [hourText = "9", minuteText = "0"] = time.split(":");
  const hour = Math.min(23, Math.max(0, Number(hourText) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteText) || 0));
  const preview = nextRunAfter(new Date(), { cadence, hour, minute, timeZone: zone });
  const previewWall = wallTimeIn(preview, zone);

  function applyTemplate(template: ScheduleTemplate) {
    setPrompt(template.prompt);
    setName(template.title);
    setCadence(template.cadence);
    setTime(`${pad(template.hour)}:${pad(template.minute)}`);
    setDetails(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    textarea.current?.focus();
  }

  function create() {
    if (prompt.trim().length < 3) return;
    if (!details) {
      setDetails(true);
      if (!name) setName(prompt.trim().slice(0, 60));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createScheduleAction({ name: name.trim() || prompt.trim().slice(0, 60), prompt: prompt.trim(), cadence, hour, minute, timeZone: zone });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPrompt("");
      setName("");
      setDetails(false);
      setNotice(`Scheduled. First run ${relative(preview.toISOString())}.`);
      router.refresh();
    });
  }

  function toggle(schedule: ScheduleDto) {
    startTransition(async () => {
      const result = await setScheduleActiveAction({ scheduleId: schedule.id, active: !schedule.active });
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  async function remove(schedule: ScheduleDto) {
    if (!(await confirm({ title: `Delete "${schedule.name}"?`, body: "Chats it already produced are kept." }))) return;
    startTransition(async () => {
      const result = await deleteScheduleAction({ scheduleId: schedule.id });
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  function runNow(schedule: ScheduleDto) {
    setRunning(schedule.id);
    setError(null);
    startTransition(async () => {
      const result = await runScheduleNowAction({ scheduleId: schedule.id });
      setRunning(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(`${schedule.name} ran. The answer is waiting in your chats.`);
      router.refresh();
    });
  }

  const visible = initialSchedules.filter((schedule) => (filter === "all" ? true : filter === "active" ? schedule.active : !schedule.active));

  return (
    <div className="space-y-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
        className="raised rounded-[28px] px-2.5 pb-2 pt-2.5"
        aria-label="Schedule a task"
      >
        <textarea
          ref={textarea}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value.slice(0, 4000))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              create();
            }
          }}
          rows={1}
          placeholder="Schedule a task"
          aria-label="Task prompt"
          className="block w-full resize-none bg-transparent px-2.5 py-2 text-[15.5px] leading-relaxed text-ink-50 outline-none placeholder:text-ink-400"
        />
        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDetails((value) => !value)}
            aria-expanded={details}
            aria-controls="schedule-details"
            className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-ink-200 transition-colors hover:bg-ink-700 hover:text-ink-50", details && "bg-ink-700 text-ink-50")}
          >
            <CalendarClock className="size-4" aria-hidden="true" />
            {CADENCE_LABELS[cadence]} · {time}
          </button>
          <button
            type="submit"
            disabled={prompt.trim().length < 3 || pending}
            aria-label={details ? "Create schedule" : "Continue"}
            className={cn(
              "ml-auto flex size-9 items-center justify-center rounded-full transition-[background-color,transform] active:scale-95",
              prompt.trim().length >= 3 ? "bg-accent text-on-accent hover:bg-accent-hover" : "bg-ink-600 text-ink-300",
            )}
          >
            {pending ? <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" /> : <ArrowUp className="size-4.5" aria-hidden="true" />}
          </button>
        </div>
        {details ? (
          <div id="schedule-details" className="mt-2 grid gap-3 border-t border-line px-2 pb-1 pt-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="flex flex-col gap-1 text-[11.5px] text-ink-400">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 80))}
                placeholder="Morning briefing"
                aria-label="Schedule name"
                className="h-9 rounded-xl border border-line bg-ink-900 px-3 text-[13px] text-ink-50 outline-none focus:border-ink-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-ink-400">
              Repeats
              <select value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)} aria-label="Repeats" className="h-9 rounded-xl border border-line bg-ink-900 px-3 pr-8 text-[13px] text-ink-50 outline-none focus:border-ink-400">
                {CADENCES.map((option) => (
                  <option key={option} value={option}>
                    {CADENCE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-ink-400">
              At
              <input type="time" value={time} onChange={(event) => setTime(event.target.value || "09:00")} aria-label="Time" className="h-9 rounded-xl border border-line bg-ink-900 px-3 text-[13px] text-ink-50 outline-none focus:border-ink-400" />
            </label>
            <p className="text-[12px] text-ink-400 sm:col-span-3">
              First run {relative(preview.toISOString())}: {new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(preview)} at {pad(previewWall.hour)}:{pad(previewWall.minute)} ({zone}). Runs when you open Gixxer, or on time when a cron trigger is configured.
            </p>
          </div>
        ) : null}
      </form>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? (
        <p role="status" className="text-[13px] text-ink-300">
          {notice}
        </p>
      ) : null}

      <section aria-labelledby="recommended">
        <h2 id="recommended" className="text-[15px] font-semibold text-ink-50">
          Recommended
        </h2>
        <ul className="mt-2 divide-y divide-line">
          {SCHEDULE_TEMPLATES.map((template, index) => (
            <li key={template.key} className="flex items-center gap-4 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-[18px]" aria-hidden="true">
                {TEMPLATE_ICONS[index]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink-50">{template.title}</p>
                <p className="text-[12.5px] text-ink-400">{template.description}</p>
              </div>
              <IconButton label={`Use template: ${template.title}`} onClick={() => applyTemplate(template)}>
                <Plus className="size-4.5" aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="your-schedules">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="your-schedules" className="text-[15px] font-semibold text-ink-50">
            Your schedules
          </h2>
          <PillTabs
            value={filter}
            onChange={setFilter}
            label="Schedule filters"
            options={[
              { value: "active", label: "Active", count: initialSchedules.filter((item) => item.active).length },
              { value: "paused", label: "Paused", count: initialSchedules.filter((item) => !item.active).length },
              { value: "all", label: "All" },
            ]}
          />
        </div>
        {visible.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-ink-400">{initialSchedules.length === 0 ? "Nothing scheduled yet. Describe a task above or pick a recommendation." : "Nothing here."}</p>
        ) : (
          <ul className="mt-3 space-y-2" aria-label="Schedules">
            {visible.map((schedule) => {
              const anchor = wallTimeIn(new Date(schedule.nextRunAt), schedule.timeZone);
              return (
                <li key={schedule.id} className={cn("rounded-2xl border border-line bg-ink-900/40 p-4", !schedule.active && "opacity-75")} data-schedule-active={schedule.active ? "true" : "false"}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium text-ink-50">{schedule.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink-400">
                        {describeCadence(schedule.cadence, anchor.weekday, anchor.day)} at {pad(schedule.hour)}:{pad(schedule.minute)} · {schedule.timeZone}
                      </p>
                      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-200">{schedule.prompt}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-400">
                        <span>{schedule.active ? `Next ${relative(schedule.nextRunAt)}` : "Paused"}</span>
                        {schedule.lastRunAt ? <span>Last {relative(schedule.lastRunAt)}</span> : null}
                        <span>
                          {schedule.runCount} run{schedule.runCount === 1 ? "" : "s"}
                        </span>
                        {schedule.lastConversationId ? (
                          <Link href={workspaceRoutes.chat(schedule.lastConversationId)} className="inline-flex items-center gap-1 normal-case tracking-normal text-ink-100 underline underline-offset-4">
                            Open last answer <ExternalLink className="size-3" aria-hidden="true" />
                          </Link>
                        ) : null}
                      </p>
                      {schedule.lastError ? <p className="mt-1.5 text-[12.5px] text-danger">{schedule.lastError}</p> : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="secondary" onClick={() => runNow(schedule)} loading={running === schedule.id} loadingLabel="Running…" disabled={!schedule.active || pending}>
                        Run now
                      </Button>
                      <IconButton label={schedule.active ? `Pause ${schedule.name}` : `Resume ${schedule.name}`} onClick={() => toggle(schedule)} disabled={pending}>
                        {schedule.active ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
                      </IconButton>
                      <IconButton label={`Delete ${schedule.name}`} onClick={() => remove(schedule)} disabled={pending} className="hover:text-danger">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {dialog}
    </div>
  );
}
