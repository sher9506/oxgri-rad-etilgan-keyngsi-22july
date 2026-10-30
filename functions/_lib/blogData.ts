/**
 * Blog SEO uchun umumiy yordamchilar — functions/blog/[[slug]].ts va
 * functions/sitemap.xml.ts ishlatadi. Route emas (onRequest eksport qilmaydi).
 */

export const SUPABASE_URL = "https://mrxdoeeyxawcwrndyrwp.supabase.co";
// Ochiq anon kalit (brauzerdagi bilan bir xil), env bo'lmasa shu ishlatiladi.
const SUPABASE_ANON_KEY_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeGRvZWV5eGF3Y3dybmR5cndwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMjYyNjksImV4cCI6MjEwMzkwMjI2OX0.Zj7BMWt0KHuo6Fh8ojRf67SW2vPwUICHGh3NYKlWfxc";

export const SITE_URL = "https://fanfaster.uz";
export const LOGO_URL = `${SITE_URL}/favicon.png`;
export const DEFAULT_OG_IMAGE =
  "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=630&fit=crop";

export interface BlogPost {
  id: string;
  ustoz_id: string | null;
  ustoz_ismi: string;
  sarlavha: string;
  mazmun: string;
  slug: string;
  created_at: string;
  updated_at: string | null;
  meta_description: string | null;
  rasm_url: string | null;
}

export interface Author {
  id: string;
  full_name: string;
  muallif_slug: string;
  note: string | null;
  face_photo_url: string | null;
}

const POST_FIELDS = "id,ustoz_id,ustoz_ismi,sarlavha,mazmun,slug,created_at,updated_at,meta_description,rasm_url";
const AUTHOR_FIELDS = "id,full_name,muallif_slug,note,face_photo_url";

/** Supabase REST'dan o'qish; xato bo'lsa bo'sh massiv (sahifa baribir ochiladi). */
async function sb<T>(query: string, env: Record<string, unknown>): Promise<T[]> {
  const key = (env.SUPABASE_ANON_KEY as string | undefined) ?? SUPABASE_ANON_KEY_FALLBACK;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error("[blog-seo] Supabase xatosi:", res.status, query.split("?")[0]);
    return [];
  }
  return res.json();
}

export const fetchPublishedPosts = (env: Record<string, unknown>, filter = "") =>
  sb<BlogPost>(`blog_posts?status=eq.published${filter}&select=${POST_FIELDS}&order=created_at.desc`, env);

export const fetchPost = async (slug: string, env: Record<string, unknown>) =>
  (await fetchPublishedPosts(env, `&slug=eq.${encodeURIComponent(slug)}&limit=1`))[0] ?? null;

export const fetchAuthorBySlug = async (slug: string, env: Record<string, unknown>) =>
  (await sb<Author>(`ustoz?muallif_slug=eq.${encodeURIComponent(slug)}&select=${AUTHOR_FIELDS}&limit=1`, env))[0] ?? null;

/** Kamida bitta e'lon qilingan maqolasi bor mualliflar (bo'sh profillar Google'ga berilmaydi). */
export async function fetchAuthorsOf(posts: BlogPost[], env: Record<string, unknown>) {
  const ids = [...new Set(posts.map((p) => p.ustoz_id).filter((x): x is string => !!x && /^[0-9a-f-]{36}$/i.test(x)))];
  if (!ids.length) return new Map<string, Author>();
  const rows = await sb<Author>(`ustoz?id=in.(${ids.join(",")})&muallif_slug=not.is.null&select=${AUTHOR_FIELDS}`, env);
  return new Map(rows.filter((a) => a.muallif_slug).map((a) => [a.id, a]));
}

// ─── Matn yordamchilari ───────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };

/** HTML teglarini olib tashlab, entity'larni oddiy belgiga aylantiradi. */
export function plainText(html: string): string {
  return String(html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "").trimEnd() + "…";
}

export function isValidNote(note: string | null): note is string {
  return !!note && note !== "null" && note.trim() !== "";
}

/**
 * Supabase'dagi rasm manzilini Google ko'radigan holga keltiradi.
 * /render/image/ (o'lcham o'zgartirish) bu tarifda 403 beradi — asl /object/ manzil ishlatiladi.
 */
export function publicImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace("/storage/v1/render/image/public/", "/storage/v1/object/public/").split("?")[0];
}

/** Maqola matnidagi birinchi rasm. */
export function firstContentImage(html: string): string | null {
  const m = String(html ?? "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return m && /^https?:\/\//.test(m[1]) ? m[1] : null;
}

/** Maqola rasmi: muqova → matndagi birinchi rasm → null. */
export const postImage = (p: BlogPost) => publicImageUrl(p.rasm_url) ?? firstContentImage(p.mazmun);

export const postDescription = (p: BlogPost) =>
  truncate(isValidNote(p.meta_description) ? plainText(p.meta_description) : plainText(p.mazmun), 160);

export const isoDate = (d: string | null | undefined) => (d ? new Date(d).toISOString() : undefined);
