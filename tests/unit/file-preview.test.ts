import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildPdf } from "@/lib/documents/build";
import { pdfPreview, PREVIEW_MAX_COLUMNS, PREVIEW_MAX_ROWS, workbookPreview } from "@/lib/files/preview";

describe("file preview", () => {
  it("reads every sheet of a workbook into padded rows and flags truncation", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Date", "Order", "Revenue"], ["2026-01-05", "ORD-1", 588], ["2026-01-08", "ORD-2"]]), "Sales_Data");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(Array.from({ length: PREVIEW_MAX_ROWS + 5 }, (_, i) => [i, Array.from({ length: PREVIEW_MAX_COLUMNS + 2 }, (__, j) => j)].flat())), "Summary");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const preview = workbookPreview(bytes, "xlsx");
    expect(preview.kind).toBe("sheets");
    if (preview.kind !== "sheets") return;
    expect(preview.sheets.map((sheet) => sheet.name)).toEqual(["Sales_Data", "Summary"]);
    expect(preview.sheets[0]?.rows).toEqual([
      ["Date", "Order", "Revenue"],
      ["2026-01-05", "ORD-1", "588"],
      ["2026-01-08", "ORD-2", ""],
    ]);
    expect(preview.sheets[0]?.truncated).toBe(false);
    expect(preview.sheets[1]?.rows).toHaveLength(PREVIEW_MAX_ROWS);
    expect(preview.sheets[1]?.rows[0]).toHaveLength(PREVIEW_MAX_COLUMNS);
    expect(preview.sheets[1]?.truncated).toBe(true);
  });

  it("reads a CSV as one sheet", () => {
    const preview = workbookPreview(Buffer.from("name,qty\napples,3\n"), "csv");
    expect(preview).toEqual({ kind: "sheets", sheets: [{ name: "CSV", rows: [["name", "qty"], ["apples", "3"]], truncated: false }] });
  });

  it("splits a PDF made by the document builder into pages of text", async () => {
    const long = Array.from({ length: 90 }, (_, i) => `Point ${i + 1}: ${"the quick brown fox jumps over the lazy dog ".repeat(3)}`).join("\n\n");
    const preview = await pdfPreview(buildPdf("Solar panels", `# Solar panels\n\n${long}`));
    expect(preview.kind).toBe("pages");
    if (preview.kind !== "pages") return;
    expect(preview.pageCount).toBeGreaterThan(1);
    expect(preview.pages).toHaveLength(preview.pageCount);
    expect(preview.pages[0]).toContain("Solar panels");
    expect(preview.pages[preview.pageCount - 1]).toContain("Point 90");
  });
});
