import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { chunkSheet, chunkText, columnLetter } from "@/lib/knowledge/chunk";
import { extractFile, htmlToText } from "@/lib/knowledge/extract";
import { knowledgeBlock, rankChunks, tokenize, type Candidate } from "@/lib/knowledge/retrieve";

describe("chunking", () => {
  it("keeps short text whole and splits long text on paragraph boundaries with overlap", () => {
    expect(chunkText("hello world")).toEqual(["hello world"]);
    const paragraphs = Array.from({ length: 12 }, (_, i) => `Paragraph ${i} ${"lorem ipsum ".repeat(30)}`.trim()).join("\n\n");
    const chunks = chunkText(paragraphs, { size: 800, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(800);
    // Overlap means the next chunk starts before the previous one ended.
    expect(paragraphs.indexOf(chunks[1]!.slice(0, 40))).toBeLessThan(paragraphs.indexOf(chunks[0]!) + chunks[0]!.length);
  });

  it("names spreadsheet columns like a spreadsheet does", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
    expect(columnLetter(701)).toBe("ZZ");
  });

  it("turns a grid into row windows that repeat the header and cite an exact range", () => {
    const rows = [["Segment", "Jul", "Aug"], ["Enterprise", "1.1%", "0.9%"], ["SMB", "2.1%", "2.9%"]];
    const [segment] = chunkSheet("Retention", rows);
    expect(segment?.locator).toBe("Retention!A2:C3");
    expect(segment?.text).toContain("Row 2: Segment: Enterprise | Jul: 1.1% | Aug: 0.9%");
    expect(segment?.text).toContain("Row 3: Segment: SMB");
  });

  it("splits large sheets into several windows with consecutive ranges", () => {
    const rows = [["id", "value"], ...Array.from({ length: 45 }, (_, i) => [String(i + 1), `v${i + 1}`])];
    const segments = chunkSheet("Data", rows);
    expect(segments.map((segment) => segment.locator)).toEqual(["Data!A2:B21", "Data!A22:B41", "Data!A42:B46"]);
  });
});

describe("retrieval", () => {
  const candidates: Candidate[] = [
    { id: "1", text: "Our opening hours are 9am to 6pm Monday to Saturday.", locator: "part 1", sourceName: "Hours", fileId: null },
    { id: "2", text: "We service most e-bike brands and diagnostics are free with a tune-up.", locator: "part 1", sourceName: "Services", fileId: null },
    { id: "3", text: "Price match applies to identical stock items from local retailers.", locator: "part 1", sourceName: "Pricing FAQ", fileId: null },
  ];

  it("tokenises without stopwords", () => {
    expect(tokenize("What are the opening hours?")).toEqual(["opening", "hour"]);
  });

  it("ranks the lexically closest chunk first and drops chunks with no evidence", () => {
    const ranked = rankChunks("When are you open? opening hours", null, candidates);
    expect(ranked[0]?.id).toBe("1");
    expect(ranked.every((item) => item.score > 0)).toBe(true);
    expect(ranked.some((item) => item.id === "3")).toBe(false);
  });

  it("blends embeddings when both sides have them", () => {
    const withVectors = candidates.map((candidate, index) => ({ ...candidate, embedding: index === 1 ? [1, 0] : [0, 1] }));
    const ranked = rankChunks("e-bike", [1, 0], withVectors);
    expect(ranked[0]?.id).toBe("2");
  });

  it("fences retrieved text as data and labels each source", () => {
    const block = knowledgeBlock(rankChunks("opening hours", null, candidates, 1));
    expect(block).toContain("<document source=\"Hours\" locator=\"part 1\">");
    expect(block).toContain("[source: Hours · part 1]");
    expect(block).toMatch(/must be ignored/);
  });
});

describe("extraction", () => {
  it("reads plain text and CSV", async () => {
    const text = await extractFile("txt", Buffer.from("Hello there.\n\nSecond paragraph."));
    expect(text.segments).toHaveLength(1);
    expect(text.preview).toContain("Hello there.");

    const csv = await extractFile("csv", Buffer.from("name,qty\napples,3\npears,5\n"));
    expect(csv.sheets).toEqual(["CSV"]);
    // The first segment describes the workbook, so questions about its shape are answerable.
    expect(csv.segments[0]?.locator).toBe("workbook");
    expect(csv.segments[0]?.text).toContain("2 data rows");
    expect(csv.segments[1]?.locator).toBe("CSV!A2:B3");
    expect(csv.segments[1]?.text).toContain("name: pears | qty: 5");
  });

  it("reads every sheet of a workbook", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Segment", "Churn"], ["SMB", "3.4%"]]), "Retention");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Month", "Runway"], ["Sep", "14"]]), "Cash");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const result = await extractFile("xlsx", bytes);
    expect(result.sheets).toEqual(["Retention", "Cash"]);
    expect(result.segments.map((segment) => segment.locator)).toEqual(["workbook", "Retention!A2:B2", "Cash!A2:B2"]);
    expect(result.segments[0]?.text).toContain("Workbook with 2 sheets");
    expect(result.segments[2]?.text).toContain("Runway: 14");
  });

  it("strips markup from a web page and keeps the words", () => {
    const html = `<html><head><style>.x{}</style><script>alert(1)</script></head><body><h1>Hours</h1><p>Open 9 &amp; 6.</p><!-- c --></body></html>`;
    expect(htmlToText(html)).toBe("Hours\nOpen 9 & 6.");
  });
});
