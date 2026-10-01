import { describe, expect, it } from "vitest";
import { toPhotoDto } from "@/lib/unsplash/client";
import { unsplashDownloadSchema, unsplashSearchSchema } from "@/lib/unsplash/validation";

describe("unsplash", () => {
  it("keeps the photographer, links back with referral parameters, and never carries a key", () => {
    const dto = toPhotoDto({
      id: "abc123",
      width: 4000,
      height: 3000,
      color: "#336699",
      description: null,
      alt_description: "a red fox in snow",
      urls: { raw: "https://images.unsplash.com/raw", full: "https://images.unsplash.com/full", regular: "https://images.unsplash.com/regular", small: "https://images.unsplash.com/small", thumb: "https://images.unsplash.com/thumb" },
      links: { html: "https://unsplash.com/photos/abc123", download: "https://unsplash.com/photos/abc123/download", download_location: "https://api.unsplash.com/photos/abc123/download?ixid=1" },
      user: { name: "Jane Doe", username: "jane", links: { html: "https://unsplash.com/@jane" } },
    });
    expect(dto.alt).toBe("a red fox in snow");
    expect(dto.photographer).toEqual({ name: "Jane Doe", username: "jane", profileUrl: "https://unsplash.com/@jane?utm_source=gixxer_ai&utm_medium=referral" });
    expect(dto.pageUrl).toBe("https://unsplash.com/photos/abc123?utm_source=gixxer_ai&utm_medium=referral");
    expect(JSON.stringify(dto)).not.toMatch(/download_location|Client-ID|secret/i);
  });

  it("bounds searches and photo ids", () => {
    expect(unsplashSearchSchema.safeParse({ query: " fox ", page: "2" })).toMatchObject({ success: true, data: { query: "fox", page: 2 } });
    expect(unsplashSearchSchema.safeParse({ query: "", page: "1" }).success).toBe(false);
    expect(unsplashSearchSchema.safeParse({ query: "fox", page: "99" }).success).toBe(false);
    expect(unsplashDownloadSchema.safeParse({ photoId: "abc_DEF-123" }).success).toBe(true);
    expect(unsplashDownloadSchema.safeParse({ photoId: "../etc" }).success).toBe(false);
  });
});
