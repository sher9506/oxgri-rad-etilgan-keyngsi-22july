
import { useState, useEffect } from 'react';
import { Calendar, User, ArrowLeft, Search, BookOpen, Newspaper } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface BlogPost {
  id: string;
  ustoz_ismi: string;
  sarlavha: string;
  mazmun: string;
  rasm_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function BlogList() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('Blog yuklash xatosi:', err);
      toast({
        title: 'Xatolik',
        description: "Blog postlarni yuklab bo'lmadi",
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const filteredPosts = posts.filter(p =>
    p.sarlavha.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.mazmun.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ustoz_ismi.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Batafsil ko'rinish ──────────────────────────────────────────────────────
  if (selectedPost) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => setSelectedPost(null)}
          className="flex items-center gap-2 mb-6 text-sm font-bold text-gray-500 hover:text-blue-600 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Orqaga
        </button>

        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {selectedPost.rasm_url && (
            <div className="w-full h-64 overflow-hidden bg-gray-100">
              <img
                src={selectedPost.rasm_url}
                alt={selectedPost.sarlavha}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span className="font-semibold text-gray-700">{selectedPost.ustoz_ismi}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(selectedPost.created_at)}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-4 leading-tight">
              {selectedPost.sarlavha}
            </h1>

            <div className="prose prose-sm md:prose-base max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {selectedPost.mazmun}
            </div>
          </div>
        </article>
      </div>
    );
  }

  // ── Ro'yxat ko'rinish ────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      {/* Sarlavha */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Newspaper className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Blog</h1>
            <p className="text-xs text-gray-500">Ustozlar tomonidan yozilgan maqolalar</p>
          </div>
        </div>
      </div>

      {/* Qidiruv */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Maqola qidirish..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        />
      </div>

      {/* Yuklanmoqda */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">Yuklanmoqda...</p>
        </div>
      )}

      {/* Bo'sh holat */}
      {!loading && filteredPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">
            {searchQuery ? 'Maqola topilmadi' : "Hozircha blog postlar yo'q"}
          </p>
          <p className="text-xs text-gray-400">
            {searchQuery ? "Boshqa kalit so'z bilan urinib ko'ring" : "Ustozlar maqola yozganda shu yerda ko'rinadi"}
          </p>
        </div>
      )}

      {/* Postlar ro'yxati */}
      {!loading && filteredPosts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredPosts.map((post) => (
            <button
              key={post.id}
              onClick={() => setSelectedPost(post)}
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
                    <User className="h-3 w-3" />
                    <span className="font-semibold text-gray-600">{post.ustoz_ismi}</span>
                  </span>
                  <span>·</span>
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
