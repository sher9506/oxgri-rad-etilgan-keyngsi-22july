import { Context } from "netlify:edge";

const SUPABASE_URL = "https://mrxdoeeyxawcwrndyrwp.supabase.co";
const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeGRvZWV5eGF3Y3dybmR5cndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMjYyNjksImV4cCI6MjEwMzkwMjI2OX0.Zj7BMWt0KHuo6Fh8ojRf67SW2vPwUICHGh3NYKlWfxc";

const SITE_URL = "https://fanfaster.uz";

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
    )}&select=id,full_name,muallif_slug,note&limit=1`,
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
    `${SUPABASE_URL}/rest/v1/ustoz?id=eq.${id}&select=id,full_name,muallif_slug,note&limit=1`,
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
  ogImage?: string | null
): string {
  const escapedTitle = escapeHtml(title);
  const escapedDesc = escapeHtml(description);
  const ogImg = ogImage || "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=630&fit=crop";

  const jsonLdStr = escapeHtml(JSON.stringify(jsonLd));

  return `    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDesc}" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDesc}" />
    <meta property="og:type" content="article" />
    <meta property="og:image" content="${escapeHtml(ogImg)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDesc}" />
    <meta name="twitter:image" content="${escapeHtml(ogImg)}" />
    <script type="application/ld+json" id="page-jsonld">${jsonLdStr}</script>
  `;
}

function injectHead(html: string, headContent: string): string {
  // Remove existing title tag
  let modified = html.replace(/<title>[\s\S]*?<\/title>/i, "");
  // Remove existing meta description
  modified = modified.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    ""
  );
  // Remove existing og:title, og:description, og:type
  modified = modified.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/gi,
    ""
  );
  modified = modified.replace(
    /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/gi,
    ""
  );
  modified = modified.replace(
    /<meta\s+property=["']og:type["']\s+content=["'][^"']*["']\s*\/?>/gi,
    ""
  );
  // Remove existing twitter:title, twitter:description, twitter:card
  modified = modified.replace(
    /<meta\s+name=["']twitter:card["']\s+content=["'][^"']*["']\s*\/?>/gi,
    ""
  );
  modified = modified.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']\s*\/?>/gi,
    ""
  );
  modified = modified.replace(
    /<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']\s*\/?>/gi,
    ""
  );
  // Remove existing page-jsonld script
  modified = modified.replace(
    /<script\s+type=["']application\/ld\+json["']\s+id=["']page-jsonld["']>[^<]*<\/script>/gi,
    ""
  );

  // Insert new head content before </head>
  modified = modified.replace("</head>", `${headContent}</head>`);
  return modified;
}

export default async (req: Request, ctx: Context) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Blog post: /blog/:slug (but not /blog/muallif/...)
  const blogMatch = path.match(/^\/blog\/([^/]+)$/);
  const muallifMatch = path.match(/^\/blog\/muallif\/([^/]+)$/);

  console.log("[blog-seo] Edge function triggered for path:", path);

  if (!blogMatch && !muallifMatch) {
    return ctx.next();
  }

  // Fetch the SPA index.html directly from bolt.host root (not the full path,
  // because bolt.host only serves the root — deep paths time out)
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

        if (post.ustoz_id) {
          const author = await fetchAuthorById(post.ustoz_id);
          if (author) {
            authorName = author.full_name || authorName;
            authorSlug = author.muallif_slug || "";
          }
        }

        const title = `${post.sarlavha} — ${authorName} | FanFaster`;
        const description = post.meta_description
          ? truncate(post.meta_description, 160)
          : truncate(stripHtml(post.mazmun), 160);

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
          },
          datePublished: post.created_at
            ? new Date(post.created_at).toISOString()
            : new Date().toISOString(),
          publisher: { "@type": "Organization", name: "FanFaster" },
          mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
        };

        const headContent = buildHead(
          title,
          description,
          jsonLd,
          post.rasm_url
        );
        html = injectHead(html, headContent);
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

        const jsonLd: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "Person",
          name: author.full_name,
          url: `${SITE_URL}/blog/muallif/${author.muallif_slug}`,
          ...(notePart ? { description: notePart } : {}),
        };

        const headContent = buildHead(title, description, jsonLd);
        html = injectHead(html, headContent);
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
    if (key.toLowerCase() !== "content-length" && key.toLowerCase() !== "content-encoding" && key.toLowerCase() !== "transfer-encoding") {
      respHeaders.set(key, value);
    }
  }

  return new Response(html, {
    status: 200,
    headers: respHeaders,
  });
};
