import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AuthorAvatar } from '@/components/features/AuthorAvatar';
import { type AuthorInfo, isValidNote, extractErrorMessage } from '@/lib/blogUtils';
import { setDocumentTitle, resetDocumentTitle } from '@/lib/seo';

/** /blog/mualliflar — kamida bitta e'lon qilingan maqolasi bor mualliflar. */
export default function BlogMualliflar() {
  const [authors, setAuthors] = useState<(AuthorInfo & { count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDocumentTitle('FanFaster mualliflari — huquqshunos ustozlar');
    (async () => {
      try {
        const { data: posts, error: pErr } = await supabase.from('blog_posts').select('ustoz_id').eq('status', 'published');
        if (pErr) throw pErr;
        const counts = new Map<string, number>();
        for (const p of posts ?? []) if (p.ustoz_id) counts.set(p.ustoz_id, (counts.get(p.ustoz_id) ?? 0) + 1);
        if (!counts.size) return;
        const { data, error: aErr } = await supabase
          .from('ustoz')
          .select('id, muallif_slug, full_name, face_photo_url, note')
          .in('id', [...counts.keys()])
          .not('muallif_slug', 'is', null);
        if (aErr) throw aErr;
        setAuthors(((data ?? []) as AuthorInfo[]).map((a) => ({ ...a, count: counts.get(a.id!) ?? 0 })).sort((a, b) => b.count - a.count));
      } catch (err) {
        console.error('Mualliflar yuklash xatosi:', err);
        setError(extractErrorMessage(err, "Mualliflarni yuklab bo'lmadi"));
      } finally {
        setLoading(false);
      }
    })();
    return () => resetDocumentTitle();
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/blog" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600">
        <ArrowLeft className="h-4 w-4" /> Blog
      </Link>
      <h1 className="mb-2 text-3xl font-extrabold text-gray-900">FanFaster mualliflari</h1>
      <p className="mb-8 text-sm text-gray-500">Blogda maqola yozgan ustoz va mualliflar.</p>
      {loading && <div className="py-16 text-center text-sm text-gray-400">Yuklanmoqda…</div>}
      {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      {!loading && !error && authors.length === 0 && <div className="py-16 text-center text-sm text-gray-400">Hozircha mualliflar yo'q.</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {authors.map((a) => (
          <Link
            key={a.id}
            to={`/blog/muallif/${a.muallif_slug}`}
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <AuthorAvatar author={a} size="h-12 w-12 text-sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-gray-900">{a.full_name}</span>
              <span className="mt-1 block truncate text-xs text-gray-500">
                {a.count} ta maqola{isValidNote(a.note) ? ` · ${a.note}` : ''}
              </span>
            </span>
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-blue-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}
