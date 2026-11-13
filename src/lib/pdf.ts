import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const DEFAULT_CHUNK_SIZE = 800;
export const DEFAULT_CHUNK_OVERLAP = 100;

export interface PdfPageText {
  pageNumber: number;
  text: string;
}

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  documentName: string;
  pageNumber: number;
  charCount: number;
  metadata: {
    document_name: string;
    page_number: number;
    chunk_index: number;
  };
}

export interface ProcessedPdfResult {
  documentName: string;
  fileSizeBytes: number;
  pageCount: number;
  pages: PdfPageText[];
  chunks: DocumentChunk[];
}

export class PdfProcessingError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "PdfProcessingError";
    this.statusCode = statusCode;
  }
}

export function validatePdfFileMetadata(file: {
  name: string;
  type: string;
  size: number;
}): void {
  const lowerName = file.name.toLowerCase();
  const isPdfMime =
    file.type === "application/pdf" || file.type === "application/x-pdf";
  const hasPdfExt = lowerName.endsWith(".pdf");

  if (!isPdfMime && !hasPdfExt) {
    throw new PdfProcessingError(
      "Only PDF files (.pdf) are supported.",
      400
    );
  }

  if (file.type && !isPdfMime && hasPdfExt) {
    throw new PdfProcessingError(
      "Invalid file MIME type. Please upload a valid PDF file.",
      400
    );
  }

  if (file.size <= 0) {
    throw new PdfProcessingError("The uploaded PDF file is empty.", 400);
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new PdfProcessingError(
      "PDF file exceeds the 10 MB maximum size limit.",
      400
    );
  }
}

function hasPdfMagicHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  // "%PDF-"
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

function normalizePageText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfPages(
  data: Uint8Array
): Promise<{ pageCount: number; pages: PdfPageText[] }> {
  if (!hasPdfMagicHeader(data)) {
    throw new PdfProcessingError(
      "The uploaded file is not a valid PDF document.",
      400
    );
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs"
    );
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  }

  let pdfDocument: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
      useWorkerFetch: false,
    });
    pdfDocument = await loadingTask.promise;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("[pdf] PDF.js getDocument failed:", {
      name: errorName,
      message: errorMessage,
      workerSrc: pdfjs.GlobalWorkerOptions.workerSrc,
    });

    if (errorName === "PasswordException") {
      throw new PdfProcessingError(
        "This PDF is password-protected or encrypted. Please upload an unlocked PDF.",
        422
      );
    }

    if (
      errorName === "InvalidPDFException" ||
      errorName === "FormatError" ||
      errorName === "MissingPDFException"
    ) {
      throw new PdfProcessingError(
        "Unable to read the PDF file. It appears to be corrupted or malformed.",
        422
      );
    }

    if (
      errorMessage.includes("worker") ||
      errorMessage.includes("Cannot find module") ||
      errorMessage.includes("ENOENT")
    ) {
      throw new PdfProcessingError(
        "Server PDF parser configuration error. Please check server logs.",
        500
      );
    }

    throw new PdfProcessingError(
      "Unable to read the PDF file. It may be corrupted, encrypted, or password-protected.",
      422
    );
  }

  try {
    const pageCount = pdfDocument.numPages;
    if (pageCount <= 0) {
      throw new PdfProcessingError("The PDF document has no pages.", 422);
    }

    const pages: PdfPageText[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      const parts: string[] = [];
      for (const item of textContent.items) {
        if ("str" in item && typeof item.str === "string") {
          parts.push(item.str);
          if ("hasEOL" in item && item.hasEOL) {
            parts.push("\n");
          } else {
            parts.push(" ");
          }
        }
      }

      const cleaned = normalizePageText(parts.join(""));
      if (cleaned.length > 0) {
        pages.push({
          pageNumber: pageNum,
          text: cleaned,
        });
      }
    }

    if (pages.length === 0) {
      throw new PdfProcessingError(
        "No extractable text was found in this PDF. Scanned image-only or empty PDFs are not supported.",
        422
      );
    }

    return { pageCount, pages };
  } finally {
    await pdfDocument.cleanup();
  }
}

export function chunkPdfPages(
  pages: PdfPageText[],
  documentName: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_CHUNK_OVERLAP
): DocumentChunk[] {
  const safeChunkSize = Math.max(200, chunkSize);
  const safeOverlap = Math.min(Math.max(0, overlap), safeChunkSize - 50);

  const chunks: DocumentChunk[] = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    if (text.length <= safeChunkSize) {
      chunks.push({
        chunkIndex: globalChunkIndex,
        content: text,
        documentName,
        pageNumber: page.pageNumber,
        charCount: text.length,
        metadata: {
          document_name: documentName,
          page_number: page.pageNumber,
          chunk_index: globalChunkIndex,
        },
      });
      globalChunkIndex++;
      continue;
    }

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + safeChunkSize, text.length);

      if (end < text.length) {
        const searchStart = Math.max(start + Math.floor(safeChunkSize * 0.6), start);
        const slice = text.slice(searchStart, end);
        const lastSentenceBreak = Math.max(
          slice.lastIndexOf(". "),
          slice.lastIndexOf("\n")
        );
        const lastSpace = slice.lastIndexOf(" ");

        if (lastSentenceBreak > 0) {
          end = searchStart + lastSentenceBreak + 1;
        } else if (lastSpace > 0) {
          end = searchStart + lastSpace;
        }
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          chunkIndex: globalChunkIndex,
          content: chunkText,
          documentName,
          pageNumber: page.pageNumber,
          charCount: chunkText.length,
          metadata: {
            document_name: documentName,
            page_number: page.pageNumber,
            chunk_index: globalChunkIndex,
          },
        });
        globalChunkIndex++;
      }

      if (end >= text.length) break;

      const nextStart = end - safeOverlap;
      start = nextStart > start ? nextStart : end;
    }
  }

  return chunks;
}

export async function processPdfFile(
  fileName: string,
  fileSizeBytes: number,
  bytes: Uint8Array
): Promise<ProcessedPdfResult> {
  const { pageCount, pages } = await extractPdfPages(bytes);
  const chunks = chunkPdfPages(pages, fileName);

  if (chunks.length === 0) {
    throw new PdfProcessingError(
      "Unable to generate text chunks from this PDF.",
      422
    );
  }

  return {
    documentName: fileName,
    fileSizeBytes,
    pageCount,
    pages,
    chunks,
  };
}
