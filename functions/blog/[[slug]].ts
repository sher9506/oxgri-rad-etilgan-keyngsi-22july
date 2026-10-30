/**
 * Cloudflare Pages Function — blog sahifalari uchun server tomonidagi SEO.
 *
 * /blog, /blog/mualliflar, /blog/mavzular, /blog/:slug, /blog/muallif/:slug
 * so'rovlarida SPA'ning index.html'iga:
 *   - <head>: sarlavha, tavsif, canonical, OG/Twitter, JSON-LD;
 *   - <main id="root">: sahifaning to'liq matni, rasmlari va haqiqiy <a> havolalari
 * qo'shiladi. JS ishlatmaydigan qidiruv/AI botlari ham hammasini ko'radi;
 * odamda React yuklanganda bu matn odatdagi interfeys bilan almashadi.
 * Topilmagan maqola/muallif — 404 + noindex (bosh sahifa nusxasi indekslanmaydi).
 */

import {
  type Author,
  type BlogPost,
  DEFAULT_OG_IMAGE,
  LOGO_URL,
  SITE_URL,
  escapeHtml,
  fetchAuthorBySlug,
  fetchAuthorsOf,
  fetchPost,
  fetchPublishedPosts,
  isValidNote,
  isoDate,
  plainText,
  postDescription,
  postImage,
  publicImageUrl,
  truncate,
} from "../_lib/blogData";
import { type Page, render } from "../_lib/seoPage";


const PUBLISHER = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "FanFaster",
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: LOGO_URL, width: 1017, height: 1017 },
};

const authorUrl = (a: Author) => `${SITE_URL}/blog/muallif/${a.muallif_slug}`;
const postUrl = (p: BlogPost) => `${SITE_URL}/blog/${p.slug}`;
// Workers'da uz-UZ lokali «2026 M09 19» beradi — oy nomlari qo'lda.
const OYLAR = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const fmtDate = (d: string) => {
  const t = new Date(new Date(d).getTime() + 5 * 3600_000); // Toshkent vaqti
  return `${t.getUTCDate()}-${OYLAR[t.getUTCMonth()]}, ${t.getUTCFullYear()}`;
};

/** Muallif yozgan HTML'ni serverda xavfsiz ko'rsatish: skript va hodisa atributlari olib tashlanadi. */
function safeContent(html: string): string {
  return String(html ?? "")
    .replace(/<(script|style|iframe|object|embed|form|noscript)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(javascript|data|vbscript):[^"']*\2/gi, '$1="#"')
    .replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
}

const wrap = (inner: string) =>
  `<div style="max-width:760px;margin:0 auto;padding:24px 16px;font:17px/1.65 system-ui,sans-serif;color:#1f2328">${inner}</div>`;

const nav = `<nav aria-label="Blog"><a href="/">FanFaster</a> › <a href="/blog">Blog</a> · <a href="/blog/mualliflar">Mualliflar</a> · <a href="/nasher-ai">NaSher AI</a></nav>`;

function postCard(p: BlogPost, a?: Author): string {
  const img = postImage(p);
  return `<li><a href="/blog/${escapeHtml(p.slug)}"><strong>${escapeHtml(p.sarlavha)}</strong></a>${
    a ? ` — <a href="/blog/muallif/${escapeHtml(a.muallif_slug)}">${escapeHtml(a.full_name)}</a>` : ""
  }, <time datetime="${isoDate(p.created_at)}">${fmtDate(p.created_at)}</time>${
    img ? `<br><img src="${escapeHtml(img)}" alt="${escapeHtml(p.sarlavha)}" loading="lazy" decoding="async" style="max-width:100%;height:auto">` : ""
  }<br>${escapeHtml(postDescription(p))}</li>`;
}

const breadcrumb = (items: [string, string][]) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
});

// ─── Sahifalar ────────────────────────────────────────────────────────────

async function postPage(slug: string, env: Record<string, unknown>): Promise<Page | null> {
  const post = await fetchPost(slug, env);
  if (!post) return null;
  const authors = await fetchAuthorsOf([post], env);
  const author = post.ustoz_id ? authors.get(post.ustoz_id) : undefined;
  const authorName = author?.full_name || post.ustoz_ismi || "FanFaster";
  const authorPhoto = publicImageUrl(author?.face_photo_url);
  const cover = publicImageUrl(post.rasm_url);
  const image = postImage(post) ?? authorPhoto ?? DEFAULT_OG_IMAGE;
  const url = postUrl(post);
  const description = postDescription(post);
  const related = author
    ? (await fetchPublishedPosts(env, `&ustoz_id=eq.${author.id}&id=neq.${post.id}&limit=5`))
    : [];

  const person = {
    "@type": "Person",
    name: authorName,
    ...(author ? { "@id": `${authorUrl(author)}#person`, url: authorUrl(author) } : {}),
    ...(authorPhoto ? { image: authorPhoto } : {}),
  };

  return {
    status: 200,
    title: `${post.sarlavha} — ${authorName} | FanFaster`,
    description,
    canonical: url,
    image,
    ogType: "article",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          "@id": `${url}#article`,
          headline: truncate(post.sarlavha, 110),
          description,
          image: [image],
          datePublished: isoDate(post.created_at),
          dateModified: isoDate(post.updated_at || post.created_at),
          author: person,
          publisher: PUBLISHER,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          url,
          inLanguage: "uz",
          wordCount: plainText(post.mazmun).split(" ").filter(Boolean).length,
        },
        breadcrumb([["FanFaster", `${SITE_URL}/`], ["Blog", `${SITE_URL}/blog`], [post.sarlavha, url]]),
      ],
    },
    body: wrap(`${nav}<article>
<h1>${escapeHtml(post.sarlavha)}</h1>
<p>${authorPhoto ? `<img src="${escapeHtml(authorPhoto)}" alt="${escapeHtml(authorName)} — FanFaster muallifi" width="48" height="48" decoding="async" style="border-radius:50%;object-fit:cover;vertical-align:middle"> ` : ""}Muallif: ${author ? `<a href="/blog/muallif/${escapeHtml(author.muallif_slug)}" rel="author">${escapeHtml(authorName)}</a>` : escapeHtml(authorName)} · <time datetime="${isoDate(post.created_at)}">${fmtDate(post.created_at)}</time></p>
${cover ? `<figure><img src="${escapeHtml(cover)}" alt="${escapeHtml(post.sarlavha)}" decoding="async" style="max-width:100%;height:auto"></figure>` : ""}
<div>${safeContent(post.mazmun)}</div>
</article>${
      related.length ? `<h2>${escapeHtml(authorName)}ning boshqa maqolalari</h2><ul>${related.map((p) => postCard(p)).join("")}</ul>` : ""
    }`),
  };
}

async function authorPage(slug: string, env: Record<string, unknown>): Promise<Page | null> {
  const author = await fetchAuthorBySlug(slug, env);
  if (!author) return null;
  const posts = await fetchPublishedPosts(env, `&ustoz_id=eq.${author.id}`);
  const url = authorUrl(author);
  const photo = publicImageUrl(author.face_photo_url);
  const note = isValidNote(author.note) ? plainText(author.note) : "";
  const description = truncate(
    `${author.full_name} — FanFaster muallifi. ${posts.length} ta maqola${note ? `. ${note}` : ""}`,
    160
  );

  return {
    status: 200,
    title: `${author.full_name} — FanFaster muallifi | Barcha maqolalar`,
    description,
    canonical: url,
    image: photo ?? DEFAULT_OG_IMAGE,
    ogType: "profile",
    // Na maqola, na rasm — bo'sh profil Google'ga berilmaydi. Rasmi borlari rasmi uchun indekslanadi.
    noindex: posts.length === 0 && !photo,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ProfilePage",
          "@id": url,
          url,
          name: `${author.full_name} — FanFaster muallifi`,
          ...(posts[0] ? { dateModified: isoDate(posts[0].updated_at || posts[0].created_at) } : {}),
          mainEntity: {
            "@type": "Person",
            "@id": `${url}#person`,
            name: author.full_name,
            url,
            jobTitle: "FanFaster muallifi",
            worksFor: { "@id": PUBLISHER["@id"], "@type": "Organization", name: "FanFaster", url: SITE_URL },
            ...(note ? { description: note } : {}),
            ...(photo
              ? { image: { "@type": "ImageObject", url: photo, contentUrl: photo, caption: `${author.full_name} — FanFaster muallifi` } }
              : {}),
          },
          hasPart: posts.map((p) => ({ "@type": "BlogPosting", headline: p.sarlavha, url: postUrl(p), datePublished: isoDate(p.created_at) })),
        },
        breadcrumb([["FanFaster", `${SITE_URL}/`], ["Mualliflar", `${SITE_URL}/blog/mualliflar`], [author.full_name, url]]),
      ],
    },
    body: wrap(`${nav}
${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(author.full_name)} — FanFaster muallifi" width="160" height="160" style="border-radius:50%;object-fit:cover">` : ""}
<h1>${escapeHtml(author.full_name)}</h1>
<p>FanFaster muallifi${note ? `. ${escapeHtml(note)}` : ""}</p>
<h2>Maqolalari (${posts.length})</h2>
<ul>${posts.map((p) => postCard(p)).join("")}</ul>`),
  };
}

async function blogIndexPage(env: Record<string, unknown>): Promise<Page> {
  const posts = await fetchPublishedPosts(env);
  const authors = await fetchAuthorsOf(posts, env);
  const url = `${SITE_URL}/blog`;
  return {
    status: 200,
    title: "FanFaster blogi — huquq bo'yicha maqolalar",
    description:
      "FanFaster ustozlari va mualliflarining huquq, O'zbekiston qonunchiligi, kazuslar va ta'lim haqidagi maqolalari.",
    canonical: url,
    image: posts.map(postImage).find(Boolean) ?? DEFAULT_OG_IMAGE,
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": url,
      name: "FanFaster blogi",
      url,
      inLanguage: "uz",
      publisher: PUBLISHER,
      blogPost: posts.map((p) => {
        const a = p.ustoz_id ? authors.get(p.ustoz_id) : undefined;
        const img = postImage(p);
        return {
          "@type": "BlogPosting",
          headline: p.sarlavha,
          url: postUrl(p),
          datePublished: isoDate(p.created_at),
          ...(img ? { image: img } : {}),
          author: { "@type": "Person", name: a?.full_name || p.ustoz_ismi, ...(a ? { url: authorUrl(a) } : {}) },
        };
      }),
    },
    body: wrap(`${nav}<h1>FanFaster blogi</h1>
<p>Huquq, O'zbekiston qonunchiligi, kazuslar va ta'lim haqidagi maqolalar.</p>
<ul>${posts.map((p) => postCard(p, p.ustoz_id ? authors.get(p.ustoz_id) : undefined)).join("")}</ul>`),
  };
}

async function authorsIndexPage(env: Record<string, unknown>): Promise<Page> {
  const posts = await fetchPublishedPosts(env);
  const authors = [...(await fetchAuthorsOf(posts, env)).values()];
  const count = (a: Author) => posts.filter((p) => p.ustoz_id === a.id).length;
  const url = `${SITE_URL}/blog/mualliflar`;
  return {
    status: 200,
    title: "FanFaster mualliflari — huquqshunos ustozlar",
    description: "FanFaster blogida maqola yozgan ustoz va mualliflar ro'yxati.",
    canonical: url,
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": url,
      url,
      name: "FanFaster mualliflari",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: authors.map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: { "@type": "Person", name: a.full_name, url: authorUrl(a) },
        })),
      },
    },
    body: wrap(`${nav}<h1>FanFaster mualliflari</h1><ul>${authors
      .map((a) => {
        const photo = publicImageUrl(a.face_photo_url);
        return `<li>${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(a.full_name)}" width="48" height="48" loading="lazy" style="border-radius:50%;object-fit:cover"> ` : ""}<a href="/blog/muallif/${escapeHtml(a.muallif_slug)}">${escapeHtml(a.full_name)}</a> — ${count(a)} ta maqola</li>`;
      })
      .join("")}</ul>`),
  };
}

const notFoundPage = (): Page => ({
  status: 404,
  title: "Sahifa topilmadi | FanFaster",
  description: "Bu maqola yoki muallif sahifasi topilmadi.",
  noindex: true,
});

// ─── HTML'ga joylash ──────────────────────────────────────────────────────


// ─── Pages Function entry ─────────────────────────────────────────────────

export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const e = env as unknown as Record<string, unknown>;

  const postMatch = path.match(/^\/blog\/([^/]+)$/);
  const authorMatch = path.match(/^\/blog\/muallif\/([^/]+)$/);
  const isKnown = path === "/blog" || postMatch || authorMatch;
  if (!isKnown || request.method !== "GET") return env.ASSETS.fetch(request);

  // SPA'ning index.html'i (o'z domenidan — pages.dev va fanfaster.uz uchun ham ishlaydi)
  const assetResponse = await env.ASSETS.fetch(new Request(new URL("/", url.origin).toString(), { headers: request.headers }));
  if (!assetResponse.ok) {
    console.error("[blog-seo] index.html olinmadi, status:", assetResponse.status);
    return env.ASSETS.fetch(request);
  }
  const html = await assetResponse.text();

  let page: Page | null;
  try {
    if (path === "/blog") page = await blogIndexPage(e);
    else if (path === "/blog/mualliflar") page = await authorsIndexPage(e);
    else if (path === "/blog/mavzular")
      page = { status: 200, title: "Mavzular — FanFaster blogi", description: "Tez orada.", noindex: true };
    else if (authorMatch) page = await authorPage(decodeURIComponent(authorMatch[1]), e);
    else page = await postPage(decodeURIComponent(postMatch![1]), e);
  } catch (err) {
    // Supabase ishlamasa ham sahifa ochilsin (SEO'siz), 404 bermaymiz.
    console.error("[blog-seo] Xato:", err instanceof Error ? err.stack : String(err));
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  page ??= notFoundPage();

  const headers = new Headers(assetResponse.headers);
  for (const h of ["content-length", "content-encoding", "transfer-encoding", "etag", "last-modified"]) headers.delete(h);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Blog-SEO", "processed");
  headers.set("Cache-Control", "public, max-age=60, s-maxage=300, must-revalidate");
  headers.set(
    "X-Robots-Tag",
    page.noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
  );
  return new Response(render(html, page), { status: page.status, headers });
};
