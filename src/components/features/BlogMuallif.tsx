import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Bookmark,
  Calendar,
  ChevronDown,
  Clock3,
  Eye,
  Flame,
  Link2,
  MapPin,
  MessageCircle,
  Newspaper,
  Phone,
  Scale,
  Search,
  Send,
  UserPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  setDocumentTitle,
  setMetaDescription,
  setJsonLd,
  removeJsonLd,
  resetDocumentTitle,
  resetMetaDescription,
} from '@/lib/seo';
import {
  getInitials,
  estimateReadingTime,
  truncateText,
  formatDate,
  type AuthorInfo,
  extractErrorMessage,
  isValidNote,
  gradientForTitle,
} from '@/lib/blogUtils';

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

type FeedFilter = 'all' | 'articles' | 'analysis' | 'reviews';

const feedFilters: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'Barchasi' },
  { id: 'articles', label: 'Maqolalar' },
  { id: 'analysis', label: 'Tahlillar' },
  { id: 'reviews', label: 'Sharhlar' },
];

const recommendedTopics = [
  'Konstitutsiyaviy huquq',
  'Jinoyat protsessi',
  'Fuqarolik huquqi',
  'Mehnat huquqi',
  'Raqobat huquqi',
  'Xalqaro huquq',
];

function getBrowserId(): string {
  const KEY = 'ff_browser_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = 'browser_' + crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

function getPostLabel(post: BlogPost): 'Maqola' | 'Tahlil' | 'Sharh' {
  const text = `${post.sarlavha} ${post.mazmun}`.toLowerCase();
  if (text.includes('tahlil') || text.includes('tahlili')) return 'Tahlil';
  if (text.includes('sharh') || text.includes('izoh')) return 'Sharh';
  return 'Maqola';
}

export default function BlogMuallif({ muallif_slug: slugProp }: { muallif_slug?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const muallif_slug = slugProp;
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [obunaCount, setObunaCount] = useState(0);
  const [obunaBorgan, setObunaBorgan] = useState(false);
  const [obunaLoading, setObunaLoading] = useState(false);

  useEffect(() => {
    if (!muallif_slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    loadAuthorAndPosts(muallif_slug);
    return () => {
      removeJsonLd('muallif-jsonld');
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
        .select('id, full_name, muallif_slug, face_photo_url, note, telegram_username, phone, telegram_public, phone_public, mutaxassislik')
        .eq('muallif_slug', slug)
        .maybeSingle();

      if (authorError) throw authorError;
      if (!authorData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const aInfo: AuthorInfo = authorData as AuthorInfo;
      const { data: postData, error: postError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('ustoz_id', authorData.id || '')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (postError) throw postError;
      setAuthor(aInfo);
      setPosts(postData || []);

      // Obuna holatini va sonini yuklash
      if (aInfo.id) {
        const { count } = await supabase
          .from('blog_obuna')
          .select('*', { count: 'exact', head: true })
          .eq('ustoz_id', aInfo.id);
        setObunaCount(count || 0);

        const followerId = user?.ustoz_id || getBrowserId();
        const { data: existing } = await supabase
          .from('blog_obuna')
          .select('id')
          .eq('ustoz_id', aInfo.id)
          .eq('obuna_ustoz_id', followerId)
          .maybeSingle();
        setObunaBorgan(!!existing);
      }
      setDocumentTitle(`${aInfo.full_name} — FanFaster ustozi | Barcha maqolalar`);
      const notePart = isValidNote(aInfo.note) ? aInfo.note! : '';
      setMetaDescription(
        truncateText(
          `${aInfo.full_name}ning FanFaster platformasidagi maqolalari. ${postData?.length ?? 0} ta maqola${notePart ? `, ${notePart}` : ''}`,
          160,
        ),
      );
      const pageUrl = `https://fanfaster.uz/blog/muallif/${aInfo.muallif_slug}`;
      setJsonLd(
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          '@id': `${pageUrl}#person`,
          name: aInfo.full_name,
          url: pageUrl,
          ...(notePart ? { description: notePart } : {}),
          ...(aInfo.face_photo_url
            ? {
                image: {
                  '@type': 'ImageObject',
                  url: aInfo.face_photo_url,
                  contentUrl: aInfo.face_photo_url,
                  caption: `${aInfo.full_name} — FanFaster muallifi`,
                },
              }
            : {}),
        },
        'muallif-jsonld',
      );
    } catch (err) {
      console.error('Muallif sahifasi xatosi:', err);
      setError(extractErrorMessage(err, "Muallif sahifasini yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesSearch = !query || `${post.sarlavha} ${post.mazmun}`.toLowerCase().includes(query);
      const label = getPostLabel(post);
      const matchesFilter = activeFilter === 'all'
        || (activeFilter === 'articles' && label === 'Maqola')
        || (activeFilter === 'analysis' && label === 'Tahlil')
        || (activeFilter === 'reviews' && label === 'Sharh');
      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, posts, searchQuery]);

  const toggleObuna = async () => {
    if (!author?.id) return;
    const followerId = user?.ustoz_id || getBrowserId();
    setObunaLoading(true);
    try {
      if (obunaBorgan) {
        await supabase
          .from('blog_obuna')
          .delete()
          .eq('ustoz_id', author.id)
          .eq('obuna_ustoz_id', followerId);
        setObunaBorgan(false);
        setObunaCount(c => Math.max(0, c - 1));
      } else {
        await supabase
          .from('blog_obuna')
          .insert({
            ustoz_id: author.id,
            obuna_ustoz_id: followerId,
            obuna_ismi: user?.ustoz_id ? `${user.ism || ''} ${user.familiya || ''}`.trim() || null : 'Mehmon',
          });
        setObunaBorgan(true);
        setObunaCount(c => c + 1);
      }
    } catch (err) {
      console.error('Obuna xatosi:', err);
      toast({ title: 'Xatolik', description: 'Kuzatish amalga oshmadi', variant: 'destructive' });
    } finally {
      setObunaLoading(false);
    }
  };

  const renderAvatar = (a: AuthorInfo | null, size: string = 'h-24 w-24 text-3xl') => {
    if (a?.face_photo_url) {
      return (
        <img
          src={a.face_photo_url}
          alt={a.full_name || ''}
          className={`${size} shrink-0 rounded-full object-cover`}
          onError={(event) => {
            (event.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 font-bold text-white`}>
        {getInitials(a?.full_name || '?')}
      </div>
    );
  };

  const renderPostCover = (post: BlogPost) => {
    const gradient = gradientForTitle(post.sarlavha);
    if (post.rasm_url) {
      return (
        <img
          src={post.rasm_url}
          alt={post.sarlavha}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(event) => {
            (event.target as HTMLImageElement).style.display = 'none';
            const parent = (event.target as HTMLImageElement).parentElement;
            if (parent) parent.className = `h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`;
          }}
        />
      );
    }
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient}`}>
        <span className="text-5xl font-black text-white/30">{post.sarlavha.charAt(0).toUpperCase()}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#f3f7ff] text-slate-500">
        <div className="mb-3 h-9 w-9 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="text-sm font-semibold">Yuklanmoqda...</p>
      </div>
    );
  }

  if (notFound || (!author && !error)) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#f3f7ff] p-6 text-center">
        <BookOpen className="mb-4 h-12 w-12 text-slate-300" />
        <p className="text-lg font-extrabold text-slate-800">Muallif topilmadi</p>
        <p className="mt-1 text-sm text-slate-500">Bu muallif mavjud emas yoki o‘chirilgan bo‘lishi mumkin.</p>
        <button onClick={() => navigate('/blog')} className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700">
          Blogga qaytish
        </button>
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#f3f7ff] p-6 text-center">
        <p className="text-lg font-extrabold text-red-500">Xatolik yuz berdi</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <button onClick={() => navigate('/blog')} className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700">
          Blogga qaytish
        </button>
      </div>
    );
  }

  const showTelegram = author.telegram_public && author.telegram_username && author.telegram_username.trim() !== '';
  const showPhone = author.phone_public && author.phone && author.phone.trim() !== '';
  const popularPosts = posts.slice(0, 3);

  return (
    <div className="min-h-full bg-[#f3f7ff] text-[#10245b]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-6 px-5 lg:px-9">
          <button onClick={() => navigate('/blog')} className="flex shrink-0 items-center gap-2.5 text-left" aria-label="FanFaster blog">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-200">
              <Scale className="h-5 w-5 text-white" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-[#10245b]">FanFaster</span>
          </button>
          <nav className="hidden items-center gap-7 text-[13px] font-bold text-slate-500 md:flex">
            <button onClick={() => navigate('/blog')} className="relative py-6 text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-blue-600">Maqolalar</button>
            <button onClick={() => navigate('/blog/mualliflar')} className="py-6 transition hover:text-blue-600">Mualliflar</button>
            <button onClick={() => navigate('/blog/mavzular')} className="py-6 transition hover:text-blue-600">Mavzular</button>
          </nav>
          <div className="relative ml-auto hidden max-w-[395px] flex-1 lg:block">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Maqola, muallif yoki mavzu qidirish..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-xs text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <button className="relative hidden h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 sm:flex" aria-label="Bildirishnomalar">
            <Bell className="h-[19px] w-[19px]" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-xs font-extrabold text-white shadow-md shadow-blue-200">AS</div>
          <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:px-9 lg:py-8">
        <aside className="h-fit rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_28px_rgba(31,75,140,0.06)] lg:sticky lg:top-24">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            {renderAvatar(author, 'h-[104px] w-[104px] text-3xl')}
            <h1 className="mt-4 text-xl font-extrabold leading-tight tracking-tight text-[#0e2155]">{author.full_name}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Huquqshunos / Muallif</p>
            {isValidNote(author.note) && <p className="mt-5 text-[13px] leading-6 text-slate-500">{author.note}</p>}
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span>FanFaster muallifi</span>
            </div>
          </div>

          {(showTelegram || showPhone) && (
            <div className="mt-5 flex gap-2">
              {showTelegram && (
                <a href={`https://t.me/${author.telegram_username!.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-bold text-blue-600 transition hover:bg-blue-100">
                  <Link2 className="h-4 w-4" /> Bog‘lanish
                </a>
              )}
              {showPhone && <a href={`tel:${author.phone!.replace(/\s+/g, '')}`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100" aria-label="Telefon orqali bog‘lanish"><Phone className="h-4 w-4" /></a>}
              {!showTelegram && showPhone && <span className="sr-only">{author.phone}</span>}
            </div>
          )}
          <button
            onClick={toggleObuna}
            disabled={obunaLoading}
            className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold shadow-lg transition disabled:opacity-50 ${
              obunaBorgan
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 shadow-gray-200'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 hover:shadow-blue-300'
            }`}
          >
            {obunaLoading ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : obunaBorgan ? (
              <>
                <Bell className="h-4 w-4" /> Kuzatilmoqda · {obunaCount}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> Kuzatish · {obunaCount}
              </>
            )}
          </button>

          <div className="mt-6 grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-4 text-center">
            <div><p className="text-base font-extrabold text-[#10245b]">{posts.length}</p><p className="mt-1 text-[10px] text-slate-400">Maqolalar</p></div>
            <div><p className="text-base font-extrabold text-[#10245b]">{posts.reduce((sum, post) => sum + (post.views || 0), 0) > 999 ? '1K+' : posts.reduce((sum, post) => sum + (post.views || 0), 0)}</p><p className="mt-1 text-[10px] text-slate-400">Ko‘rishlar</p></div>
            <div><p className="text-base font-extrabold text-[#10245b]">{new Set(posts.map((post) => getPostLabel(post))).size}</p><p className="mt-1 text-[10px] text-slate-400">Yo‘nalish</p></div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-xs font-extrabold text-[#10245b]">Mutaxassislik yo‘nalishlari</p>
            <div className="flex flex-wrap gap-2">
              {(author.mutaxassislik?.split(',').map((s) => s.trim()).filter(Boolean) || []).length > 0
                ? author.mutaxassislik!.split(',').map((s) => s.trim()).filter(Boolean).map((topic) => <span key={topic} className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-600">{topic}</span>)
                : <span className="text-[10px] text-slate-400">Ko'rsatilmagan</span>}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-6 py-6 shadow-[0_8px_28px_rgba(31,75,140,0.06)] sm:px-8">
            <div className="absolute -right-8 -top-12 h-40 w-40 rounded-[40px] bg-blue-50/80 rotate-45" />
            <div className="absolute right-10 top-2 h-28 w-14 rounded-2xl bg-blue-100/60 rotate-45" />
            <div className="relative flex items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:flex"><Scale className="h-6 w-6" /></div>
              <div>
                <h2 className="max-w-[480px] text-2xl font-extrabold leading-tight tracking-tight text-[#0e2155] sm:text-[25px]">{author.full_name}ning maqolalari</h2>
                <p className="mt-2 max-w-[580px] text-sm leading-6 text-slate-500">Huquq sohasiga oid ilmiy va amaliy maqolalar, tahlillar va sharhlar.</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500"><Newspaper className="h-4 w-4 text-blue-500" /> {posts.length} ta maqola</div>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_28px_rgba(31,75,140,0.05)]">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                {feedFilters.map((filter) => <button key={filter.id} onClick={() => setActiveFilter(filter.id)} className={`rounded-full px-4 py-2 text-[11px] font-extrabold transition ${activeFilter === filter.id ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}>{filter.label}</button>)}
              </div>
              <button className="flex items-center gap-2 self-start rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 sm:self-auto"><Clock3 className="h-3.5 w-3.5" /> Eng yangi <ChevronDown className="h-3.5 w-3.5" /></button>
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              {filteredPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center"><BookOpen className="mb-3 h-10 w-10 text-slate-300" /><p className="text-sm font-bold text-slate-500">Maqola topilmadi</p><p className="mt-1 text-xs text-slate-400">Boshqa qidiruv yoki bo‘limni tanlab ko‘ring.</p></div>
              ) : filteredPosts.map((post) => {
                const label = getPostLabel(post);
                return (
                  <button key={post.id} onClick={() => navigate(`/blog/${post.slug}`)} className="group flex w-full flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(43,98,220,0.10)] sm:flex-row sm:p-4">
                    <div className="h-44 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-[142px] sm:w-[142px]">{renderPostCover(post)}</div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${label === 'Tahlil' ? 'bg-violet-50 text-violet-600' : label === 'Sharh' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{label}</span>
                        <h3 className="mt-2 text-[15px] font-extrabold leading-6 text-[#10245b] transition group-hover:text-blue-600">{post.sarlavha}</h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{truncateText(post.meta_description || post.mazmun, 210)}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-400 sm:gap-3">
                        <span className="flex items-center gap-1"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[8px] font-extrabold text-white">{getInitials(author.full_name).slice(0, 2)}</span>{author.full_name}</span><span>·</span><span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(post.created_at)}</span><span>·</span><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {estimateReadingTime(post.mazmun)} daqiqa</span><span className="flex items-center gap-1 sm:ml-auto"><Eye className="h-3 w-3" /> {post.views || 0}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_rgba(31,75,140,0.06)]">
            <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500"><Flame className="h-5 w-5" /></div><div><h3 className="text-sm font-extrabold text-[#10245b]">Tavsiya etilgan mavzular</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">Siz uchun eng dolzarb va o‘qishga arzigulik mavzular</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2">{recommendedTopics.map((topic) => <button key={topic} onClick={() => setSearchQuery(topic)} className="rounded-full bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-600 transition hover:bg-blue-600 hover:text-white">{topic}</button>)}</div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_rgba(31,75,140,0.06)]">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-extrabold text-[#10245b]">O‘xshash maqolalar</h3><button onClick={() => setActiveFilter('all')} className="flex items-center gap-1 text-[11px] font-bold text-blue-600">Barchasi <ArrowRight className="h-3 w-3" /></button></div>
            <div className="divide-y divide-slate-100">{popularPosts.map((post) => <button key={post.id} onClick={() => navigate(`/blog/${post.slug}`)} className="group flex w-full gap-3 py-3 text-left first:pt-0 last:pb-0"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">{renderPostCover(post)}</div><div className="min-w-0"><p className="line-clamp-2 text-xs font-bold leading-5 text-[#10245b] group-hover:text-blue-600">{post.sarlavha}</p><p className="mt-1 text-[10px] text-slate-400">{formatDate(post.created_at)}</p></div><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-blue-500 opacity-0 transition group-hover:opacity-100" /></button>)}</div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-[0_8px_28px_rgba(31,75,140,0.06)]"><Bookmark className="h-6 w-6 text-blue-600" /><h3 className="mt-4 text-sm font-extrabold text-[#10245b]">Sizga qiziq bo‘lishi mumkin</h3><p className="mt-2 text-xs leading-5 text-slate-500">Bizning tavsiyalarimiz orqali yana ko‘plab foydali maqolalarni kashf eting.</p><button onClick={() => navigate('/blog')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-[11px] font-extrabold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700">Mashhur mavzularni ko‘rish <ArrowRight className="h-4 w-4" /></button></section>
        </aside>
      </div>
    </div>
  );
}
