import type { Metadata } from "next";
import { ScheduledView } from "@/components/scheduled/scheduled-view";
import { PageTitle } from "@/components/workspace/primitives";
import { requireUser } from "@/lib/auth/session";
import { listSchedules } from "@/lib/schedules/repository";

export const metadata: Metadata = { title: "Scheduled" };

export default async function ScheduledPage() {
  const user = await requireUser();
  const schedules = await listSchedules(user.id);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <PageTitle title="Scheduled" description="Ask Gixxer to run a prompt every day, every weekday, or once a week, and find the answer waiting as a chat." />
      <div className="mt-6">
        <ScheduledView
          initialSchedules={schedules.map((schedule) => ({
            id: schedule.id,
            name: schedule.name,
            prompt: schedule.prompt,
            cadence: schedule.cadence,
            hour: schedule.hour,
            minute: schedule.minute,
            timeZone: schedule.timeZone,
            active: schedule.active,
            nextRunAt: schedule.nextRunAt.toISOString(),
            lastRunAt: schedule.lastRunAt ? schedule.lastRunAt.toISOString() : null,
            lastConversationId: schedule.lastConversationId,
            lastError: schedule.lastError,
            runCount: schedule.runCount,
            createdAt: schedule.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
