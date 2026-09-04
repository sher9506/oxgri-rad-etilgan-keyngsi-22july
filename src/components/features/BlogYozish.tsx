
import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Eye, EyeOff, Save, X, Calendar, Newspaper, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

type EditMode = 'list' | 'edit';

export default function BlogYozish() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EditMode>('list');
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  // Form state
  const [sarlavha, setSarlavha] = useState('');
  const [mazmun, setMazmun] = useState('');
  const [rasmUrl, setRasmUrl] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('ustoz_id', user?.ustoz_id || '')
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

  const resetForm = () => {
    setSarlavha('');
    setMazmun('');
    setRasmUrl('');
    setStatus('published');
    setEditingPost(null);
  };

  const startNew = () => {
    resetForm();
    setMode('edit');
  };

  const startEdit = (post: BlogPost) => {
    setEditingPost(post);
    setSarlavha(post.sarlavha);
    setMazmun(post.mazmun);
    setRasmUrl(post.rasm_url || '');
    setStatus(post.status as 'draft' | 'published');
    setMode('edit');
  };

  const cancelEdit = () => {
    resetForm();
    setMode('list');
  };

  const handleSave = async () => {
    if (!sarlavha.trim()) {
      toast({ title: 'Ogohlantirish', description: 'Sarlavha bo\'sh bo\'lishi mumkin emas', variant: 'destructive' });
      return;
    }
    if (!mazmun.trim()) {
      toast({ title: 'Ogohlantirish', description: 'Matn bo\'sh bo\'lishi mumkin emas', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const ustozIsmi = `${user?.ism || ''} ${user?.familiya || ''}`.trim();

      if (editingPost) {
        // Yangilash
        const { error } = await supabase
          .from('blog_posts')
          .update({
            sarlavha: sarlavha.trim(),
            mazmun: mazmun.trim(),
            rasm_url: rasmUrl.trim() || null,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPost.id);

        if (error) throw error;
        toast({ title: 'Saqlandi', description: 'Blog post yangilandi' });
      } else {
        // Yangi post
        const { error } = await supabase
          .from('blog_posts')
          .insert({
            ustoz_id: user?.ustoz_id || null,
            ustoz_ismi: ustozIsmi,
            sarlavha: sarlavha.trim(),
            mazmun: mazmun.trim(),
            rasm_url: rasmUrl.trim() || null,
            status,
          });

        if (error) throw error;
        toast({ title: 'Yaratildi', description: 'Yangi blog post qo\'shildi' });
      }

      resetForm();
      setMode('list');
      loadPosts();
    } catch (err) {
      console.error('Saqlash xatosi:', err);
      toast({
        title: 'Xatolik',
        description: 'Blog postni saqlab bo\'lmadi',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (!confirm('Bu blog postni o\'chirishni istaysizmi?')) return;

    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;
      toast({ title: "O'chirildi", description: 'Blog post o\'chirildi' });
      loadPosts();
    } catch (err) {
      console.error("O'chirish xatosi:", err);
      toast({
        title: 'Xatolik',
        description: "Blog postni o'chirib bo'lmadi",
        variant: 'destructive',
      });
    }
  };

  const toggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      const { error } = await supabase
        .from('blog_posts')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', post.id);

      if (error) throw error;
      toast({
        title: 'Yangilandi',
        description: newStatus === 'published' ? 'Post nashr etildi' : 'Post qoralamaga o\'tkazildi',
      });
      loadPosts();
    } catch (err) {
      console.error('Status xatosi:', err);
      toast({ title: 'Xatolik', description: 'Statusni o\'zgartirib bo\'lmadi', variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ── Tahrir ko'rinish ─────────────────────────────────────────────────────────
  if (mode === 'edit') {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900">
                {editingPost ? 'Postni tahrirlash' : 'Yangi blog post'}
              </h1>
              <p className="text-xs text-gray-500">Maqola yozing va nashr eting</p>
            </div>
          </div>
          <button
            onClick={cancelEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="h-3.5 w-3.5" />
            Bekor qilish
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          {/* Sarlavha */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Sarlavha</label>
            <input
              type="text"
              value={sarlavha}
              onChange={(e) => setSarlavha(e.target.value)}
              placeholder="Maqola sarlavhasini kiriting..."
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Rasm URL */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Rasm URL <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
            </label>
            <input
              type="text"
              value={rasmUrl}
              onChange={(e) => setRasmUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
            {rasmUrl && (
              <div className="mt-2 w-full h-32 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                <img
                  src={rasmUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          {/* Matn */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Matn</label>
            <textarea
              value={mazmun}
              onChange={(e) => setMazmun(e.target.value)}
              placeholder="Maqola matnini shu yerga yozing..."
              rows={12}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all resize-y leading-relaxed"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">Holat</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus('published')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  status === 'published'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Nashr etish
              </button>
              <button
                onClick={() => setStatus('draft')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  status === 'draft'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <EyeOff className="h-3.5 w-3.5" />
                Qoralama
              </button>
            </div>
          </div>

          {/* Saqlash tugmasi */}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saqlanmoqda...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {editingPost ? 'Yangilash' : 'Saqlash'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Ro'yxat ko'rinish ────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <Newspaper className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900">Blog postlarim</h1>
            <p className="text-xs text-gray-500">O'z maqolalaringizni boshqaring</p>
          </div>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          Yangi post
        </button>
      </div>

      {/* Yuklanmoqda */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">Yuklanmoqda...</p>
        </div>
      )}

      {/* Bo'sh holat */}
      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Newspaper className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-400 mb-1">Hozircha postlar yo'q</p>
          <p className="text-xs text-gray-400 mb-4">"Yangi post" tugmasini bosing va birinchi maqolangizni yozing</p>
          <button
            onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Birinchi postni yozish
          </button>
        </div>
      )}

      {/* Postlar ro'yxati */}
      {!loading && posts.length > 0 && (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                      post.status === 'published'
                        ? 'bg-green-50 text-green-600 border border-green-100'
                        : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {post.status === 'published' ? (
                        <><Eye className="h-2.5 w-2.5" /> Nashr etilgan</>
                      ) : (
                        <><EyeOff className="h-2.5 w-2.5" /> Qoralama</>
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Calendar className="h-2.5 w-2.5" />
                      {formatDate(post.created_at)}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{post.sarlavha}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{post.mazmun}</p>
                </div>

                {/* Aksiyalar */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleStatus(post)}
                    title={post.status === 'published' ? "Qoralamaga o'tkazish" : 'Nashr etish'}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
                  >
                    {post.status === 'published' ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(post)}
                    title="Tahrirlash"
                    className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-all"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(post)}
                    title="O'chirish"
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
