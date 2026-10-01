import "server-only";
import { IMAGE_STYLES, stylePreviewPath } from "@/lib/images/styles";
import { UNSPLASH_UTM, type UnsplashPhotoDto, type UnsplashSearchDto } from "./types";

/** Deterministic photo results for AI_MOCK=1: the style example images, attributed to a stand-in photographer. */
export function mockSearch(query: string, page: number, perPage: number): UnsplashSearchDto {
  const all: UnsplashPhotoDto[] = IMAGE_STYLES.map((style, index) => ({
    id: `mock-${style.key}`,
    alt: `${style.label}: ${style.example}`,
    description: style.example,
    width: 640,
    height: 640,
    color: index % 2 ? "#1c1919" : "#292525",
    urls: { thumb: stylePreviewPath(style), small: stylePreviewPath(style), regular: stylePreviewPath(style) },
    pageUrl: `https://unsplash.com/photos/mock-${style.key}?${UNSPLASH_UTM}`,
    photographer: { name: "Mock Photographer", username: "mock", profileUrl: `https://unsplash.com/@mock?${UNSPLASH_UTM}` },
  }));
  const matching = query.toLowerCase().includes("nothing") ? [] : all;
  const start = (page - 1) * perPage;
  return { query, page, perPage, total: matching.length, totalPages: Math.ceil(matching.length / perPage), results: matching.slice(start, start + perPage) };
}

export function mockDownload(photoId: string): { url: string; attribution: UnsplashPhotoDto } | null {
  const photo = mockSearch("", 1, 100).results.find((item) => item.id === photoId);
  return photo ? { url: photo.urls.regular, attribution: photo } : null;
}
