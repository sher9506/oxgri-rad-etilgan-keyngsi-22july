
import { useState, useEffect } from 'react';
import { Calendar, User, ArrowLeft, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setDocumentTitle, setMetaDescription, resetDocumentTitle, resetMetaDescription } from '@/lib/seo';

interface BlogPost {
  id: string;
  ustoz_ismi: string;
  sarlavha: string;
  mazmun: string;
  rasm_url: string | null;
  status: string;
  slug: string;
  created_at: string;
}

interface AuthorInfo {
  full_name: string;
  muallif_slug: string;
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
    try {
      const { data: authorData, error: authorError } = await supabase
        .from('ustoz')
        .select('full_name, muallif_slug')
        .eq('muallif_slug', slug)
        .maybeSingle();

      if (authorError) throw authorError;
      if (!authorData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setAuthor(authorData);
      setDocumentTitle(`${authorData.full_name} — FanFaster`);
      setMetaDescription(`${authorData.full_name} tomonidan yozilgan maqolalar va nashrlar FanFaster platformasida`);

      const { data: postData, error: postError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('ustoz_ismi', authorData.full_name)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (postError) throw postError;
      setPosts(postData || []);
    } catch (err) {
      console.error('Muallif sahifasi xatosi:', err);
      const msg = err instanceof Error ? err.message : "Muallif sahifasini yuklab bo'lmadi";
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

  if (notFound || (!author && !error)) {
    return (
      <div className="max-w-4xl mx-auto">
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
          <p className="text-sm font-bold text-gray-400 mb-1">Muallif topilmadi</p>
          <p className="text-xs text-gray-400">Bu muallif mavjud emas yoki o'chirilgan bo'lishi mumkin</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
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

  if (!author) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/blog')}
        className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all"
      >
        <ArrowLeft className="h-4 w-4" />
        Blog ro'yxatiga qaytish
      </button>

      {/* Muallif sarlavhasi */}
      <div className="mb-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <User className="h-7 w-7 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">{author.full_name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">FanFaster muallifi</p>
          </div>
        </div>
      </div>

      {/* Postlar */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">Hozircha maqolalar yo'q</p>
          <p className="text-xs text-gray-400">Bu muallif hali nashr etilgan maqolalarga ega emas</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => navigate(`/blog/${post.slug}`)}
              className="text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group"
            >
              {post.rasm_url && (
                <div className="w-full h-40 overflow-hidden bg-gray-100">
                  <img
                    src={post.rasm_url}
                    alt={post.sarlavha}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(post.created_at)}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {post.sarlavha}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">
                  {post.mazmun}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
