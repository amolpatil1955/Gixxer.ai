/**
 * What the reader is asking for, beyond text. Client-safe and pure.
 *
 * An image request must clearly ask for a picture to be made ("create a
 * robot image", "make me an image of a fox", "generate a picture of…");
 * "what is a PNG?" or "describe the Mona Lisa" are text. A document request
 * must name a file type to produce.
 */

export type DocumentKind = "pdf" | "xlsx" | "txt";

export type ChatIntent = { kind: "text" } | { kind: "image"; prompt: string } | { kind: "document"; format: DocumentKind; subject: string };

/** Politeness and framing that may come before the verb. */
const PREFIX = String.raw`(?:(?:please|pls|plz|hey|hi|ok|okay|so|now|also)[,\s]+|(?:could|can|would|will) you (?:please )?|i(?:'d| would) like (?:you to )?|i (?:want|need) (?:you to )?|let'?s |just )*`;
const MAKE = String.raw`(?:generate|create|make|draw|paint|render|design|produce|illustrate|sketch|craft|build|give me|show me|get me|send me|whip up|come up with|put together|visuali[sz]e)`;
const IMAGE_NOUN = String.raw`(?:image|img|picture|pic|photo|photograph|illustration|logo|drawing|artwork|art|poster|icon|wallpaper|portrait|painting|sketch|banner|thumbnail|avatar|graphic|visual|render|mockup|cover)s?`;
const IMAGE_REQUEST = new RegExp(String.raw`^\s*${PREFIX}(?:${MAKE})\s+(?:me\s+)?(?:an?\s+|the\s+|some\s+|\d+\s+)?(?:[\w'-]+\s+){0,4}${IMAGE_NOUN}\b`, "i");
const IMAGE_OF = new RegExp(String.raw`^\s*${PREFIX}(?:an?\s+)?${IMAGE_NOUN}\s+(?:of|showing|with|for|depicting|featuring)\b`, "i");
const IMAGE_SUFFIX = new RegExp(String.raw`\b(?:as|into|in)\s+(?:an?\s+)?${IMAGE_NOUN}\b|\bturn\s+(?:this|that|it)\s+into\s+(?:an?\s+)?${IMAGE_NOUN}\b`, "i");
const QUESTION = /^\s*(?:what|why|how|when|where|who|which|is|are|does|do|did|can i|should|explain|describe|tell me about|compare|list)\b/i;
/** "Give me three tips for better photos" asks for words about pictures, not a picture. */
const ADVICE = /\b(?:tips?|advice|ways?|ideas?|examples?|facts?|steps?|reasons?|list|names?|captions?|titles?|descriptions?|prompts?|guide|tutorial|checklist|suggestions?)\b/i;
const IMAGE_SUBJECT = /\b(?:of|showing|depicting|featuring|about|:)\s+(.+)$/i;
const SUBJECT_NOISE = new RegExp(String.raw`^\s*${PREFIX}(?:${MAKE})?\s*(?:me\s+)?(?:an?\s+|the\s+|some\s+)?`, "i");
const SUBJECT_NOUN = new RegExp(String.raw`\s*\b${IMAGE_NOUN}\b\s*(?:of|showing|for)?\s*`, "i");

const DOC_REQUEST = new RegExp(String.raw`^\s*${PREFIX}(?:${MAKE}|write|export|put|turn|convert|prepare|draft|compile|save)\b`, "i");
const DOC_FORMAT: { pattern: RegExp; format: DocumentKind }[] = [
  { pattern: /\b(?:pdf|pdf (?:file|document|report))\b/i, format: "pdf" },
  { pattern: /\b(?:xlsx|excel|spreadsheet|workbook|xls)\b/i, format: "xlsx" },
  { pattern: /\b(?:txt|text file|plain[- ]text file|\.txt)\b/i, format: "txt" },
];

/** Strips the "make me a picture of" scaffolding so the model gets the subject. */
function imageSubject(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  const after = trimmed.match(IMAGE_SUBJECT)?.[1]?.trim();
  if (after) return after;
  // "create a cute robot image in a city" → "cute robot in a city"
  const stripped = trimmed.replace(SUBJECT_NOISE, "").replace(SUBJECT_NOUN, " ").replace(/\s+/g, " ").trim();
  return stripped || trimmed;
}

export function detectIntent(message: string): ChatIntent {
  const text = message.trim();
  if (text.length < 4 || text.length > 1200) return { kind: "text" };
  const wantsDocument = DOC_FORMAT.some(({ pattern }) => pattern.test(text));
  // Questions about images are text; only an instruction to make one counts.
  const request = text.match(IMAGE_REQUEST)?.[0] ?? text.match(IMAGE_OF)?.[0] ?? text.match(IMAGE_SUFFIX)?.[0];
  const asksToMakeImage = Boolean(request) && !QUESTION.test(text) && !ADVICE.test(request!);
  if (asksToMakeImage && !wantsDocument) return { kind: "image", prompt: imageSubject(text) };
  if (DOC_REQUEST.test(text) && wantsDocument) {
    const found = DOC_FORMAT.find(({ pattern }) => pattern.test(text))!;
    return { kind: "document", format: found.format, subject: text };
  }
  return { kind: "text" };
}

export const DOCUMENT_LABELS: Record<DocumentKind, string> = { pdf: "PDF", xlsx: "Excel workbook", txt: "Text file" };
