import { z } from "zod";

export const unsplashSearchSchema = z.object({
  query: z.string().trim().min(1, "Type something to search for").max(120, "Keep the search under 120 characters"),
  page: z.coerce.number().int().min(1).max(50).default(1),
});

export const unsplashDownloadSchema = z.object({
  photoId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid photo id"),
});
