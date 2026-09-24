/**
 * Cloudflare Pages Function — server-side SEO injection for blog pages.
 *
 * Intercepts /blog/:slug (article) and /blog/muallif/:slug (author) requests,
 * fetches data from Supabase, and injects meta tags + JSON-LD into the SPA's
 * index.html before returning it — so crawlers see full SEO metadata without
 * executing JavaScript.
 *
 * For all other /blog/* paths (e.g. /blog, /blog/mualliflar), the request is
 * passed through to the static asset (SPA) unchanged.
 */

// ─── Supabase config ──────────────────────────────────────────────────────

const SUPABASE_URL = "https://mrxdoeeyxawcwrndyrwp.supabase.co";
const SUPABASE_ANON_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeGRvZWV5eGF3Y3dybmR5cndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMjYyNjksImV4cCI6MjEwMzkwMjI2OX0.Zj7BMWt0KHuo6Fh8ojRf67SW2vPwUICHGh3NYKlWfxc";

const SITE_URL = "https://fanfaster.uz";

const DEFAULT_OG_IMAGE =
  "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=630&fit=crop";

// ─── Types ────────────────────────────────────────────────────────────────

interface BlogPost {
  id: string;
  ustoz_id: string | null;
  ustoz_ismi: string;
  sarlavha: string;
  mazmun: string;
  slug: string;
  created_at: string;
  meta_description: string | null;
  rasm_url: string | null;
}

interface Author {
  id: string;
  full_name: string;
  muallif_slug: string;
  note: string | null;
  face_photo_url: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

function toSeoImageUrl(url: string): string {
  if (!url) return url;
  const renderUrl = url.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );
  if (renderUrl === url) return url;
  const sep = renderUrl.includes("?") ? "&" : "?";
  return `${renderUrl}${sep}format=origin&width=1200&height=1200&resize=cover&quality=80`;
}

// ─── Supabase fetchers ────────────────────────────────────────────────────

async function fetchBlogPost(
  slug: string,
  anonKey: string
): Promise<BlogPost | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(
      slug
    )}&status=eq.published&select=id,ustoz_id,ustoz_ismi,sarlavha,mazmun,slug,created_at,meta_description,rasm_url&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.length > 0 ? data[0] : null;
}

async function fetchAuthorBySlug(
  slug: string,
  anonKey: string
): Promise<{ author: Author; postCount: number } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ustoz?muallif_slug=eq.${encodeURIComponent(
      slug
    )}&select=id,full_name,muallif_slug,note,face_photo_url&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.length === 0) return null;
  const author = data[0] as Author;

  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/blog_posts?ustoz_id=eq.${
      author.id
    }&status=eq.published&select=id`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Prefer: "count=exact",
      },
    }
  );
  const postCount = countRes.ok
    ? parseInt(
        countRes.headers.get("content-range")?.split("/")[1] ?? "0",
        10
      )
    : 0;

  return { author, postCount };
}

async function fetchAuthorById(
  id: string,
  anonKey: string
): Promise<Author | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ustoz?id=eq.${id}&select=id,full_name,muallif_slug,note,face_photo_url&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.length > 0 ? data[0] : null;
}

// ─── Head builder ─────────────────────────────────────────────────────────

function buildHead(
  title: string,
  description: string,
  jsonLd: Record<string, unknown>,
  ogImage: string,
  ogUrl: string,
  ogType: "article" | "profile"
): string {
  const escapedTitle = escapeHtml(title);
  const escapedDesc = escapeHtml(description);
  const escapedImg = escapeHtml(ogImage);
  const escapedUrl = escapeHtml(ogUrl);
  const jsonLdStr = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return `    <title>${escapedTitle}</title>
    <link rel="canonical" href="${escapedUrl}" />
    <meta name="description" content="${escapedDesc}" />
    <meta property="og:url" content="${escapedUrl}" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDesc}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:image" content="${escapedImg}" />
    <meta property="og:image:alt" content="${escapedTitle}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="1200" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDesc}" />
    <meta name="twitter:image" content="${escapedImg}" />
    <script type="application/ld+json" id="page-jsonld">${jsonLdStr}</script>
  `;
}

function injectHead(html: string, headContent: string): string {
  let modified = html;

  modified = modified.replace(/<title>[\s\S]*?<\/title>/i, "");
  modified = modified.replace(
    /<meta\s+name=["']description["'][^>]*>/i,
    ""
  );
  modified = modified.replace(
    /<meta\b[^>]*(?:og:|twitter:)[^>]*>/gi,
    ""
  );
  modified = modified.replace(
    /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    ""
  );

  modified = modified.replace("</head>", `${headContent}</head>`);
  return modified;
}

// ─── Pages Function entry ─────────────────────────────────────────────────

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const blogMatch = path.match(/^\/blog\/([^/]+)$/);
  const muallifMatch = path.match(/^\/blog\/muallif\/([^/]+)$/);

  // Not a blog post or author page — serve the static SPA directly
  if (!blogMatch && !muallifMatch) {
    return env.ASSETS.fetch(request);
  }

  // Fetch the SPA's index.html from the built static assets
  const rootUrl = new URL("https://fanfaster.uz/");
  const rootReq = new Request(rootUrl, request);
  const assetResponse = await env.ASSETS.fetch(rootReq);
  if (!assetResponse.ok) {
    console.error(
      "[blog-seo] Failed to fetch index.html from assets, status:",
      assetResponse.status
    );
    return new Response("Internal error", { status: 502 });
  }
  let html = await assetResponse.text();

  // Resolve Supabase anon key from env (Cloudflare Pages env var), fall back to hardcoded
  const anonKey =
    (env.SUPABASE_ANON_KEY as string | undefined) ?? SUPABASE_ANON_KEY_FALLBACK;

  try {
    if (blogMatch && blogMatch[1] !== "muallif") {
      const slug = blogMatch[1];
      const post = await fetchBlogPost(slug, anonKey);

      if (post) {
        let authorName = post.ustoz_ismi || "";
        let authorSlug = "";
        let authorPhoto: string | null = null;
        if (post.ustoz_id) {
          const author = await fetchAuthorById(post.ustoz_id, anonKey);
          if (author) {
            authorName = author.full_name || authorName;
            authorSlug = author.muallif_slug || "";
            authorPhoto = author.face_photo_url || null;
          }
        }

        const title = `${post.sarlavha} — ${authorName} | FanFaster`;
        const description = post.meta_description
          ? truncate(post.meta_description, 160)
          : truncate(stripHtml(post.mazmun), 160);

        const ogImage = authorPhoto
          ? toSeoImageUrl(authorPhoto)
          : post.rasm_url || DEFAULT_OG_IMAGE;
        const pageUrl = `${SITE_URL}/blog/${post.slug}`;

        const jsonLd: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.sarlavha,
          author: {
            "@type": "Person",
            name: authorName,
            ...(authorSlug
              ? { url: `${SITE_URL}/blog/muallif/${authorSlug}` }
              : {}),
            ...(authorPhoto ? { image: toSeoImageUrl(authorPhoto) } : {}),
          },
          datePublished: post.created_at
            ? new Date(post.created_at).toISOString()
            : new Date().toISOString(),
          publisher: { "@type": "Organization", name: "FanFaster" },
          mainEntityOfPage: pageUrl,
          image: ogImage,
        };

        const headContent = buildHead(
          title,
          description,
          jsonLd,
          ogImage,
          pageUrl,
          "article"
        );
        html = injectHead(html, headContent);
      }
    } else if (muallifMatch) {
      const slug = muallifMatch[1];
      const result = await fetchAuthorBySlug(slug, anonKey);

      if (result) {
        const { author, postCount } = result;
        const title = `${author.full_name} — FanFaster ustozi | Barcha maqolalar`;
        const notePart =
          author.note &&
          author.note !== "null" &&
          author.note.trim() !== ""
            ? author.note
            : "";
        const description = truncate(
          `${author.full_name}ning FanFaster platformasidagi maqolalari. ${postCount} ta maqola${
            notePart ? `, ${notePart}` : ""
          }`,
          160
        );

        const ogImage = author.face_photo_url
          ? toSeoImageUrl(author.face_photo_url)
          : DEFAULT_OG_IMAGE;
        const pageUrl = `${SITE_URL}/blog/muallif/${author.muallif_slug}`;

        const jsonLd: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "Person",
          "@id": `${pageUrl}#person`,
          name: author.full_name,
          url: pageUrl,
          ...(notePart ? { description: notePart } : {}),
          ...(author.face_photo_url
            ? {
                image: {
                  "@type": "ImageObject",
                  url: toSeoImageUrl(author.face_photo_url),
                  contentUrl: toSeoImageUrl(author.face_photo_url),
                  caption: `${author.full_name} — FanFaster muallifi`,
                },
              }
            : {}),
        };

        const headContent = buildHead(
          title,
          description,
          jsonLd,
          ogImage,
          pageUrl,
          "profile"
        );
        html = injectHead(html, headContent);
      }
    }
  } catch (e) {
    console.error(
      "[blog-seo] Error:",
      e instanceof Error ? e.message : String(e),
      e instanceof Error ? e.stack : ""
    );
  }

  const respHeaders = new Headers();
  respHeaders.set("Content-Type", "text/html; charset=utf-8");
  respHeaders.set("X-Blog-SEO", "processed");
  for (const [key, value] of assetResponse.headers.entries()) {
    if (
      key.toLowerCase() !== "content-length" &&
      key.toLowerCase() !== "content-encoding" &&
      key.toLowerCase() !== "transfer-encoding" &&
      key.toLowerCase() !== "cache-control"
    ) {
      respHeaders.set(key, value);
    }
  }
  respHeaders.set(
    "Cache-Control",
    "public, max-age=60, s-maxage=60, must-revalidate"
  );

  return new Response(html, {
    status: 200,
    headers: respHeaders,
  });
};
