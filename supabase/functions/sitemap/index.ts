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

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const entries: SitemapEntry[] = [
      { loc: `${SITE_URL}/`, changefreq: 'weekly', priority: '1.0' },
      { loc: `${SITE_URL}/blog`, changefreq: 'daily', priority: '0.9' },
    ];

    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (posts) {
      for (const post of posts) {
        if (post.slug) {
          entries.push({
            loc: `${SITE_URL}/blog/${post.slug}`,
            lastmod: post.updated_at ? new Date(post.updated_at).toISOString().split('T')[0] : undefined,
            changefreq: 'monthly',
            priority: '0.6',
          });
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
          entries.push({
            loc: `${SITE_URL}/blog/muallif/${author.muallif_slug}`,
            changefreq: 'monthly',
            priority: '0.5',
          });
        }
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>
    <loc>${e.loc}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    return new Response(xml, {
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
