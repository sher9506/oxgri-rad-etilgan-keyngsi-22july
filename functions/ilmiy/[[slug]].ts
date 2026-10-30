/**
 * Cloudflare Pages Function — ilmiy ishlar (Google Scholar uchun).
 *   /ilmiy             — tasdiqlangan ishlar ro'yxati
 *   /ilmiy/<slug>      — ish sahifasi: Highwire Press `citation_*` meta teglari (Scholar shu bilan indekslaydi),
 *                        sahifada ko'rinadigan annotatsiya va PDF havolasi
 *   /ilmiy/<slug>.pdf  — PDF fanfaster.uz domeni ostida (Scholar PDF sahifa bilan bir saytda bo'lishini afzal ko'radi)
 * Faqat holat='tasdiqlangan' ishlar ko'rinadi (RLS). scholar=false bo'lsa sahifa bor, lekin citation_* teglari yo'q.
 */
import { SITE_URL, escapeHtml, isoDate, truncate } from "../_lib/blogData";
import { type IlmiyIsh, fetchIlmiyIsh, fetchIlmiyIshlar, storagePdfUrl } from "../_lib/ilmiyData";
import { type Page, respondWithPage } from "../_lib/seoPage";

const TURLAR: Record<string, string> = {
  maqola: "Ilmiy maqola",
  tezis: "Konferensiya tezisi",
  dissertatsiya: "Dissertatsiya",
  preprint: "Preprint",
};

const wrap = (inner: string) =>
  `<div style="max-width:820px;margin:0 auto;padding:24px 16px;font:17px/1.65 Georgia,serif;color:#1f2328">${inner}</div>`;
const nav = `<nav style="font-family:system-ui,sans-serif;font-size:14px"><a href="/">FanFaster</a> › <a href="/ilmiy">Ilmiy ishlar</a></nav>`;
const pdfUrl = (i: IlmiyIsh) => `${SITE_URL}/ilmiy/${i.slug}.pdf`;
const scholarDate = (d: string) => d.replace(/-/g, "/"); // Scholar: YYYY/MM/DD

function citationMeta(i: IlmiyIsh): [string, string][] {
  const m: [string, string][] = [["citation_title", i.sarlavha]];
  for (const a of i.mualliflar) m.push(["citation_author", a]);
  m.push(["citation_publication_date", scholarDate(i.nashr_sanasi)]);
  if (i.nashr_nomi) m.push([i.nashr_turi === "tezis" ? "citation_conference_title" : "citation_journal_title", i.nashr_nomi]);
  if (i.nashr_turi === "dissertatsiya") m.push(["citation_dissertation_institution", i.nashr_nomi || "FanFaster"]);
  m.push(["citation_language", i.til]);
  if (i.kalit_sozlar.length) m.push(["citation_keywords", i.kalit_sozlar.join("; ")]);
  m.push(["citation_abstract_html_url", `${SITE_URL}/ilmiy/${i.slug}`]);
  m.push(["citation_pdf_url", pdfUrl(i)]);
  return m;
}

function detailPage(i: IlmiyIsh): Page {
  const url = `${SITE_URL}/ilmiy/${i.slug}`;
  const authors = i.mualliflar.map(escapeHtml).join(", ");
  return {
    status: 200,
    title: `${i.sarlavha} — ${i.mualliflar.join(", ")}`,
    description: truncate(i.annotatsiya, 160),
    canonical: url,
    ogType: "article",
    extraMeta: i.scholar ? citationMeta(i) : [],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": i.nashr_turi === "dissertatsiya" ? "Thesis" : "ScholarlyArticle",
      headline: truncate(i.sarlavha, 110),
      name: i.sarlavha,
      author: i.mualliflar.map((name) => ({ "@type": "Person", name })),
      datePublished: i.nashr_sanasi,
      dateModified: isoDate(i.updated_at),
      abstract: i.annotatsiya,
      keywords: i.kalit_sozlar.join(", "),
      inLanguage: i.til,
      url,
      encoding: { "@type": "MediaObject", contentUrl: pdfUrl(i), encodingFormat: "application/pdf" },
      ...(i.nashr_nomi ? { isPartOf: { "@type": "Periodical", name: i.nashr_nomi } } : {}),
      publisher: { "@type": "Organization", name: "FanFaster", url: SITE_URL },
    },
    body: wrap(`${nav}<article>
<p style="font-family:system-ui,sans-serif;font-size:13px;color:#57606a">${escapeHtml(TURLAR[i.nashr_turi] ?? "Ilmiy ish")}${i.nashr_nomi ? ` · ${escapeHtml(i.nashr_nomi)}` : ""} · <time datetime="${escapeHtml(i.nashr_sanasi)}">${escapeHtml(i.nashr_sanasi)}</time></p>
<h1 style="font-size:28px;line-height:1.25">${escapeHtml(i.sarlavha)}</h1>
<p><b>${authors}</b></p>
<h2 style="font-size:18px">Annotatsiya</h2>
<p>${escapeHtml(i.annotatsiya).replace(/\n+/g, "</p><p>")}</p>
${i.kalit_sozlar.length ? `<p><b>Kalit so'zlar:</b> ${i.kalit_sozlar.map(escapeHtml).join(", ")}</p>` : ""}
<p><a href="/ilmiy/${escapeHtml(i.slug)}.pdf">To'liq matn (PDF)</a></p>
</article>`),
  };
}

async function listPage(env: Record<string, unknown>): Promise<Page> {
  const items = await fetchIlmiyIshlar(env);
  return {
    status: 200,
    title: "Ilmiy ishlar — FanFaster",
    description: "FanFaster ustozlari va mualliflarining huquq sohasidagi ilmiy maqolalari, tezislari va dissertatsiyalari.",
    canonical: `${SITE_URL}/ilmiy`,
    body: wrap(`${nav}<h1>Ilmiy ishlar</h1>
<p>FanFaster ustozlari va mualliflarining huquq sohasidagi ilmiy ishlari.</p>
<ul>${items
      .map((i) => `<li><a href="/ilmiy/${escapeHtml(i.slug)}">${escapeHtml(i.sarlavha)}</a> — ${i.mualliflar.map(escapeHtml).join(", ")}, ${escapeHtml(i.nashr_sanasi.slice(0, 4))}</li>`)
      .join("")}</ul>`),
  };
}

export const onRequest: PagesFunction = async ({ request, env }) => {
  if (request.method !== "GET" && request.method !== "HEAD") return env.ASSETS.fetch(request);
  const e = env as unknown as Record<string, unknown>;
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

  try {
    if (path === "/ilmiy") return respondWithPage(request, env, await listPage(e));

    const pdf = path.match(/^\/ilmiy\/([a-z0-9-]+)\.pdf$/);
    if (pdf) {
      const ish = await fetchIlmiyIsh(pdf[1], e);
      if (!ish) return new Response("Topilmadi", { status: 404 });
      const r = await fetch(storagePdfUrl(ish.pdf_path));
      if (!r.ok || !r.body) return new Response("PDF topilmadi", { status: 404 });
      return new Response(r.body, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${ish.slug}.pdf"`,
          "Cache-Control": "public, max-age=3600",
          ...(ish.scholar ? {} : { "X-Robots-Tag": "noindex" }),
        },
      });
    }

    const one = path.match(/^\/ilmiy\/([a-z0-9-]+)$/);
    if (one) {
      const ish = await fetchIlmiyIsh(one[1], e);
      return respondWithPage(request, env, ish ? detailPage(ish) : {
        status: 404, title: "Ish topilmadi | FanFaster", description: "Bu ilmiy ish topilmadi yoki hali tasdiqlanmagan.", noindex: true,
      });
    }
  } catch (err) {
    console.error("[ilmiy-seo] Xato:", err instanceof Error ? err.stack : String(err));
  }
  return env.ASSETS.fetch(request);
};
