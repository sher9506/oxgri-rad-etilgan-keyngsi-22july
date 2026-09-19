import { Context } from "netlify:edge";

const SUPABASE_URL = "https://mrxdoeeyxawcwrndyrwp.supabase.co";
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeGRvZWV5eGF3Y3dybmR5cndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMjYyNjksImV4cCI6MjEwMzkwMjI2OX0.Zj7BMWt0KHuo6Fh8ojRf67SW2vPwUICHGh3NYKlWfxc";

const SITE_URL = "https://fanfaster.uz";

const DEFAULT_OG_IMAGE =
  "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=630&fit=crop";

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
  return `${renderUrl}${sep}format=origin&width=1200&height=630&resize=cover`;
}

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

async function fetchBlogPost(slug: string): Promise<BlogPost | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(
      slug
    )}&status=eq.published&select=id,ustoz_id,ustoz_ismi,sarlavha,mazmun,slug,created_at,meta_description,rasm_url&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.length > 0 ? data[0] : null;
}

async function fetchAuthorBySlug(
  slug: string
): Promise<{ author: Author; postCount: number } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ustoz?muallif_slug=eq.${encodeURIComponent(
      slug
    )}&select=id,full_name,muallif_slug,note,face_photo_url&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "count=exact",
      },
    }
  );
  const postCount = countRes.ok
    ? parseInt(countRes.headers.get("content-range")?.split("/")[1] ?? "0", 10)
    : 0;

  return { author, postCount };
}

async function fetchAuthorById(id: string): Promise<Author | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/ustoz?id=eq.${id}&select=id,full_name,muallif_slug,note,face_photo_url&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.length > 0 ? data[0] : null;
}

function buildHead(
  title: string,
  description: string,
  jsonLd: Record<string, unknown>,
  ogImage: string,
  ogUrl: string,
  ogType: 'article' | 'profile'
): string {
  const escapedTitle = escapeHtml(title);
  const escapedDesc = escapeHtml(description);
  const escapedImg = escapeHtml(ogImage);
  const escapedUrl = escapeHtml(ogUrl);
  const jsonLdStr = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

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
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDesc}" />
    <meta name="twitter:image" content="${escapedImg}" />
    <script type="application/ld+json" id="page-jsonld">${jsonLdStr}</script>
  `;
}

function injectHead(html: string, headContent: string): string {
  let modified = html;

  // Remove existing title tag
  modified = modified.replace(/<title>[\s\S]*?<\/title>/i, "");

  // Remove existing meta description
  modified = modified.replace(
    /<meta\s+name=["']description["'][^>]*>/i,
    ""
  );

  // Remove all social metadata regardless of attribute order or extra attributes.
  modified = modified.replace(
    /<meta\b[^>]*(?:og:|twitter:)[^>]*>/gi,
    ""
  );

  // Remove all origin JSON-LD so each SEO page has one authoritative schema block.
  modified = modified.replace(
    /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    ""
  );

  // Insert new head content before </head>
  modified = modified.replace("</head>", `${headContent}</head>`);
  return modified;
}

export default async (req: Request, ctx: Context) => {
  const url = new URL(req.url);
  const path = url.pathname;

  const blogMatch = path.match(/^\/blog\/([^/]+)$/);
  const muallifMatch = path.match(/^\/blog\/muallif\/([^/]+)$/);

  console.log("[blog-seo] Edge function triggered for path:", path);

  if (!blogMatch && !muallifMatch) {
    return ctx.next();
  }

  const originResponse = await fetch("https://sher9506-oxgri-rad-e-ipca.bolt.host/");
  if (!originResponse.ok) {
    console.error("[blog-seo] Failed to fetch origin HTML, status:", originResponse.status);
    return new Response("Internal error", { status: 502 });
  }
  let html = await originResponse.text();
  console.log("[blog-seo] Origin response status:", originResponse.status, "HTML length:", html.length);

  try {
    if (blogMatch && blogMatch[1] !== "muallif") {
      const slug = blogMatch[1];
      const post = await fetchBlogPost(slug);

      if (post) {
        console.log("[blog-seo] Blog post found:", post.sarlavha);
        let authorName = post.ustoz_ismi || "";
        let authorSlug = "";
        let authorPhoto: string | null = null;
        if (post.ustoz_id) {
          const author = await fetchAuthorById(post.ustoz_id);
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

        // Blog post: use author's profile photo (same as author page), fall back to post cover, then default
        const ogImage = authorPhoto ? toSeoImageUrl(authorPhoto) : (post.rasm_url || DEFAULT_OG_IMAGE);
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

        const headContent = buildHead(title, description, jsonLd, ogImage, pageUrl, 'article');
        html = injectHead(html, headContent);
        console.log("[blog-seo] Injected head for blog post, og:image:", ogImage);
      } else {
        console.log("[blog-seo] Blog post NOT found for slug:", slug);
      }
    } else if (muallifMatch) {
      const slug = muallifMatch[1];
      const result = await fetchAuthorBySlug(slug);

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

        // Author page: use the author's profile photo
        const ogImage = author.face_photo_url ? toSeoImageUrl(author.face_photo_url) : DEFAULT_OG_IMAGE;
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

        const headContent = buildHead(title, description, jsonLd, ogImage, pageUrl, 'profile');
        html = injectHead(html, headContent);
        console.log("[blog-seo] Injected head for author page, og:image:", ogImage);
      } else {
        console.log("[blog-seo] Author NOT found for slug:", slug);
      }
    }
  } catch (e) {
    console.error("[blog-seo] Error:", e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack : "");
  }

  const respHeaders = new Headers();
  respHeaders.set("Content-Type", "text/html; charset=utf-8");
  respHeaders.set("X-Blog-SEO", "processed");
  for (const [key, value] of originResponse.headers.entries()) {
    if (key.toLowerCase() !== "content-length" && key.toLowerCase() !== "content-encoding" && key.toLowerCase() !== "transfer-encoding" && key.toLowerCase() !== "cache-control") {
      respHeaders.set(key, value);
    }
  }
  respHeaders.set("Cache-Control", "public, max-age=60, s-maxage=60, must-revalidate");

  return new Response(html, {
    status: 200,
    headers: respHeaders,
  });
};
