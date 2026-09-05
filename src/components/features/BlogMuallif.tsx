
import { useState, useEffect } from 'react';
import { Calendar, ArrowLeft, BookOpen, Clock, Eye, Newspaper, MessageCircle, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setDocumentTitle, setMetaDescription, resetDocumentTitle, resetMetaDescription } from '@/lib/seo';
import { getInitials, estimateReadingTime, truncateText, formatDate, type AuthorInfo, extractErrorMessage, isValidNote, gradientForTitle } from '@/lib/blogUtils';

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
  meta_description?: string | null;
  file_url?: string | null;
}

export default function BlogMuallif({ muallif_slug: slugProp }: { muallif_slug?: string }) {
  const navigate = useNavigate();
  const muallif_slug = slugProp;
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!muallif_slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    loadAuthorAndPosts(muallif_slug);
    return () => {
      resetDocumentTitle();
      resetMetaDescription();
    };
  }, [muallif_slug]);

  const loadAuthorAndPosts = async (slug: string) => {
    setLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const { data: authorData, error: authorError } = await supabase
        .from('ustoz')
        .select('id, full_name, muallif_slug, face_photo_url, note, telegram_username, phone, telegram_public, phone_public')
        .eq('muallif_slug', slug)
        .maybeSingle();

      if (authorError) throw authorError;
      if (!authorData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const aInfo: AuthorInfo = authorData as AuthorInfo;
      setAuthor(aInfo);
      setDocumentTitle(`${aInfo.full_name} — FanFaster`);
      setMetaDescription(`${aInfo.full_name} tomonidan yozilgan maqolalar va nashrlar FanFaster platformasida`);

      const { data: postData, error: postError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('ustoz_id', authorData.id || '')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (postError) throw postError;
      setPosts(postData || []);
    } catch (err) {
      console.error('Muallif sahifasi xatosi:', err);
      setError(extractErrorMessage(err, "Muallif sahifasini yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  };

  const renderAvatar = (a: AuthorInfo | null, size: string = 'w-24 h-24 text-3xl') => {
    if (a?.face_photo_url) {
      return (
        <img
          src={a.face_photo_url}
          alt={a?.full_name || ''}
          className={`${size} rounded-full object-cover shrink-0`}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }
    const name = a?.full_name || '?';
    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold shrink-0`}>
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

  if (notFound || (!author && !error)) {
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/blog')} className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all">
          <ArrowLeft className="h-4 w-4" /> Blog ro'yxatiga qaytish
        </button>
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">Muallif topilmadi</p>
          <p className="text-xs text-gray-400">Bu muallif mavjud emas yoki o'chirilgan bo'lishi mumkin</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
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

  if (!author) return null;

  const showTelegram = author.telegram_public && author.telegram_username && author.telegram_username.trim() !== '';
  const showPhone = author.phone_public && author.phone && author.phone.trim() !== '';

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate('/blog')} className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all">
        <ArrowLeft className="h-4 w-4" /> Blog ro'yxatiga qaytish
      </button>

      {/* Author profile block — enhanced */}
      <div className="mb-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10">
        <div className="flex flex-col items-center text-center">
          {renderAvatar(author)}
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mt-4 tracking-tight">{author.full_name}</h1>
          {isValidNote(author.note) && (
            <p className="text-sm text-gray-500 mt-2 max-w-md leading-relaxed">{author.note}</p>
          )}
          <div className="mt-5 flex items-center gap-2">
            <div className="bg-blue-50 px-4 py-1.5 rounded-full">
              <span className="text-sm font-bold text-blue-600">{posts.length}</span>
              <span className="text-xs text-gray-500 ml-1">ta maqola</span>
            </div>
          </div>

          {/* Telegram / Phone contact buttons */}
          {(showTelegram || showPhone) && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {showTelegram && (
                <a
                  href={`https://t.me/${author.telegram_username!.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-all"
                >
                  <MessageCircle className="h-4 w-4" />
                  Telegram orqali bog'lanish
                </a>
              )}
              {showPhone && (
                <a
                  href={`tel:${author.phone!.replace(/\s+/g, '')}`}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-50 text-green-600 text-xs font-bold hover:bg-green-100 transition-all"
                >
                  <Phone className="h-4 w-4" />
                  {author.phone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">Hozircha maqolalar yo'q</p>
          <p className="text-xs text-gray-400">Bu muallif hali nashr etilgan maqolalarga ega emas</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const gradient = gradientForTitle(post.sarlavha);
            return (
              <button
                key={post.id}
                onClick={() => navigate(`/blog/${post.slug}`)}
                className="text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 group flex flex-col"
              >
                <div className="w-full h-44 overflow-hidden bg-gray-100">
                  {post.rasm_url ? (
                    <img
                      src={post.rasm_url}
                      alt={post.sarlavha}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) parent.className = `w-full h-44 bg-gradient-to-br ${gradient} flex items-center justify-center`;
                      }}
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                      <span className="text-white/25 text-4xl font-black select-none">
                        {post.sarlavha.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors text-sm">
                    {post.sarlavha}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed flex-1">
                    {truncateText(post.meta_description || post.mazmun, 180)}
                  </p>
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(post.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {estimateReadingTime(post.mazmun)} daqiqa
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {post.views || 0}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
