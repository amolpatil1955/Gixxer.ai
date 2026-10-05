import "server-only";
import { getEnv } from "@/lib/env";
import { parsePublicUrl, resolvePublicUrl } from "@/lib/security/ssrf";

/*
 * Firecrawl, for reading a whole website into a chatbot's knowledge.
 *
 * Only this module talks to Firecrawl, and only from the server: the key is read
 * through lib/env.ts and never reaches a browser or a client component. The
 * address a user types is checked by the SSRF guard first, so a crawl can never
 * be pointed at a private network. Pages come back as text; what they contain is
 * data for the retrieval step and never an instruction to a model.
 *
 * With AI_MOCK=1 a deterministic stand-in answers instead, so the tests never
 * spend a credit or touch the network.
 */

const API = "https://api.firecrawl.dev/v1";
const START_TIMEOUT_MS = 20_000;
const POLL_TIMEOUT_MS = 15_000;
/** How long a crawl may run before we give up on it and tell the owner to retry. */
export const CRAWL_DEADLINE_MS = 4 * 60_000;
export const CRAWL_MAX_PAGES = 25;
const MAX_CHARS_PER_PAGE = 24_000;

export type CrawlFailure = "invalid_url" | "unauthorized" | "rate_limited" | "timeout" | "unreachable" | "empty" | "failed";

export class CrawlError extends Error {
  constructor(
    readonly reason: CrawlFailure,
    message: string,
  ) {
    super(message);
    this.name = "CrawlError";
  }
}

/** What an owner should read when a crawl does not work out. Never an API message. */
export function crawlMessage(reason: CrawlFailure): string {
  switch (reason) {
    case "invalid_url":
      return "That does not look like a public web address. Enter one like https://example.com.";
    case "unauthorized":
      return "Website crawling is not set up on this deployment yet.";
    case "rate_limited":
      return "The crawler is busy right now. Wait a minute and try again.";
    case "timeout":
      return "The crawl took too long. Try a single section of the site, like https://example.com/help.";
    case "unreachable":
      return "That website could not be reached. Check the address and that the site is public.";
    case "empty":
      return "No readable text was found on that website. Try a page with more content, or add the details by hand.";
    default:
      return "That website could not be crawled. Please try again.";
  }
}

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  /** The site's own title, for display. */
  title: string | null;
}

export function firecrawlConfigured(): boolean {
  const env = getEnv();
  return env.AI_MOCK || Boolean(env.FIRECRAWL_API_KEY);
}

/** The address as stored and compared: scheme and host lowercased, no trailing slash, no fragment. */
export function normalizeSiteUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${path}${url.search}`;
  } catch {
    return null;
  }
}

interface FirecrawlDocument {
  markdown?: string;
  content?: string;
  metadata?: { title?: string; sourceURL?: string; url?: string; statusCode?: number };
}

/** Markdown reduced to the prose a retrieval step can rank: no code fences, images, tables or link syntax. */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}\|.*\|\s*$/gm, (row) => row.replace(/\|/g, " "))
    .replace(/^[>#]+\s?/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toPage(document: FirecrawlDocument): CrawledPage | null {
  const body = markdownToText(document.markdown ?? document.content ?? "").slice(0, MAX_CHARS_PER_PAGE);
  if (body.length < 40) return null;
  const url = document.metadata?.sourceURL ?? document.metadata?.url ?? "";
  return { url, title: (document.metadata?.title ?? url ?? "Page").slice(0, 300), text: body };
}

async function call(path: string, init: RequestInit & { timeoutMs: number }): Promise<unknown> {
  const key = getEnv().FIRECRAWL_API_KEY;
  if (!key) throw new CrawlError("unauthorized", "FIRECRAWL_API_KEY is not set");
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(init.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new CrawlError("timeout", "Firecrawl did not respond in time");
    throw new CrawlError("unreachable", error instanceof Error ? error.message : "Firecrawl could not be reached");
  }
  if (response.status === 401 || response.status === 403) throw new CrawlError("unauthorized", `Firecrawl refused the key (${response.status})`);
  if (response.status === 429) throw new CrawlError("rate_limited", "Firecrawl rate limit reached");
  if (response.status === 402) throw new CrawlError("unauthorized", "The Firecrawl plan has no credit left");
  if (!response.ok) throw new CrawlError("failed", `Firecrawl answered ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new CrawlError("failed", "Firecrawl returned a body that was not JSON");
  }
}

/** Starts a crawl and returns its job id. The caller stores the id and polls. */
export async function startCrawl(rawUrl: string): Promise<{ jobId: string; url: string }> {
  const normalized = normalizeSiteUrl(rawUrl);
  if (!normalized) throw new CrawlError("invalid_url", crawlMessage("invalid_url"));
  /*
   * The same guard the web-page plugin uses: public hosts only. With the stand-in
   * crawler nothing is fetched, so the host is checked but not resolved; the
   * syntactic half still refuses loopback, link-local and private literals, and
   * the suites stay independent of DNS. The guard's reasons are written for a
   * reader, so they are carried through unchanged.
   */
  const checked = getEnv().AI_MOCK ? parsePublicUrl(normalized) : await resolvePublicUrl(normalized);
  if (!checked.ok) throw new CrawlError("invalid_url", checked.reason);

  if (getEnv().AI_MOCK) return { jobId: `mock-${Buffer.from(normalized).toString("base64url")}`, url: normalized };

  const body = await call("/crawl", {
    method: "POST",
    timeoutMs: START_TIMEOUT_MS,
    body: JSON.stringify({
      url: normalized,
      limit: CRAWL_MAX_PAGES,
      maxDepth: 3,
      allowExternalLinks: false,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true, removeBase64Images: true },
    }),
  });
  const id = typeof body === "object" && body !== null && "id" in body ? String((body as { id?: unknown }).id ?? "") : "";
  if (!id) throw new CrawlError("failed", "Firecrawl did not return a job id");
  return { jobId: id, url: normalized };
}

export type CrawlProgress = { status: "running"; completed: number; total: number } | { status: "done"; result: CrawlResult } | { status: "failed"; reason: CrawlFailure };

/** Where a crawl has got to. Called on a timer until it is done, failed or past the deadline. */
export async function checkCrawl(jobId: string, startedAt: Date): Promise<CrawlProgress> {
  if (Date.now() - startedAt.getTime() > CRAWL_DEADLINE_MS) return { status: "failed", reason: "timeout" };

  if (getEnv().AI_MOCK) return { status: "done", result: mockCrawlResult(jobId) };

  let body: unknown;
  try {
    body = await call(`/crawl/${encodeURIComponent(jobId)}`, { method: "GET", timeoutMs: POLL_TIMEOUT_MS });
  } catch (error) {
    // A single poll that fails is not a verdict; the caller tries again until the deadline.
    if (error instanceof CrawlError && (error.reason === "timeout" || error.reason === "unreachable")) return { status: "running", completed: 0, total: 0 };
    return { status: "failed", reason: error instanceof CrawlError ? error.reason : "failed" };
  }

  const payload = body as { status?: string; completed?: number; total?: number; data?: FirecrawlDocument[] };
  if (payload.status === "failed" || payload.status === "cancelled") return { status: "failed", reason: "failed" };
  if (payload.status !== "completed") return { status: "running", completed: payload.completed ?? 0, total: payload.total ?? 0 };

  const pages = (payload.data ?? []).map(toPage).filter((page): page is CrawledPage => page !== null);
  if (pages.length === 0) return { status: "failed", reason: "empty" };
  return { status: "done", result: { pages, title: payload.data?.[0]?.metadata?.title ?? null } };
}

/** Deterministic stand-in so the suites exercise the whole crawl path without the network. */
function mockCrawlResult(jobId: string): CrawlResult {
  const url = Buffer.from(jobId.replace(/^mock-/, ""), "base64url").toString("utf8") || "https://example.com";
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "example.com";
    }
  })();
  return {
    title: `${host} home`,
    pages: [
      { url, title: `${host} home`, text: `${host} sells refurbished cargo bikes. The showroom is open 9am to 6pm Monday to Saturday and closed on Sunday.` },
      { url: `${url}/pricing`, title: `${host} pricing`, text: "Pricing: the Courier model is 1,890 euro and the Compact is 1,340 euro. Delivery inside the city is free." },
      { url: `${url}/returns`, title: `${host} returns`, text: "Returns are accepted within 30 days with the original receipt. Custom builds are final sale." },
    ],
  };
}
