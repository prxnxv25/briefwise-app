import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

const MAX_TEXT = 120_000;
export async function extractText(fileName: string, input: Buffer) {
  const extension = fileName.toLowerCase().split(".").pop();
  let text = "";
  if (extension === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(input) });
    try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
  } else if (extension === "docx") {
    text = (await mammoth.extractRawText({ buffer: input })).value;
  } else if (extension === "doc") {
    const document = await new WordExtractor().extract(input);
    text = document.getBody();
  } else {
    throw new Error("Unsupported file format. Upload a Word (.doc or .docx) or PDF file.");
  }
  const normalized = text.replace(/\u0000/g, "").replace(/\r/g, "").trim();
  if (!normalized) throw new Error("No selectable text was found. Scanned PDFs need OCR; this test app currently reads text-based PDFs.");
  if (normalized.length > MAX_TEXT) return normalized.slice(0, MAX_TEXT);
  return normalized;
}
