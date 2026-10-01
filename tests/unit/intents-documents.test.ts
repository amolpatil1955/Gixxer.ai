import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { detectIntent } from "@/lib/chat/intents";
import { buildDocument, buildPdf, documentName, tableFromText } from "@/lib/documents/build";

describe("chat intents", () => {
  it("recognises natural requests for a picture and extracts the subject", () => {
    expect(detectIntent("Generate an image of a red fox in snow")).toEqual({ kind: "image", prompt: "a red fox in snow" });
    expect(detectIntent("draw me a logo for a coffee shop called Bean")).toEqual({ kind: "image", prompt: "a coffee shop called Bean" });
    expect(detectIntent("create a robot image")).toEqual({ kind: "image", prompt: "robot" });
    expect(detectIntent("make me an image of a lighthouse at dawn")).toEqual({ kind: "image", prompt: "a lighthouse at dawn" });
    expect(detectIntent("generate a picture of two cats on a sofa")).toEqual({ kind: "image", prompt: "two cats on a sofa" });
    expect(detectIntent("Could you please draw a poster for our bake sale?")).toEqual({ kind: "image", prompt: "our bake sale" });
    expect(detectIntent("I want an avatar of a cat astronaut")).toEqual({ kind: "image", prompt: "a cat astronaut" });
    expect(detectIntent("create a cute robot image in a city")).toEqual({ kind: "image", prompt: "cute robot in a city" });
    expect(detectIntent("picture of a lighthouse at dawn")).toMatchObject({ kind: "image" });
    expect(detectIntent("turn this into an image: a red fox")).toMatchObject({ kind: "image", prompt: "a red fox" });
  });

  it("leaves ordinary text, and questions about images, to the model", () => {
    for (const text of [
      "What is a PNG file?",
      "Describe the Mona Lisa",
      "Explain how image compression works",
      "How do I resize a photo in CSS?",
      "Write a haiku about pictures",
      "Tell me about the moon",
      "Give me three tips for better photos",
      "hi",
    ]) {
      expect(detectIntent(text), text).toEqual({ kind: "text" });
    }
  });

  it("recognises document requests by their format", () => {
    expect(detectIntent("Create a PDF about solar panels for homeowners")).toMatchObject({ kind: "document", format: "pdf" });
    expect(detectIntent("Make an Excel spreadsheet of the top 10 EU countries by population")).toMatchObject({ kind: "document", format: "xlsx" });
    expect(detectIntent("Write this as a txt file: my packing list")).toMatchObject({ kind: "document", format: "txt" });
    expect(detectIntent("Could you please export these notes as a PDF?")).toMatchObject({ kind: "document", format: "pdf" });
    expect(detectIntent("What is a PDF?")).toEqual({ kind: "text" });
  });
});

describe("document building", () => {
  it("writes a valid PDF with a title and wrapped text across pages", () => {
    const long = Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1}. ${"The quick brown fox jumps over the lazy dog. ".repeat(4)}`).join("\n\n");
    const pdf = buildPdf("Solar panels", `# Solar panels\n\n## Why\n\n- cheaper\n- cleaner\n\n${long}`);
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toMatch(/\/Count ([2-9]|\d{2,})/);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("turns a Markdown table into a workbook and keeps numbers numeric", () => {
    const rows = tableFromText("Here you go:\n\n| Country | Population |\n| --- | --- |\n| Germany | 83 |\n| France | 68 |\n");
    expect(rows).toEqual([["Country", "Population"], ["Germany", "83"], ["France", "68"]]);
    const built = buildDocument("xlsx", "Countries", "| Country | Population |\n|---|---|\n| Germany | 83 |");
    const workbook = XLSX.read(built.bytes, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
    expect(XLSX.utils.sheet_to_json(sheet)).toEqual([{ Country: "Germany", Population: 83 }]);
    expect(built.preview).toContain("Germany | 83");
  });

  it("falls back to one column of lines when there is no table, and names files from the request", () => {
    expect(tableFromText("milk\neggs\n")).toEqual([["milk"], ["eggs"]]);
    expect(documentName("Create a PDF about solar panels for homeowners", "pdf")).toBe("solar-panels-for-homeowners.pdf");
    expect(documentName("???", "txt")).toBe("gixxer-document.txt");
    expect(documentName("Make an Excel spreadsheet of five European capitals with their country and population and currency", "xlsx")).toBe("five-european-capitals-with-their-country-and-population.xlsx");
    expect(buildDocument("txt", "Notes", "**Bold** and `code`").bytes.toString("utf8")).toBe("Bold and code");
  });
});
