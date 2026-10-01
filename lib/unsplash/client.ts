import "server-only";
import { getEnv } from "@/lib/env";
import { UNSPLASH_UTM, type UnsplashPhotoDto, type UnsplashSearchDto } from "./types";

/*
 * Unsplash, for searching reference photos. Never for generating pictures.
 * Only the server talks to Unsplash: the access key rides in the
 * Authorization header here and nowhere else, and the secret key (needed
 * only for user OAuth flows, which this app does not do) is never read.
 *
 * Two rules of the Unsplash API guidelines are enforced here: every photo
 * carries its photographer and a link back with referral parameters, and a
 * download is reported to the download endpoint before the file is handed
 * over.
 */

const API = "https://api.unsplash.com";
const TIMEOUT_MS = 12_000;

export class UnsplashError extends Error {
  constructor(
    readonly code: "not_configured" | "rate_limited" | "unavailable" | "bad_request",
    message: string,
  ) {
    super(message);
    this.name = "UnsplashError";
  }
}

interface ApiPhoto {
  id: string;
  width: number;
  height: number;
  color: string | null;
  description: string | null;
  alt_description: string | null;
  urls: { raw: string; full: string; regular: string; small: string; thumb: string };
  links: { html: string; download: string; download_location: string };
  user: { name: string; username: string; links: { html: string } };
}

interface ApiSearch {
  total: number;
  total_pages: number;
  results: ApiPhoto[];
}

function withUtm(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${UNSPLASH_UTM}`;
}

export function toPhotoDto(photo: ApiPhoto): UnsplashPhotoDto {
  return {
    id: photo.id,
    alt: photo.alt_description || photo.description || `Photo by ${photo.user.name} on Unsplash`,
    description: photo.description,
    width: photo.width,
    height: photo.height,
    color: photo.color || "#1c1919",
    urls: { thumb: photo.urls.thumb, small: photo.urls.small, regular: photo.urls.regular },
    pageUrl: withUtm(photo.links.html),
    photographer: { name: photo.user.name, username: photo.user.username, profileUrl: withUtm(photo.user.links.html) },
  };
}

function accessKey(): string {
  const key = getEnv().UNSPLASH_ACCESS_KEY;
  if (!key) throw new UnsplashError("not_configured", "UNSPLASH_ACCESS_KEY is not set");
  return key;
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { authorization: `Client-ID ${accessKey()}`, "accept-version": "v1" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof UnsplashError) throw error;
    throw new UnsplashError("unavailable", error instanceof Error ? error.message : "Network failure");
  }
  if (response.status === 429 || response.status === 403) throw new UnsplashError("rate_limited", `Unsplash responded ${response.status}`);
  if (response.status === 401) throw new UnsplashError("not_configured", "Unsplash refused the access key");
  if (response.status >= 500) throw new UnsplashError("unavailable", `Unsplash responded ${response.status}`);
  if (!response.ok) throw new UnsplashError("bad_request", `Unsplash responded ${response.status}`);
  return (await response.json()) as T;
}

export async function searchPhotos(query: string, page = 1, perPage = 24): Promise<UnsplashSearchDto> {
  const json = await call<ApiSearch>("/search/photos", { query, page: String(page), per_page: String(perPage), content_filter: "high" });
  return { query, page, perPage, total: json.total, totalPages: json.total_pages, results: json.results.map(toPhotoDto) };
}

/**
 * Reports the download to Unsplash, as the guidelines require, and returns the
 * address of the file to hand to the reader.
 */
export async function trackDownload(photoId: string): Promise<{ url: string; attribution: UnsplashPhotoDto }> {
  const photo = await call<ApiPhoto>(`/photos/${encodeURIComponent(photoId)}`, {});
  const location = new URL(photo.links.download_location);
  const tracked = await call<{ url: string }>(location.pathname, Object.fromEntries(location.searchParams.entries()));
  return { url: tracked.url, attribution: toPhotoDto(photo) };
}
