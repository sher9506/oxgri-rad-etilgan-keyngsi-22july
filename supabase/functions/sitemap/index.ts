import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SITE_URL = 'https://fanfaster.uz';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// sitemap edge function — public, verify_jwt = false
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const urls: string[] = [`${SITE_URL}/`];

    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (posts) {
      for (const post of posts) {
        if (post.slug) {
          urls.push(`${SITE_URL}/blog/${post.slug}`);
        }
      }
    }

    const { data: authors } = await supabase
      .from('ustoz')
      .select('muallif_slug')
      .not('muallif_slug', 'is', null)
      .neq('muallif_slug', '');

    if (authors) {
      for (const author of authors) {
        if (author.muallif_slug) {
          urls.push(`${SITE_URL}/blog/muallif/${author.muallif_slug}`);
        }
      }
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[sitemap] Xatosi:', err);
    return new Response('Internal error', {
      status: 500,
      headers: corsHeaders,
    });
  }
});
