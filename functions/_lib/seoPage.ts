/** SPA index.html'iga sahifa SEO'sini joylash — blog va ilmiy ishlar uchun umumiy. */
import { escapeHtml } from "./blogData";

export interface Page {
  status: number;
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  ogType?: "article" | "profile" | "website";
  jsonLd?: Record<string, unknown>;
  body?: string;
  noindex?: boolean;
  /** Qo'shimcha <meta name> teglari, masalan Google Scholar citation_*. Tartib saqlanadi (mualliflar tartibi muhim). */
  extraMeta?: [string, string][];
}

export function render(html: string, page: Page): string {
  const t = escapeHtml(page.title);
  const d = escapeHtml(page.description);
  const img = page.image ? escapeHtml(page.image) : "";
  const head = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    page.noindex ? `<meta name="robots" content="noindex, follow" />` : "",
    page.canonical ? `<link rel="canonical" href="${escapeHtml(page.canonical)}" />` : "",
    page.canonical ? `<meta property="og:url" content="${escapeHtml(page.canonical)}" />` : "",
    `<meta property="og:site_name" content="FanFaster" />`,
    `<meta property="og:locale" content="uz_UZ" />`,
    `<meta property="og:type" content="${page.ogType ?? "website"}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    img ? `<meta property="og:image" content="${img}" />` : "",
    img ? `<meta property="og:image:alt" content="${t}" />` : "",
    `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    img ? `<meta name="twitter:image" content="${img}" />` : "",
    ...(page.extraMeta ?? []).map(([n, c]) => `<meta name="${escapeHtml(n)}" content="${escapeHtml(c)}" />`),
    page.jsonLd
      ? `<script type="application/ld+json" id="page-jsonld">${JSON.stringify(page.jsonLd).replace(/</g, "\\u003c")}</script>`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/i, "")
    .replace(/<meta\b[^>]*(?:og:|twitter:)[^>]*>/gi, "")
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace("</head>", `    ${head}\n  </head>`);
  if (page.body) out = out.replace(/(<main id="root">)\s*(<\/main>)/, `$1${page.body}$2`);
  return out;
}

/** SPA index.html'ini olib, sahifani joylab qaytaradi (status va X-Robots-Tag bilan). */
export async function respondWithPage(
  request: Request,
  env: { ASSETS: { fetch: (r: Request) => Promise<Response> } },
  page: Page
): Promise<Response> {
  const url = new URL(request.url);
  const asset = await env.ASSETS.fetch(new Request(new URL("/", url.origin).toString(), { headers: request.headers }));
  if (!asset.ok) return env.ASSETS.fetch(request);
  const headers = new Headers(asset.headers);
  for (const h of ["content-length", "content-encoding", "transfer-encoding", "etag", "last-modified"]) headers.delete(h);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=60, s-maxage=300, must-revalidate");
  headers.set("X-Robots-Tag", page.noindex ? "noindex, follow" : "index, follow, max-snippet:-1");
  return new Response(render(await asset.text(), page), { status: page.status, headers });
}
