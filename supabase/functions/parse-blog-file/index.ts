import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParseResult {
  html: string;
  text: string;
  error?: string;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+style="[^"]*"/gi, "")
    .replace(/\s+class="[^"]*"/gi, "")
    .replace(/<span[^>]*>/gi, "<span>")
    .replace(/<div[^>]*>/gi, "<div>")
    .replace(/<p[^>]*>/gi, "<p>")
    .replace(/<h([1-6])[^>]*>/gi, "<h$1>")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/<div>\s*<\/div>/gi, "")
    .replace(/<span>\s*<\/span>/gi, "")
    .trim();
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

/**
 * Minimal ZIP reader using Deno's native APIs — no npm dependencies.
 * Reads a ZIP buffer and returns the decompressed content of a given entry name.
 * Based on the ZIP format spec: https://en.wikipedia.org/wiki/ZIP_(file_format)
 */
async function extractZipEntry(buffer: Uint8Array, entryName: string): Promise<string | null> {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Find End of Central Directory record (EOCD) — search backwards from end
  let eocdOffset = -1;
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return null;

  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const cdEntries = view.getUint16(eocdOffset + 10, true);

  let offset = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const compMethod = view.getUint16(offset + 10, true);
    const compSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const name = new TextDecoder().decode(buffer.subarray(offset + 46, offset + 46 + nameLen));

    if (name === entryName) {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compData = buffer.subarray(dataStart, dataStart + compSize);

      if (compMethod === 0) {
        return new TextDecoder().decode(compData);
      } else if (compMethod === 8) {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(compData);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        let totalLen = 0;
        // deno-lint-ignore no-explicit-any
        let result: any;
        while (!(result = await reader.read()).done) {
          chunks.push(result.value);
          totalLen += result.value.byteLength;
        }
        const decompressed = new Uint8Array(totalLen);
        let pos = 0;
        for (const chunk of chunks) {
          decompressed.set(chunk, pos);
          pos += chunk.byteLength;
        }
        return new TextDecoder().decode(decompressed);
      }
      return null;
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/**
 * Parse DOCX by extracting word/document.xml from the zip and converting
 * OOXML <w:p> paragraphs to HTML with heading/bold/italic support.
 * Uses native Deno ZIP extraction — no npm dependencies needed.
 */
async function parseDocx(fileBuffer: Uint8Array): Promise<ParseResult> {
  try {
    const xml = await extractZipEntry(fileBuffer, "word/document.xml");
    if (!xml) {
      return { html: "", text: "", error: "Word fayldan matnni ajratib bo'lmadi" };
    }

    let html = "";

    // Use regex to find all <w:p> paragraphs and extract text with formatting
    const paraRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
    let paraMatch;
    while ((paraMatch = paraRegex.exec(xml)) !== null) {
      const paraContent = paraMatch[1];

      // Detect heading style
      let paraStyle = "";
      const styleMatch = paraContent.match(/<w:pStyle\s+w:val="([^"]+)"/i);
      if (styleMatch) {
        const style = styleMatch[1].toLowerCase();
        if (style.includes("heading1") || style.includes("title")) paraStyle = "h1";
        else if (style.includes("heading2") || style.includes("subtitle")) paraStyle = "h2";
        else if (style.includes("heading3")) paraStyle = "h3";
        else if (style.includes("heading4")) paraStyle = "h4";
      }

      // Extract runs with formatting
      const runRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/gi;
      let runMatch;
      let paraHtml = "";
      while ((runMatch = runRegex.exec(paraContent)) !== null) {
        const runContent = runMatch[1];
        const isBold = /<w:b\s*\/?>/i.test(runContent);
        const isItalic = /<w:i\s*\/?>/i.test(runContent);
        const isUnderline = /<w:u\s[^>]*w:val="single"/i.test(runContent);

        // Extract all <w:t> text content
        let runText = "";
        const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/gi;
        let textMatch;
        while ((textMatch = textRegex.exec(runContent)) !== null) {
          runText += decodeXml(textMatch[1]);
        }
        // Handle tabs and breaks
        if (/<w:tab\s*\/?>/i.test(runContent)) runText += "\t";
        if (/<w:br\s*\/?>/i.test(runContent)) runText += "<br>";

        let wrapped = runText;
        if (isUnderline) wrapped = `<u>${wrapped}</u>`;
        if (isItalic) wrapped = `<em>${wrapped}</em>`;
        if (isBold) wrapped = `<strong>${wrapped}</strong>`;
        paraHtml += wrapped;
      }

      if (paraHtml.trim()) {
        if (paraStyle) {
          html += `<${paraStyle}>${paraHtml}</${paraStyle}>`;
        } else {
          html += `<p>${paraHtml}</p>`;
        }
      }
    }

    html = cleanHtml(html);
    const text = htmlToText(html);

    if (!text || text.trim().length < 10) {
      return { html: "", text: "", error: "Word fayldan matnni ajratib bo'lmadi" };
    }

    return { html, text };
  } catch (err) {
    console.error("[parse-blog-file] DOCX parse error:", err?.message || err, err?.stack || "");
    return { html: "", text: "", error: "Word fayldan matnni ajratib bo'lmadi" };
  }
}

function parseHtml(content: string): ParseResult {
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : content;
  const cleaned = cleanHtml(bodyContent);
  const text = htmlToText(cleaned);
  return { html: cleaned, text };
}

async function parsePdf(fileBuffer: Uint8Array): Promise<ParseResult> {
  try {
    // @ts-ignore - pdf-parse is imported from npm
    const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
    const data = await pdfParse(fileBuffer);
    const text = (data.text || "").trim();

    if (!text || text.length < 10) {
      return {
        html: "",
        text: "",
        error:
          "Ushbu PDF fayldan matnni avtomatik ajratib bo'lmadi — iltimos, matnni qo'lda joylashtiring yoki boshqa fayl yuklang.",
      };
    }

    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0)
      .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("\n");

    return { html: paragraphs, text };
  } catch (err) {
    console.error("[parse-blog-file] PDF parse error:", err);
    return {
      html: "",
      text: "",
      error:
        "Ushbu PDF fayldan matnni avtomatik ajratib bo'lmadi — iltimos, matnni qo'lda joylashtiring yoki boshqa fayl yuklang.",
    };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "Fayl topilmadi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileName = file.name.toLowerCase();
    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    let result: ParseResult;

    if (fileName.endsWith(".pdf")) {
      result = await parsePdf(fileBuffer);
    } else if (fileName.endsWith(".docx")) {
      result = await parseDocx(fileBuffer);
    } else if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
      const textContent = new TextDecoder().decode(fileBuffer);
      result = parseHtml(textContent);
    } else {
      return new Response(
        JSON.stringify({ error: "Qo'llab-quvvatlanmaydigan fayl formati. PDF, Word (.docx) yoki HTML yuklang." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result.error) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result.text || result.text.trim().length < 10) {
      return new Response(
        JSON.stringify({
          error:
            "Ushbu fayldan matnni avtomatik ajratib bo'lmadi — iltimos, matnni qo'lda joylashtiring yoki boshqa fayl yuklang.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ html: result.html, text: result.text }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[parse-blog-file] Error:", err);
    return new Response(
      JSON.stringify({ error: "Faylni qayta ishlashda xatolik yuz berdi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
