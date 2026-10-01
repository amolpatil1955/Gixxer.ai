import type { Metadata } from "next";
import { LibraryView } from "@/components/library/library-view";
import { PageTitle } from "@/components/workspace/primitives";
import { requireUser } from "@/lib/auth/session";
import { listFiles } from "@/lib/files/repository";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const user = await requireUser();
  const files = await listFiles(user.id);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageTitle title="Library" description="Upload documents once, then attach them to any chat. Answers cite the page or the cell range." />
      <div className="mt-6">
        <LibraryView
          initialFiles={files.map((file) => ({
            id: file.id,
            name: file.name,
            size: file.size,
            kind: file.kind,
            status: file.status,
            pages: file.pages,
            sheets: file.sheets,
            chunkCount: file.chunkCount,
            preview: file.preview,
            error: file.error,
            createdAt: file.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
