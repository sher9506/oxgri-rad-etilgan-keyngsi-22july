
import { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, User, ArrowLeft, BookOpen, Clock, Eye, Send, Link2, Check, Heart, Phone, MessageCircle, ChevronRight, Download, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setDocumentTitle, setMetaDescription, setJsonLd, removeJsonLd, resetDocumentTitle, resetMetaDescription } from '@/lib/seo';
import { getInitials, estimateReadingTime, formatDate, type AuthorInfo, extractErrorMessage, isValidNote, gradientForTitle } from '@/lib/blogUtils';

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
  file_url?: string | null;
  meta_description?: string | null;
}

interface RelatedPost {
  id: string;
  slug: string;
  sarlavha: string;
  mazmun: string;
  rasm_url: string | null;
  created_at: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
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
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [helpfulVote, setHelpfulVote] = useState<'yes' | 'no' | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeTocId, setActiveTocId] = useState<string>('');
  const articleRef = useRef<HTMLDivElement>(null);

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

  // Reading progress + TOC scroll tracking
  useEffect(() => {
    if (!post) return;

    const handleScroll = () => {
      const article = articleRef.current;
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const articleTop = rect.top + window.scrollY;
      const articleHeight = rect.height;
      const scrollPos = window.scrollY - articleTop;
      const progress = Math.min(100, Math.max(0, (scrollPos / articleHeight) * 100));
      setReadingProgress(progress);

      // Track active TOC heading
      if (tocItems.length > 0) {
        let current = '';
        for (const item of tocItems) {
          const el = document.getElementById(item.id);
          if (el) {
            const elRect = el.getBoundingClientRect();
            if (elRect.top < 120) {
              current = item.id;
            }
          }
        }
        if (current) setActiveTocId(current);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [post, tocItems]);

  // Parse TOC from article content
  useEffect(() => {
    if (!post) return;
    const article = articleRef.current;
    if (!article) return;

    const headings = article.querySelectorAll('h2, h3');
    const items: TocItem[] = [];
    headings.forEach((h, i) => {
      const text = h.textContent || '';
      const id = `heading-${i}`;
      h.id = id;
      items.push({ id, text, level: h.tagName === 'H2' ? 2 : 3 });
    });
    setTocItems(items);
  }, [post]);

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

      // Load like count from localStorage as simple client-side counter
      const storedLikes = localStorage.getItem(`blog-likes-${data.id}`);
      setLikeCount(storedLikes ? parseInt(storedLikes) : 0);
      const storedLiked = localStorage.getItem(`blog-liked-${data.id}`);
      if (storedLiked === 'true') setLiked(true);
      const storedHelpful = localStorage.getItem(`blog-helpful-${data.id}`);
      if (storedHelpful) setHelpfulVote(storedHelpful as 'yes' | 'no');

      // Server-side view increment via SECURITY DEFINER function
      supabase.rpc('increment_blog_views', { p_slug: slugParam }).then(() => {});

      let authorData: AuthorInfo | null = null;

      if (data.ustoz_id) {
        const { data: aData } = await supabase
          .from('ustoz')
          .select('id, muallif_slug, full_name, face_photo_url, note, telegram_username, phone, telegram_public, phone_public')
          .eq('id', data.ustoz_id)
          .maybeSingle();
        if (aData) {
          authorData = aData as AuthorInfo;
          setAuthor(authorData);

          const { count } = await supabase
            .from('blog_posts')
            .select('*', { count: 'exact', head: true })
            .eq('ustoz_id', data.ustoz_id)
            .eq('status', 'published');
          setAuthorPostCount(count || 0);

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
      setMetaDescription(data.meta_description || data.mazmun.slice(0, 160));

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

  const handleLike = () => {
    if (!post) return;
    if (liked) {
      setLiked(false);
      setLikeCount(c => c - 1);
      localStorage.setItem(`blog-likes-${post.id}`, String(likeCount - 1));
      localStorage.setItem(`blog-liked-${post.id}`, 'false');
    } else {
      setLiked(true);
      setLikeCount(c => c + 1);
      localStorage.setItem(`blog-likes-${post.id}`, String(likeCount + 1));
      localStorage.setItem(`blog-liked-${post.id}`, 'true');
    }
  };

  const handleHelpful = (vote: 'yes' | 'no') => {
    if (!post) return;
    setHelpfulVote(vote);
    localStorage.setItem(`blog-helpful-${post.id}`, vote);
  };

  const scrollToTocItem = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
    }
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
  const gradient = gradientForTitle(post.sarlavha);
  const wordCount = post.mazmun.trim().split(/\s+/).length;
  const hasToc = wordCount >= 500 && tocItems.length >= 2;
  const showTelegram = author?.telegram_public && author?.telegram_username && author.telegram_username.trim() !== '';
  const showPhone = author?.phone_public && author?.phone && author.phone.trim() !== '';

  return (
    <>
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-100">
        <div
          className="h-full bg-blue-600 transition-all duration-150 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 mb-6 text-xs text-gray-400">
          <button onClick={() => navigate('/blog')} className="hover:text-blue-600 transition-colors font-medium">
            Blog
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-gray-600 font-medium truncate max-w-[200px]">{post.sarlavha}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* MAIN COLUMN */}
          <div className="flex-1 lg:max-w-[calc(70%-16px)]">
            <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Cover image or gradient */}
              <div className="w-full h-64 md:h-96 overflow-hidden relative">
                {post.rasm_url ? (
                  <img
                    src={post.rasm_url}
                    alt={post.sarlavha}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) parent.className = `w-full h-64 md:h-96 bg-gradient-to-br ${gradient}`;
                    }}
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <div className="text-white/90 text-6xl font-black opacity-20 select-none">
                      {post.sarlavha.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 md:p-10">
                {/* Tag / category pill */}
                <button
                  onClick={() => navigate('/blog')}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-bold mb-5 hover:bg-blue-100 transition-colors"
                >
                  <BookOpen className="h-3 w-3" />
                  Huquq
                </button>

                {/* Title */}
                <h1
                  className="text-3xl md:text-[40px] font-extrabold text-gray-900 mb-6 leading-[1.15] tracking-tight"
                >
                  {post.sarlavha}
                </h1>

                {/* Byline — enhanced */}
                <div className="flex items-center gap-3 pb-6 mb-6 border-b border-gray-100">
                  {author && (
                    <button
                      onClick={() => authorSlug && navigate(`/blog/muallif/${authorSlug}`)}
                      className="flex items-center gap-2.5 group"
                      disabled={!authorSlug}
                    >
                      {renderAvatar(author, 'w-10 h-10 text-sm')}
                    </button>
                  )}
                  <div className="flex-1">
                    {authorName && (
                      <button
                        onClick={() => authorSlug && navigate(`/blog/muallif/${authorSlug}`)}
                        className="block text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors text-left"
                      >
                        {authorName}
                      </button>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(post.created_at)}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {estimateReadingTime(post.mazmun)} daqiqa o'qish
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {(post.views || 0) + 1}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Article content */}
                <div
                  ref={articleRef}
                  className="prose-content text-gray-700"
                  style={{ maxWidth: '720px' }}
                >
                  <div
                    className="rich-content"
                    style={{ fontSize: '18px', lineHeight: '1.8', marginBottom: '1.5em' }}
                    dangerouslySetInnerHTML={{ __html: post.mazmun }}
                  />
                </div>

                {/* Download original file */}
                {post.file_url && (
                  <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-bold text-gray-700">Asl fayl</span>
                    </div>
                    <a
                      href={post.file_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Yuklab olish
                    </a>
                  </div>
                )}

                {/* Like + Share bar */}
                <div className="flex items-center gap-3 mt-10 pt-6 border-t border-gray-100">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      liked
                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
                    {likeCount > 0 ? likeCount : 'Foydali'}
                  </button>

                  <div className="h-6 w-px bg-gray-200" />

                  <span className="text-xs font-bold text-gray-400">Ulashish:</span>
                  <button
                    onClick={handleTelegramShare}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-all"
                  >
                    <Send className="h-3.5 w-3.5" /> Telegram
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-50 text-gray-600 text-xs font-bold hover:bg-gray-100 transition-all"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
                    {copied ? 'Nusxalandi' : 'Havola'}
                  </button>
                </div>

                {/* Helpful survey */}
                <div className="mt-8 p-5 bg-gray-50 rounded-xl text-center">
                  {helpfulVote ? (
                    <p className="text-sm text-gray-500 font-medium">
                      {helpfulVote === 'yes' ? 'Rahmat! Fikringiz uchun minnatdormiz.' : 'Rahmat! Yaxshilashga harakat qilamiz.'}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-gray-700 mb-3">Ushbu maqola foydali bo'ldimi?</p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleHelpful('yes')}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-all"
                        >
                          <Heart className="h-4 w-4" /> Ha, foydali
                        </button>
                        <button
                          onClick={() => handleHelpful('no')}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:border-gray-300 transition-all"
                        >
                          Yo'q
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </article>

            {/* Related articles */}
            {relatedPosts.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-bold text-gray-900 mb-5">O'xshash maqolalar</h2>
                <div className="grid gap-5 sm:grid-cols-3">
                  {relatedPosts.map((rp) => {
                    const rpGradient = gradientForTitle(rp.sarlavha);
                    return (
                      <button
                        key={rp.id}
                        onClick={() => navigate(`/blog/${rp.slug}`)}
                        className="text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-300 group"
                      >
                        <div className="w-full h-32 overflow-hidden bg-gray-100">
                          {rp.rasm_url ? (
                            <img
                              src={rp.rasm_url}
                              alt={rp.sarlavha}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent) parent.className = `w-full h-32 bg-gradient-to-br ${rpGradient}`;
                              }}
                            />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${rpGradient} flex items-center justify-center`}>
                              <span className="text-white/30 text-3xl font-black select-none">
                                {rp.sarlavha.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-gray-900 text-sm line-clamp-2 group-hover:text-blue-600 transition-colors mb-1">
                            {rp.sarlavha}
                          </h3>
                          <p className="text-[11px] text-gray-400">{formatDate(rp.created_at)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — Author block + TOC */}
          <div className="lg:w-[30%] shrink-0">
            <div className="lg:sticky lg:top-8 space-y-4" style={{ maxHeight: 'calc(100vh - 4rem)', overflowY: 'auto' }}>
              {/* TOC for long articles */}
              {hasToc && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h4 className="text-xs font-black text-gray-900 mb-3 uppercase tracking-wide">Mundarija</h4>
                  <nav className="space-y-1">
                    {tocItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => scrollToTocItem(item.id)}
                        className={`block text-left text-xs leading-relaxed transition-colors w-full ${
                          activeTocId === item.id
                            ? 'text-blue-600 font-bold'
                            : 'text-gray-500 hover:text-blue-600'
                        } ${item.level === 3 ? 'pl-4' : ''}`}
                      >
                        {item.text}
                      </button>
                    ))}
                  </nav>
                </div>
              )}

              {/* Author block */}
              {author && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div
                    className="cursor-pointer"
                    onClick={() => authorSlug && navigate(`/blog/muallif/${authorSlug}`)}
                  >
                    {renderAvatar(author)}
                    <h3 className="text-base font-bold text-gray-900 text-center mt-3 hover:text-blue-600 transition-colors">
                      {author.full_name}
                    </h3>
                    {isValidNote(author.note) && (
                      <p className="text-xs text-gray-500 text-center mt-1 leading-relaxed">
                        {author.note}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                    <p className="text-2xl font-black text-blue-600">{authorPostCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">ta maqola</p>
                  </div>

                  {/* Telegram / Phone contact buttons */}
                  {(showTelegram || showPhone) && (
                    <div className="mt-4 space-y-2">
                      {showTelegram && (
                        <a
                          href={`https://t.me/${author!.telegram_username!.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-all"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Telegram orqali bog'lanish
                        </a>
                      )}
                      {showPhone && (
                        <a
                          href={`tel:${author!.phone!.replace(/\s+/g, '')}`}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-50 text-green-600 text-xs font-bold hover:bg-green-100 transition-all"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {author!.phone}
                        </a>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => authorSlug && navigate(`/blog/muallif/${authorSlug}`)}
                    className="w-full mt-4 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-all"
                  >
                    Barcha maqolalarini ko'rish
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
