
import { useState, useEffect } from 'react';
import { Calendar, Search, BookOpen, Newspaper, Clock, Eye, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { setDocumentTitle, setMetaDescription, resetDocumentTitle, resetMetaDescription } from '@/lib/seo';
import { getInitials, estimateReadingTime, truncateText, formatDate, type AuthorInfo, isValidNote, gradientForTitle } from '@/lib/blogUtils';

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
  meta_description?: string | null;
  file_url?: string | null;
}

interface AuthorMap {
  [key: string]: AuthorInfo;
}

type TopicFilter = 'all' | 'huquq' | 'talim' | 'yangiliklar';

const TOPIC_LABELS: Record<TopicFilter, string> = {
  all: 'Barchasi',
  huquq: 'Huquq',
  talim: "Ta'lim",
  yangiliklar: 'Yangiliklar',
};

export default function BlogList() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [authorMap, setAuthorMap] = useState<AuthorMap>({});
  const [topicFilter, setTopicFilter] = useState<TopicFilter>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadPosts();
    return () => {
      resetDocumentTitle();
      resetMetaDescription();
    };
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

      const ustozIds = [...new Set((data || []).map(p => p.ustoz_id).filter(Boolean))] as string[];
      if (ustozIds.length > 0) {
        const { data: authors } = await supabase
          .from('ustoz')
          .select('id, full_name, muallif_slug, face_photo_url, note')
          .in('id', ustozIds);
        if (authors) {
          const map: AuthorMap = {};
          authors.forEach(a => { map[a.id] = a; });
          setAuthorMap(map);
        }
      }

      setDocumentTitle('Blog — FanFaster');
      setMetaDescription("FanFaster blogida huquq sohasidagi maqolalar va nashrlar. Ustozlar tomonidan yozilgan professional maqolalar.");
    } catch (err) {
      console.error('Blog yuklash xatosi:', err);
      toast({ title: 'Xatolik', description: "Blog postlarni yuklab bo'lmadi", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorClick = (e: React.MouseEvent, ustozId: string | null) => {
    e.stopPropagation();
    if (!ustozId) return;
    const a = authorMap[ustozId];
    if (a?.muallif_slug) navigate(`/blog/muallif/${a.muallif_slug}`);
  };

  const filteredPosts = posts.filter(p => {
    const matchesSearch =
      p.sarlavha.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mazmun.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.ustoz_ismi.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (topicFilter === 'all') return true;
    // Simple keyword-based topic detection
    const text = (p.sarlavha + ' ' + p.mazmun).toLowerCase();
    if (topicFilter === 'huquq') return text.includes('huquq') || text.includes('shartnoma') || text.includes('sud') || text.includes('qonun');
    if (topicFilter === 'talim') return text.includes("ta'lim") || text.includes('o\'qit') || text.includes('kurs') || text.includes('dars');
    if (topicFilter === 'yangiliklar') return text.includes('yangilik') || text.includes('o\'zgarish') || text.includes('yangi');
    return true;
  });

  const featuredPost = filteredPosts[0];
  const restPosts = filteredPosts.slice(1);

  const renderAvatar = (author: AuthorInfo | undefined, size: string = 'w-8 h-8 text-[10px]') => {
    if (author?.face_photo_url) {
      return (
        <img
          src={author.face_photo_url}
          alt={author.full_name}
          className={`${size} rounded-full object-cover shrink-0`}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }
    const name = author?.full_name || '?';
    return (
      <div className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold shrink-0`}>
        {getInitials(name)}
      </div>
    );
  };

  const renderCoverImage = (post: BlogPost, height: string, rounded: string = '') => {
    const gradient = gradientForTitle(post.sarlavha);
    if (post.rasm_url) {
      return (
        <div className={`w-full ${height} overflow-hidden bg-gray-100 ${rounded}`}>
          <img
            src={post.rasm_url}
            alt={post.sarlavha}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent) parent.className = `w-full ${height} bg-gradient-to-br ${gradient} ${rounded} flex items-center justify-center`;
            }}
          />
        </div>
      );
    }
    return (
      <div className={`w-full ${height} bg-gradient-to-br ${gradient} ${rounded} flex items-center justify-center overflow-hidden`}>
        <span className="text-white/25 text-5xl font-black select-none">
          {post.sarlavha.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Newspaper className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">FanFaster Blog</h1>
            <p className="text-sm text-gray-500 mt-0.5">FanFaster ustozlaridan bilim va tajriba</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Maqola qidirish..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        />
      </div>

      {/* Topic filters */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {(Object.keys(TOPIC_LABELS) as TopicFilter[]).map((topic) => (
          <button
            key={topic}
            onClick={() => setTopicFilter(topic)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              topicFilter === topic
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {TOPIC_LABELS[topic]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">Yuklanmoqda...</p>
        </div>
      )}

      {/* Empty state */}
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

      {/* Featured post + grid */}
      {!loading && filteredPosts.length > 0 && (
        <div className="space-y-8">
          {/* Featured (latest) post */}
          {featuredPost && (
            <button
              onClick={() => navigate(`/blog/${featuredPost.slug}`)}
              className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-300 group flex flex-col md:flex-row"
            >
              <div className="md:w-1/2">
                {renderCoverImage(featuredPost, 'h-56 md:h-full')}
              </div>
              <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wide">
                    <Newspaper className="h-2.5 w-2.5" /> Tavsiya etiladi
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                  {featuredPost.sarlavha}
                </h2>
                <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed mb-4">
                  {truncateText(featuredPost.meta_description || featuredPost.mazmun, 240)}
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => handleAuthorClick(e, featuredPost.ustoz_id)}
                  >
                    {renderAvatar(featuredPost.ustoz_id ? authorMap[featuredPost.ustoz_id] : undefined)}
                    <span className="text-xs font-semibold text-gray-700 hover:text-blue-600 transition-colors">
                      {featuredPost.ustoz_ismi || authorMap[featuredPost.ustoz_id || '']?.full_name || 'Noma\'lum'}
                    </span>
                  </div>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Calendar className="h-3 w-3" />
                    {formatDate(featuredPost.created_at)}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock className="h-3 w-3" />
                    {estimateReadingTime(featuredPost.mazmun)} daqiqa
                  </span>
                </div>
              </div>
            </button>
          )}

          {/* Grid of remaining posts */}
          {restPosts.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {restPosts.map((post) => {
                const author = post.ustoz_id ? authorMap[post.ustoz_id] : undefined;
                return (
                  <button
                    key={post.id}
                    onClick={() => navigate(`/blog/${post.slug}`)}
                    className="text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 group flex flex-col"
                  >
                    {renderCoverImage(post, 'h-44')}
                    <div className="p-5 flex flex-col flex-1">
                      {/* Author + date */}
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => handleAuthorClick(e, post.ustoz_id)}
                        >
                          {renderAvatar(author)}
                          <span className="text-xs font-semibold text-gray-700 hover:text-blue-600 transition-colors">
                            {post.ustoz_ismi || author?.full_name || 'Noma\'lum'}
                          </span>
                        </div>
                        <span className="text-gray-300">·</span>
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Calendar className="h-3 w-3" />
                          {formatDate(post.created_at)}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors text-sm">
                        {post.sarlavha}
                      </h3>

                      {/* Excerpt */}
                      <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed flex-1">
                        {truncateText(post.meta_description || post.mazmun, 180)}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400">
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
      )}
    </div>
  );
}
