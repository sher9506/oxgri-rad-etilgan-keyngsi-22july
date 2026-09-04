
import { useState, useEffect } from 'react';
import { Calendar, User, ArrowLeft, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setDocumentTitle, setMetaDescription, setJsonLd, removeJsonLd, resetDocumentTitle, resetMetaDescription } from '@/lib/seo';

interface BlogPost {
  id: string;
  ustoz_id: string | null;
  ustoz_ismi: string;
  sarlavha: string;
  mazmun: string;
  rasm_url: string | null;
  status: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

interface AuthorInfo {
  muallif_slug: string;
  full_name: string;
}

export default function BlogPostDetail({ slug: slugProp }: { slug?: string }) {
  const navigate = useNavigate();
  const slug = slugProp;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    loadPost(slug);
    return () => {
      removeJsonLd('blog-post-jsonld');
      resetDocumentTitle();
      resetMetaDescription();
    };
  }, [slug]);

  const loadPost = async (slugParam: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slugParam)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setPost(data);

      if (data.ustoz_id) {
        const { data: authorData } = await supabase
          .from('ustoz')
          .select('muallif_slug, full_name')
          .eq('id', data.ustoz_id)
          .maybeSingle();
        if (authorData) setAuthor(authorData);
      }

      const authorName = data.ustoz_ismi || author?.full_name || '';
      const authorSlug = author?.muallif_slug || '';

      setDocumentTitle(`${data.sarlavha} — ${authorName} | FanFaster`);
      setMetaDescription(data.mazmun.slice(0, 160));

      setJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: data.sarlavha,
        author: {
          '@type': 'Person',
          name: authorName,
          ...(authorSlug ? { url: `https://fanfaster.uz/blog/muallif/${authorSlug}` } : {}),
        },
        datePublished: data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString(),
        publisher: {
          '@type': 'Organization',
          name: 'FanFaster',
        },
        mainEntityOfPage: `https://fanfaster.uz/blog/${data.slug}`,
      }, 'blog-post-jsonld');
    } catch (err) {
      console.error('Blog post yuklash xatosi:', err);
      const msg = err instanceof Error ? err.message : "Blog postni yuklab bo'lmadi";
      setError(msg);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/blog')}
          className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Blog ro'yxatiga qaytish
        </button>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">Maqola topilmadi</p>
          <p className="text-xs text-gray-400">Bu maqola mavjud emas yoki o'chirilgan bo'lishi mumkin</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/blog')}
          className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Blog ro'yxatiga qaytish
        </button>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <p className="text-sm font-bold text-red-400 mb-1">Xatolik yuz berdi</p>
          <p className="text-xs text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const authorName = post.ustoz_ismi || author?.full_name || '';
  const authorSlug = author?.muallif_slug || '';

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate('/blog')}
        className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all"
      >
        <ArrowLeft className="h-4 w-4" />
        Blog ro'yxatiga qaytish
      </button>

      <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {post.rasm_url && (
          <div className="w-full h-64 overflow-hidden bg-gray-100">
            <img
              src={post.rasm_url}
              alt={post.sarlavha}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
            {authorName && (
              <button
                onClick={() => authorSlug && navigate(`/blog/muallif/${authorSlug}`)}
                className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                disabled={!authorSlug}
              >
                <User className="h-3.5 w-3.5" />
                <span className="font-semibold text-gray-700 hover:text-blue-600">
                  Muallif: {authorName}
                </span>
              </button>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.created_at)}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-4 leading-tight">
            {post.sarlavha}
          </h1>

          <div className="prose prose-sm md:prose-base max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
            {post.mazmun}
          </div>
        </div>
      </article>
    </div>
  );
}
