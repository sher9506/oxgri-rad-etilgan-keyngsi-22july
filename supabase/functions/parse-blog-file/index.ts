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

/**
 * Extract plain text from HTML, stripping tags but keeping structure.
 */
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

/**
 * Clean up HTML content from Word/HTML sources — remove inline styles,
 * comments, o:p tags, and normalize structure.
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<o:p>[\s\S]*?<\/o:p>/gi, "")
    .replace(/<o:p\s*\/?>/gi, "")
    .replace(/<\/?(xml|w:wordDocument|o:documentProperties)[^>]*>/gi, "")
    .replace(/\s+style="[^"]*"/gi, "")
    .replace(/\s+class="[^"]*"/gi, "")
    .replace(/<span[^>]*>/gi, "<span>")
    .replace(/<font[^>]*>/gi, "")
    .replace(/<\/font>/gi, "")
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

/**
 * Parse HTML file content — clean it up and return as-is.
 */
function parseHtml(content: string): ParseResult {
  // Extract body if full HTML document
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : content;
  const cleaned = cleanHtml(bodyContent);
  const text = htmlToText(cleaned);
  return { html: cleaned, text };
}

/**
 * Parse DOCX file using mammoth (npm package).
 * Converts .docx to clean HTML preserving headings, bold, italic, lists.
 */
async function parseDocx(fileBuffer: Uint8Array): Promise<ParseResult> {
  try {
    // @ts-ignore - mammoth is imported from npm
    const mammoth = await import("npm:mammoth@1.8.0");
    const result = await mammoth.convertToHtml(
      { arrayBuffer: fileBuffer.buffer },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Subtitle'] => h2:fresh",
        ],
      }
    );
    const html = cleanHtml(result.value || "");
    const text = htmlToText(html);
    return { html, text };
  } catch (err) {
    console.error("[parse-blog-file] DOCX parse error:", err);
    return { html: "", text: "", error: "Word fayldan matnni ajratib bo'lmadi" };
  }
}

/**
 * Parse PDF file using pdf-parse (npm package).
 * Extracts text content from PDF. Note: scanned PDFs without text layer will fail.
 */
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

    // Convert plain text to simple HTML paragraphs
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
