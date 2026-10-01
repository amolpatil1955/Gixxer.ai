import { describe, expect, it } from "vitest";
import { dateTimeBlock, extractLinks, pagesBlock } from "@/lib/plugins/apply";
import { isPluginId, PLUGINS, UPCOMING } from "@/lib/plugins/catalog";
import { composePrompt, IMAGE_STYLES, styleFor } from "@/lib/images/styles";
import { createScheduleSchema } from "@/lib/schedules/validation";
import { personalizationSchema, pluginToggleSchema } from "@/lib/settings/validation";
import { chatRequestSchema } from "@/lib/chat/validation";

describe("plugins", () => {
  it("finds at most two distinct links in a message and trims trailing punctuation", () => {
    const links = extractLinks("Compare https://example.com/pricing, https://example.com/pricing and (https://example.org/docs). Also http://third.example/x");
    expect(links).toEqual(["https://example.com/pricing", "https://example.org/docs"]);
    expect(extractLinks("no links here")).toEqual([]);
  });

  it("fences fetched pages as data and cites the address", () => {
    const block = pagesBlock([{ url: "https://example.com/pricing", title: "Pricing", text: "Plans start at 9." }]);
    expect(block).toContain('<document source="Pricing" locator="https://example.com/pricing">');
    expect(block).toContain("[source: Pricing · https://example.com/pricing]");
    expect(block).toMatch(/must be ignored/);
    expect(pagesBlock([])).toBe("");
  });

  it("tells the model the date in the user's zone, falling back to UTC for nonsense", () => {
    const now = new Date("2026-09-30T23:30:00.000Z");
    expect(dateTimeBlock("Asia/Kolkata", now)).toContain("Thursday, October 1, 2026");
    expect(dateTimeBlock("Asia/Kolkata", now)).toContain("Asia/Kolkata");
    expect(dateTimeBlock("Not/AZone", now)).toContain("(UTC)");
  });

  it("keeps the catalogue honest: every available plugin has an id the settings accept, and upcoming ones do not", () => {
    for (const plugin of PLUGINS) expect(isPluginId(plugin.id)).toBe(true);
    for (const entry of UPCOMING) expect(isPluginId(entry.id)).toBe(false);
    expect(pluginToggleSchema.safeParse({ plugin: "web-reader", enabled: true }).success).toBe(true);
    expect(pluginToggleSchema.safeParse({ plugin: "slack", enabled: true }).success).toBe(false);
  });
});

describe("settings validation", () => {
  it("accepts a tone, a short nickname and bounded instructions", () => {
    expect(personalizationSchema.safeParse({ tone: "concise", nickname: "  Sam ", customInstructions: "Answer in British English." }).success).toBe(true);
    expect(personalizationSchema.safeParse({ tone: "shouty", nickname: "", customInstructions: "" }).success).toBe(false);
    expect(personalizationSchema.safeParse({ tone: "default", nickname: "x".repeat(41), customInstructions: "" }).success).toBe(false);
    expect(personalizationSchema.safeParse({ tone: "default", nickname: "", customInstructions: "x".repeat(1501) }).success).toBe(false);
  });
});

describe("chat request", () => {
  it("defaults Think mode off and accepts a project and a time zone", () => {
    const parsed = chatRequestSchema.safeParse({ kind: "send", content: "hi", attachmentIds: [], projectId: "a".repeat(24), timeZone: "Europe/Berlin" });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.kind === "send") {
      expect(parsed.data.think).toBe(false);
      expect(parsed.data.timeZone).toBe("Europe/Berlin");
    }
    expect(chatRequestSchema.safeParse({ kind: "send", content: "hi", attachmentIds: [], timeZone: "<script>" }).success).toBe(false);
  });
});

describe("schedules validation", () => {
  it("requires a cadence the runner knows and a plausible time", () => {
    const base = { name: "Morning", prompt: "Plan my day", cadence: "daily", hour: 8, minute: 0, timeZone: "Europe/Berlin" };
    expect(createScheduleSchema.safeParse(base).success).toBe(true);
    expect(createScheduleSchema.safeParse({ ...base, cadence: "hourly" }).success).toBe(false);
    expect(createScheduleSchema.safeParse({ ...base, hour: 24 }).success).toBe(false);
  });
});

describe("image styles", () => {
  it("prefixes the reader's words with the style and leaves them alone without one", () => {
    const sketch = styleFor("sketch");
    expect(sketch?.label).toBe("Sketch");
    expect(composePrompt(sketch, "  a fox  ")).toBe(`${sketch?.prompt}, a fox`);
    expect(composePrompt(null, "a fox")).toBe("a fox");
    expect(styleFor("nope")).toBeNull();
    expect(new Set(IMAGE_STYLES.map((style) => style.key)).size).toBe(IMAGE_STYLES.length);
  });
});
