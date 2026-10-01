import { z } from "zod";

export const IMAGE_SIZES = [
  { key: "landscape", label: "1024 × 768", width: 1024, height: 768 },
  { key: "portrait", label: "768 × 1024", width: 768, height: 1024 },
  { key: "square", label: "1024 × 1024", width: 1024, height: 1024 },
] as const;

export type ImageSizeKey = (typeof IMAGE_SIZES)[number]["key"];

export const MAX_SEED = 2_147_483_647;

export const generateImageSchema = z.object({
  prompt: z.string().trim().min(3, "Describe what you want to see").max(1000, "Keep the prompt under 1000 characters"),
  size: z.enum(["landscape", "portrait", "square"]).default("landscape"),
  /** Reuse a seed to get a variation of an earlier result. */
  seed: z.number().int().min(0).max(MAX_SEED).optional(),
});

export type GenerateImageInput = z.input<typeof generateImageSchema>;

export const imageIdSchema = z.object({ imageId: z.string().regex(/^[a-f0-9]{24}$/i) });

export function sizeFor(key: ImageSizeKey) {
  return IMAGE_SIZES.find((size) => size.key === key) ?? IMAGE_SIZES[0];
}
