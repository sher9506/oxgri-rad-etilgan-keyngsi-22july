
import { useState, useEffect } from 'react';
import { Calendar, User, ArrowLeft, BookOpen, Clock, Eye, Send, Link2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setDocumentTitle, setMetaDescription, setJsonLd, removeJsonLd, resetDocumentTitle, resetMetaDescription } from '@/lib/seo';
import { getInitials, estimateReadingTime, formatDate, type AuthorInfo, extractErrorMessage } from '@/lib/blogUtils';

interface BlogPost {
  id: string;
  ustoz_id: string | null;
  ustoz_ismi: string;
  sarlavha: string;
  mazmun: string;
  rasm_url: string | null;
  status: string;
  slug: string;
  views: number;
  created_at: string;
  updated_at: string;
}

interface RelatedPost {
  id: string;
  slug: string;
  sarlavha: string;
  mazmun: string;
  rasm_url: string | null;
  created_at: string;
}

export default function BlogPostDetail({ slug: slugProp }: { slug?: string }) {
  const navigate = useNavigate();
  const slug = slugProp;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [authorPostCount, setAuthorPostCount] = useState(0);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    setNotFound(false);
    setError(null);
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

      // Server-side view increment via SECURITY DEFINER function
      supabase.rpc('increment_blog_views', { p_slug: slugParam }).then(() => {});

      let authorData: AuthorInfo | null = null;

      if (data.ustoz_id) {
        const { data: aData } = await supabase
          .from('ustoz')
          .select('muallif_slug, full_name, face_photo_url, note')
          .eq('id', data.ustoz_id)
          .maybeSingle();
        if (aData) {
          authorData = aData as AuthorInfo;
          setAuthor(authorData);

          // Get author post count
          const { count } = await supabase
            .from('blog_posts')
            .select('*', { count: 'exact', head: true })
            .eq('ustoz_id', data.ustoz_id)
            .eq('status', 'published');
          setAuthorPostCount(count || 0);

          // Get related posts by same author
          const { data: related } = await supabase
            .from('blog_posts')
            .select('id, slug, sarlavha, mazmun, rasm_url, created_at')
            .eq('ustoz_id', data.ustoz_id)
            .eq('status', 'published')
            .neq('id', data.id)
            .order('created_at', { ascending: false })
            .limit(3);
          setRelatedPosts(related || []);
        }
      }

      const authorName = data.ustoz_ismi || authorData?.full_name || '';
      const authorSlug = authorData?.muallif_slug || '';

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
        publisher: { '@type': 'Organization', name: 'FanFaster' },
        mainEntityOfPage: `https://fanfaster.uz/blog/${data.slug}`,
      }, 'blog-post-jsonld');
    } catch (err) {
      console.error('Blog post yuklash xatosi:', err);
      setError(extractErrorMessage(err, "Blog postni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleTelegramShare = () => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(post?.sarlavha || '');
    window.open(`https://t.me/share/url?url=${url}&text=${title}`, '_blank');
  };

  const renderAvatar = (a: AuthorInfo | null, size: string = 'w-16 h-16 text-xl') => {
    if (a?.face_photo_url) {
      return (
        <img
          src={a.face_photo_url}
          alt={a.full_name}
          className={`${size} rounded-full object-cover shrink-0 mx-auto`}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }
    const name = a?.full_name || '?';
    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold shrink-0 mx-auto`}>
        {getInitials(name)}
      </div>
    );
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
        <button onClick={() => navigate('/blog')} className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all">
          <ArrowLeft className="h-4 w-4" /> Blog ro'yxatiga qaytish
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
        <button onClick={() => navigate('/blog')} className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all">
          <ArrowLeft className="h-4 w-4" /> Blog ro'yxatiga qaytish
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
    <div className="max-w-6xl mx-auto">
      <button onClick={() => navigate('/blog')} className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all">
        <ArrowLeft className="h-4 w-4" /> Blog ro'yxatiga qaytish
      </button>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ASOSIY USTUN */}
        <div className="flex-1 lg:max-w-[calc(70%-12px)]">
          <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {post.rasm_url && (
              <div className="w-full h-64 md:h-80 overflow-hidden bg-gray-100">
                <img
                  src={post.rasm_url}
                  alt={post.sarlavha}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                />
              </div>
            )}

            <div className="p-6 md:p-8">
              {/* Meta qator */}
              <div className="flex flex-wrap items-center gap-3 mb-5 text-xs text-gray-500">
                {authorName && (
                  <button
                    onClick={() => authorSlug && navigate(`/blog/muallif/${authorSlug}`)}
                    className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                    disabled={!authorSlug}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span className="font-semibold text-gray-700 hover:text-blue-600">{authorName}</span>
                  </button>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(post.created_at)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {estimateReadingTime(post.mazmun)} daqiqa o'qish
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  {(post.views || 0) + 1} ko'rishlar
                </span>
              </div>

              {/* Sarlavha */}
              <h1 className="text-2xl md:text-4xl font-black text-gray-900 mb-6 leading-tight">
                {post.sarlavha}
              </h1>

              {/* Matn */}
              <div
                className="text-gray-700 whitespace-pre-wrap"
                style={{ lineHeight: '1.75', maxWidth: '700px', fontSize: '15px' }}
              >
                {post.mazmun}
              </div>

              {/* Ulashish tugmalari */}
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-500 mr-1">Ulashish:</span>
                <button
                  onClick={handleTelegramShare}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-all"
                >
                  <Send className="h-3.5 w-3.5" /> Telegram
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-50 text-gray-600 text-xs font-bold hover:bg-gray-100 transition-all"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
                  {copied ? 'Nusxalandi' : 'Havolani nusxalash'}
                </button>
              </div>
            </div>
          </article>

          {/* O'xshash maqolalar */}
          {relatedPosts.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">O'xshash maqolalar</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {relatedPosts.map((rp) => (
                  <button
                    key={rp.id}
                    onClick={() => navigate(`/blog/${rp.slug}`)}
                    className="text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-300 group"
                  >
                    {rp.rasm_url && (
                      <div className="w-full h-28 overflow-hidden bg-gray-100">
                        <img
                          src={rp.rasm_url}
                          alt={rp.sarlavha}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 text-xs line-clamp-2 group-hover:text-blue-600 transition-colors mb-1">
                        {rp.sarlavha}
                      </h3>
                      <p className="text-[10px] text-gray-400">{formatDate(rp.created_at)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* O'NG USTUN — Muallif bloki */}
        {author && (
          <div className="lg:w-[30%] shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:sticky lg:top-4">
              <div
                className="cursor-pointer"
                onClick={() => authorSlug && navigate(`/blog/muallif/${authorSlug}`)}
              >
                {renderAvatar(author)}
                <h3 className="text-base font-bold text-gray-900 text-center mt-3 hover:text-blue-600 transition-colors">
                  {author.full_name}
                </h3>
                {author.note && author.note !== 'null' && (
                  <p className="text-xs text-gray-500 text-center mt-1 leading-relaxed">
                    {author.note}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                <p className="text-2xl font-black text-blue-600">{authorPostCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">ta maqola</p>
              </div>

              <button
                onClick={() => authorSlug && navigate(`/blog/muallif/${authorSlug}`)}
                className="w-full mt-4 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-all"
              >
                Barcha maqolalarini ko'rish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
