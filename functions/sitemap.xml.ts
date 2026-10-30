/**
 * Cloudflare Pages Function — /sitemap.xml har so'rovda bazadan yasaladi:
 * yangi maqola darhol kiradi, maqola va muallif rasmlari <image:image> bilan.
 * Faqat kamida bitta maqolasi bor mualliflar kiradi (bo'sh profillar emas).
 */

import { SITE_URL, fetchAuthorsOf, fetchPublishedPosts, postImage, publicImageUrl } from "./_lib/blogData";

const xml = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const day = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

interface Entry {
  loc: string;
  lastmod?: string;
  images?: { loc: string; title: string }[];
}

export const onRequest: PagesFunction = async ({ env }) => {
  const posts = await fetchPublishedPosts(env as unknown as Record<string, unknown>);
  const authors = await fetchAuthorsOf(posts, env as unknown as Record<string, unknown>);
  const latest = day(posts[0]?.updated_at || posts[0]?.created_at);

  const entries: Entry[] = [
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/nasher-ai` },
    { loc: `${SITE_URL}/blog`, lastmod: latest },
    ...(authors.size ? [{ loc: `${SITE_URL}/blog/mualliflar`, lastmod: latest }] : []),
    ...posts.map((p) => {
      const img = postImage(p);
      return {
        loc: `${SITE_URL}/blog/${encodeURIComponent(p.slug)}`,
        lastmod: day(p.updated_at || p.created_at),
        images: img ? [{ loc: img, title: p.sarlavha }] : undefined,
      };
    }),
    ...[...authors.values()].map((a) => {
      const own = posts.find((p) => p.ustoz_id === a.id);
      const photo = publicImageUrl(a.face_photo_url);
      return {
        loc: `${SITE_URL}/blog/muallif/${encodeURIComponent(a.muallif_slug)}`,
        lastmod: day(own?.updated_at || own?.created_at),
        images: photo ? [{ loc: photo, title: `${a.full_name} — FanFaster muallifi` }] : undefined,
      };
    }),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries
  .map(
    (e) =>
      `  <url>\n    <loc>${xml(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}${(e.images ?? [])
        .map((i) => `\n    <image:image>\n      <image:loc>${xml(i.loc)}</image:loc>\n      <image:title>${xml(i.title)}</image:title>\n    </image:image>`)
        .join("")}\n  </url>`
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600, s-maxage=600" },
  });
};
