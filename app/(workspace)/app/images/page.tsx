import type { Metadata } from "next";
import { ImageStudio } from "@/components/images/image-studio";
import { PageTitle } from "@/components/workspace/primitives";
import { requireUser } from "@/lib/auth/session";
import { listImages } from "@/lib/images/repository";

export const metadata: Metadata = { title: "Images" };

export default async function ImagesPage() {
  const user = await requireUser();
  const images = await listImages(user.id);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-8 sm:px-8 sm:pt-10">
      <PageTitle title="Images" />
      <div className="mt-5 flex flex-1 flex-col">
        <ImageStudio
          initialImages={images.map((image) => ({
            id: image.id,
            prompt: image.prompt,
            seed: image.seed,
            width: image.width,
            height: image.height,
            model: image.model,
            createdAt: image.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
