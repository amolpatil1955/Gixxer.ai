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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageTitle title="Images" className="mx-auto max-w-3xl" />
      <div className="mt-5">
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
