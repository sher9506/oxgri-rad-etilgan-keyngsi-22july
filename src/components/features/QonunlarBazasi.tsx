import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BookMarked, Plus, Search, Trash2, Link as LinkIcon, Loader2, FileText, ExternalLink, AlertCircle, CheckCircle2, X, Upload, ShieldAlert, Zap, RotateCw, ChevronDown, ChevronUp, FlaskConical, Cloud, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/App';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface QonunModda {
  id: string;
  kodeks_nomi: string;
  modda_raqami: string;
  modda_matni: string;
  manba_havola: string | null;
  oxirgi_yangilangan: string | null;
  yaratgan_ustoz_ismi: string | null;
  created_at: string;
  embedding_error?: string | null;
}

interface KodeksStatus {
  kodeks_nomi: string;
  total: number;
  vectorized: number;
  pending: number;
  errors: number;
}

export default function QonunlarBazasi() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<QonunModda[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kodeksFilter, setKodeksFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'manual' | 'url'>('url');
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Form state
  const [kodeksNomi, setKodeksNomi] = useState('');
  const [moddaRaqami, setModdaRaqami] = useState('');
  const [moddaMatni, setModdaMatni] = useState('');
  const [manbaHavola, setManbaHavola] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // URL fetch state
  const [urlInput, setUrlInput] = useState('');

  // Admin import state
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importOffset, setImportOffset] = useState(0);
  const [autoImport, setAutoImport] = useState(false);
  const [importProgress, setImportProgress] = useState<{ loaded: number; total: number; batches: number; errors: string[] } | null>(null);
  const [retrying429, setRetrying429] = useState(false);
  const { isAdmin } = useAdmin();
  const autoImportRef = useRef(false);
  const importUrlRef = useRef('');

  // Import holatini localStorage'ga saqlash — sahifa yangilansa ham davom ettirish mumkin
  const IMPORT_STORAGE_KEY = 'qonun_import_state';

  const saveImportState = useCallback((url: string, offset: number, total: number, loaded: number) => {
    try {
      localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify({ url, offset, total, loaded, ts: Date.now() }));
    } catch { /* ignore */ }
  }, []);

  const loadImportState = useCallback((): { url: string; offset: number; total: number; loaded: number; ts: number } | null => {
    try {
      const raw = localStorage.getItem(IMPORT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.url || !parsed.offset) return null;
      // 24 soatdan eski holatni e'tiborsiz qoldiramiz
      if (Date.now() - (parsed.ts || 0) > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(IMPORT_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch { return null; }
  }, []);

  const clearImportState = useCallback(() => {
    try { localStorage.removeItem(IMPORT_STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  // Sahifa yuklanganda import holatini tiklash
  useEffect(() => {
    const saved = loadImportState();
    if (saved && saved.offset > 0 && saved.loaded < saved.total) {
      setImportUrl(saved.url);
      setImportOffset(saved.offset);
      setImportProgress({ loaded: saved.loaded, total: saved.total, batches: 0, errors: [] });
      setImportResult({ done: false, remaining: saved.total - saved.loaded, kodeks_nomi: '', total_found: saved.total, db_written: 0, file_search_uploaded: 0, file_search_errors: 0, errors: [] });
    }
  }, [loadImportState]);

  // Vectorization state
  const [kodeksStatuses, setKodeksStatuses] = useState<KodeksStatus[]>([]);
  const [vectorizing, setVectorizing] = useState<string | null>(null); // kodeks_nomi being vectorized
  const [vectorizeProgress, setVectorizeProgress] = useState<{ processed: number; errors: number; remaining: number } | null>(null);
  const [errorArticles, setErrorArticles] = useState<QonunModda[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [retryingErrors, setRetryingErrors] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Constitution File Search state (izolyatsiyalangan sinov moduli)
  const [constStatus, setConstStatus] = useState<{ enabled: boolean; store_name: string | null; store_exists: boolean; articles_count: number } | null>(null);
  const [constSettingUp, setConstSettingUp] = useState(false);
  const [constToggling, setConstToggling] = useState(false);
  const [constQuery, setConstQuery] = useState('');
  const [constSearching, setConstSearching] = useState(false);
  const [constResult, setConstResult] = useState<{ answer: string; sources: string[] } | null>(null);

  const loadKodeksStatus = useCallback(async () => {
    const { data, error } = await supabase
      .from('qonun_moddalari')
      .select('kodeks_nomi, embedding, embedding_error');
    if (error || !data) return;

    const statusMap: Record<string, KodeksStatus> = {};
    for (const row of data) {
      const k = row.kodeks_nomi;
      if (!statusMap[k]) statusMap[k] = { kodeks_nomi: k, total: 0, vectorized: 0, pending: 0, errors: 0 };
      statusMap[k].total++;
      if (row.embedding) statusMap[k].vectorized++;
      else if (row.embedding_error) statusMap[k].errors++;
      else statusMap[k].pending++;
    }
    setKodeksStatuses(Object.values(statusMap).sort((a, b) => a.kodeks_nomi.localeCompare(b.kodeks_nomi)));

    // Also load errored articles
    const { data: errData } = await supabase
      .from('qonun_moddalari')
      .select('id, kodeks_nomi, modda_raqami, modda_matni, embedding_error')
      .not('embedding_error', 'is', null)
      .order('kodeks_nomi')
      .order('modda_raqami');
    setErrorArticles((errData || []) as QonunModda[]);
  }, []);

  const loadConstStatus = useCallback(async () => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/constitution-file-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ action: 'status' }),
      });
      const data = await res.json();
      if (!data.error) setConstStatus(data);
    } catch { /* ignore */ }
  }, []);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('qonun_moddalari')
      .select('*')
      .order('kodeks_nomi', { ascending: true })
      .order('modda_raqami', { ascending: true });
    if (error) {
      toast({ title: 'Yuklash xatosi', description: error.message, variant: 'destructive' });
    } else {
      setArticles((data || []) as QonunModda[]);
    }
    setLoading(false);
    loadKodeksStatus();
    loadConstStatus();
  }, [toast, loadKodeksStatus, loadConstStatus]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Poll status while vectorizing
  useEffect(() => {
    if (vectorizing) {
      pollRef.current = setInterval(async () => {
        await loadKodeksStatus();
        // Also check if the edge function is still running
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/vectorize-articles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
            body: JSON.stringify({ kodeks_nomi: vectorizing, _status_check: true }),
          });
          const data = await res.json();
          if (data.done) {
            setVectorizing(null);
            setVectorizeProgress(null);
            if (pollRef.current) clearInterval(pollRef.current);
            toast({ title: 'Vektorlash yakunlandi', description: `${data.status?.[vectorizing]?.vectorized ?? 0}/${data.status?.[vectorizing]?.total ?? 0} vektorlangan` });
          } else {
            setVectorizeProgress({ processed: data.processed ?? 0, errors: data.errors ?? 0, remaining: data.remaining ?? 0 });
          }
        } catch {
          // ignore polling errors
        }
      }, 4000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [vectorizing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unique kodeks names for filter
  const kodeksList = useMemo(() => {
    const set = new Set(articles.map(a => a.kodeks_nomi));
    return Array.from(set).sort();
  }, [articles]);

  const filteredArticles = useMemo(() => {
    let result = articles;
    if (kodeksFilter) {
      result = result.filter(a => a.kodeks_nomi === kodeksFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.modda_raqami.toLowerCase().includes(q) ||
        a.modda_matni.toLowerCase().includes(q) ||
        a.kodeks_nomi.toLowerCase().includes(q)
      );
    }
    return result;
  }, [articles, search, kodeksFilter]);

  const resetForm = () => {
    setKodeksNomi('');
    setModdaRaqami('');
    setModdaMatni('');
    setManbaHavola('');
    setUrlInput('');
    setEditingId(null);
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) {
      toast({ title: 'URL kiriting', variant: 'destructive' });
      return;
    }
    if (!urlInput.includes('lex.uz')) {
      toast({ title: 'Faqat lex.uz havolalari', variant: 'destructive' });
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/fetch-legal-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (data?.error) {
        toast({ title: 'Xatolik', description: data.error, variant: 'destructive' });
      } else if (data?.modda_matni) {
        setKodeksNomi(data.kodeks_nomi || '');
        setModdaRaqami(data.modda_raqami || '');
        setModdaMatni(data.modda_matni || '');
        setManbaHavola(data.manba_havola || urlInput.trim());
        toast({ title: 'Modda yuklandi', description: data.usedAi ? 'AI yordamida ajratildi' : 'Avtomatik ajratildi' });
      } else {
        toast({ title: 'Modda topilmadi', description: 'Havolani tekshiring yoki qo\'lda yozing', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'Sahifa yuklab olinmadi', variant: 'destructive' });
    } finally {
      setFetching(false);
    }
  };

  const checkDuplicate = async (kodeks: string, modda: string): Promise<QonunModda | null> => {
    const { data } = await supabase
      .from('qonun_moddalari')
      .select('*')
      .eq('kodeks_nomi', kodeks)
      .eq('modda_raqami', modda)
      .maybeSingle();
    return data as QonunModda | null;
  };

  const handleSave = async () => {
    if (!kodeksNomi.trim() || !moddaRaqami.trim() || !moddaMatni.trim()) {
      toast({ title: 'Kodeks nomi, modda raqami va matni majburiy', variant: 'destructive' });
      return;
    }

    if (!editingId) {
      const existing = await checkDuplicate(kodeksNomi.trim(), moddaRaqami.trim());
      if (existing) {
        const useExisting = confirm(
          `"${kodeksNomi.trim()} ${moddaRaqami.trim()}-modda" allaqachon bazada bor. Mavjud moddani ishlatasizmi? (OK — mavjudini saqlash, Cancel — tahrirlashda davom etish)`
        );
        if (useExisting) {
          resetForm();
          setShowForm(false);
          return;
        }
        return;
      }
    }

    setSaving(true);
    const payload = {
      kodeks_nomi: kodeksNomi.trim(),
      modda_raqami: moddaRaqami.trim(),
      modda_matni: moddaMatni.trim(),
      manba_havola: manbaHavola.trim() || null,
      yaratgan_ustoz_id: user?.ustoz_id || null,
      yaratgan_ustoz_ismi: user ? `${user.ism} ${user.familiya}` : null,
    };

    if (editingId) {
      const { error } = await supabase
        .from('qonun_moddalari')
        .update(payload)
        .eq('id', editingId);
      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Modda yangilandi' });
        resetForm();
        setShowForm(false);
        loadArticles();
      }
    } else {
      const { error } = await supabase
        .from('qonun_moddalari')
        .insert(payload);
      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Yangi modda qo\'shildi' });
        resetForm();
        setShowForm(false);
        loadArticles();
      }
    }
    setSaving(false);
  };

  const handleEdit = (a: QonunModda) => {
    setEditingId(a.id);
    setKodeksNomi(a.kodeks_nomi);
    setModdaRaqami(a.modda_raqami);
    setModdaMatni(a.modda_matni);
    setManbaHavola(a.manba_havola || '');
    setFormMode('manual');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu moddani o\'chirishni istaysizmi? Kazuslarga biriktirilgan bo\'lsa, bog\'lanish ham o\'chiriladi.')) return;
    const { error } = await supabase.from('qonun_moddalari').delete().eq('id', id);
    if (error) {
      toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Modda o\'chirildi' });
      loadArticles();
    }
  };

  const handleConstToggle = async () => {
    if (!constStatus) return;
    setConstToggling(true);
    try {
      const newValue = !constStatus.enabled;
      await fetch(`${supabaseUrl}/functions/v1/constitution-file-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ action: 'toggle', enabled: newValue }),
      });
      await loadConstStatus();
      toast({ title: newValue ? 'File Search yoqildi' : 'File Search o\'chirildi', description: newValue ? 'Konstitutsiya endi Google File Search orqali ishlaydi' : 'Konstitutsiya eski pgvector yo\'lga qaytdi (agar mavjud bo\'lsa)' });
    } catch {
      toast({ title: 'Xatolik', variant: 'destructive' });
    } finally {
      setConstToggling(false);
    }
  };

  const handleConstSetup = async () => {
    setConstSettingUp(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/constitution-file-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ action: 'setup' }),
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: 'Setup xatosi', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Konstitutsiya yuklandi', description: `${data.articles_count} ta modda File Search store'ga yuklandi` });
        await loadConstStatus();
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'Setup amalga oshmadi', variant: 'destructive' });
    } finally {
      setConstSettingUp(false);
    }
  };

  const handleConstSearch = async () => {
    if (!constQuery.trim() || constQuery.trim().length < 5) {
      toast({ title: 'So\'rov kamida 5 ta belgidan iborat bo\'lishi kerak', variant: 'destructive' });
      return;
    }
    setConstSearching(true);
    setConstResult(null);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/constitution-file-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ action: 'search', query: constQuery.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: 'Qidiruv xatosi', description: data.error, variant: 'destructive' });
      } else {
        setConstResult({ answer: data.answer || 'Javob topilmadi', sources: data.sources || [] });
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'Qidiruv amalga oshmadi', variant: 'destructive' });
    } finally {
      setConstSearching(false);
    }
  };

  const startVectorization = async (kodeksNomi: string) => {
    setVectorizing(kodeksNomi);
    setVectorizeProgress(null);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/vectorize-articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ kodeks_nomi: kodeksNomi, batch_size: 25 }),
      });
      const data = await res.json();
      if (data?.error) {
        toast({ title: 'Vektorlash xatosi', description: data.error, variant: 'destructive' });
        setVectorizing(null);
      } else {
        setVectorizeProgress({ processed: data.processed ?? 0, errors: data.errors ?? 0, remaining: data.remaining ?? 0 });
        toast({ title: 'Vektorlash boshlandi', description: `${data.processed} ta vektorlandi, ${data.remaining ?? 0} ta qoldi` });
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'Vektorlash amalga oshmadi', variant: 'destructive' });
      setVectorizing(null);
    }
  };

  const retryErroredArticles = async (kodeksNomi?: string) => {
    setRetryingErrors(true);
    try {
      // Clear errors for this kodeks first
      const clearQuery: Record<string, unknown> = { embedding_error: null };
      let q = supabase.from('qonun_moddalari').update(clearQuery).is('embedding', null).not('embedding_error', 'is', null);
      if (kodeksNomi) q = q.eq('kodeks_nomi', kodeksNomi);
      await q;

      // Start vectorization with retry_errors
      const res = await fetch(`${supabaseUrl}/functions/v1/vectorize-articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ kodeks_nomi: kodeksNomi, retry_errors: true, batch_size: 25 }),
      });
      const data = await res.json();
      if (data?.error) {
        toast({ title: 'Qayta urinish xatosi', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Qayta urinish boshlandi', description: `${data.processed} ta vektorlandi` });
      }
      await loadKodeksStatus();
    } catch {
      toast({ title: 'Xatolik', variant: 'destructive' });
    } finally {
      setRetryingErrors(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookMarked className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 font-medium">Bu bo'lim faqat admin uchun</p>
      </div>
    );
  }

  const callImportBatch = async (url: string, offset: number): Promise<{ ok: boolean; data: any; status: number }> => {
    const res = await fetch(`${supabaseUrl}/functions/v1/import-legal-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        url,
        offset,
        batchSize: 10,
        resume: offset > 0,
        forceReimport: offset === 0,
      }),
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: `Server ${res.status} javobi (timeout yoki gateway xatosi): ${text.slice(0, 120) || 'bo\'sh javob'}` };
    }
    return { ok: res.ok && !data?.error, data, status: res.status };
  };

  const handleImportCode = async () => {
    const normalizedUrl = importUrl.trim();
    if (!normalizedUrl) {
      toast({ title: 'URL kiriting', variant: 'destructive' });
      return;
    }
    if (!normalizedUrl.includes('lex.uz')) {
      toast({ title: 'Faqat lex.uz havolalari', variant: 'destructive' });
      return;
    }

    // Avtomatik rejimni yoqish va partiyalarni ketma-ket yuklash
    autoImportRef.current = true;
    importUrlRef.current = normalizedUrl;
    setAutoImport(true);
    setImporting(true);
    setImportProgress({ loaded: 0, total: 0, batches: 0, errors: [] });

    let currentOffset = importOffset;
    let totalLoaded = importProgress?.loaded || 0;
    let totalErrors: string[] = importProgress?.errors || [];
    let batchNum = importProgress?.batches || 0;
    let kodeksNomi = importResult?.kodeks_nomi || '';
    let totalFound = importProgress?.total || 0;

    try {
      while (autoImportRef.current) {
        batchNum++;
        let result: { ok: boolean; data: any; status: number } | null = null;
        let retries = 0;

        // 429 retry loop
        while (autoImportRef.current && retries < 3) {
          try {
            result = await callImportBatch(importUrlRef.current, currentOffset);
          } catch {
            result = { ok: false, data: { error: 'Tarmoq xatosi' }, status: 0 };
          }

          if (result.ok) break;

          const is429 = result.status === 429 || (result.data?.error || '').includes('429') || (result.data?.error || '').toLowerCase().includes('rate');
          if (is429 && retries < 2 && autoImportRef.current) {
            setRetrying429(true);
            const waitSec = 12 + retries * 6;
            toast({ title: 'Rate limit (429)', description: `${waitSec} soniya kutib, qayta urinilmoqda...`, variant: 'default' });
            await new Promise((r) => setTimeout(r, waitSec * 1000));
            setRetrying429(false);
            retries++;
          } else {
            break;
          }
        }

        if (!result || !result.ok) {
          totalErrors.push(`Partiya ${batchNum}: ${result?.data?.error || 'Noma\'lum xato'}`);
          setImportProgress({ loaded: totalLoaded, total: totalFound, batches: batchNum, errors: [...totalErrors] });
          setImportResult({ ...result?.data, done: false, errors: [...totalErrors] });
          toast({ title: 'Import to\'xtadi', description: result?.data?.error || 'Xato yuz berdi', variant: 'destructive' });
          break;
        }

        const data = result.data;
        kodeksNomi = data.kodeks_nomi || kodeksNomi;
        totalFound = data.total_found || totalFound;
        totalLoaded += data.db_written || 0;
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          totalErrors = [...totalErrors, ...data.errors];
        }

        currentOffset = data.offset ?? currentOffset + 10;
        setImportOffset(currentOffset);
        setImportProgress({ loaded: totalLoaded, total: totalFound, batches: batchNum, errors: [...totalErrors] });
        setImportResult(data);

        // Holatni saqlash — sahifa yangilansa ham davom ettirish mumkin
        saveImportState(importUrlRef.current, currentOffset, totalFound, totalLoaded);

        loadArticles();

        if (data.done || data.remaining === 0) {
          clearImportState();
          toast({
            title: 'Import to\'liq yakunlandi',
            description: `${kodeksNomi}: ${totalLoaded}/${totalFound} ta modda yuklandi${totalErrors.length > 0 ? `, ${totalErrors.length} ta xato` : ''}`,
          });
          break;
        }

        // Keyingi partiya oldin qisqa kutish (server'ga zo'rmay)
        if (autoImportRef.current) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    } finally {
      setImporting(false);
      setAutoImport(false);
      setRetrying429(false);
      autoImportRef.current = false;
    }
  };

  const handleStopImport = () => {
    autoImportRef.current = false;
    setAutoImport(false);
    setImporting(false);
    // Holatni saqlab qo'yamiz — keyin davom ettirish mumkin
    if (importUrlRef.current && importProgress) {
      saveImportState(importUrlRef.current, importOffset, importProgress.total, importProgress.loaded);
    }
    toast({ title: 'Import to\'xtatildi', description: 'Keyin "Davom ettirish" tugmasini bosib davom ettirishingiz mumkin' });
  };

  const resetImport = () => {
    setImportUrl('');
    setImportOffset(0);
    setImportResult(null);
    setAutoImport(false);
    setImportProgress(null);
    autoImportRef.current = false;
    clearImportState();
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-900">Qonunlar bazasi</h2>
          <Badge variant="secondary" className="text-[10px]">{articles.length} modda</Badge>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setShowImport(!showImport)} className="rounded-xl border-red-200 text-red-600 hover:bg-red-50">
              <Upload className="h-4 w-4 mr-1" /> Kodeks import
            </Button>
          )}
          <Button size="sm" onClick={() => { resetForm(); setFormMode('url'); setShowForm(true); }} className="rounded-xl shadow-md shadow-blue-500/10">
            <Plus className="h-4 w-4 mr-1" /> Yangi modda
          </Button>
        </div>
      </div>

      {/* Vectorization status cards */}
      {kodeksStatuses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-gray-700">Vektorlash holati</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {kodeksStatuses.map((ks) => {
              const pct = ks.total > 0 ? Math.round((ks.vectorized / ks.total) * 100) : 0;
              const isComplete = ks.vectorized === ks.total && ks.total > 0;
              const hasPending = ks.pending > 0;
              const hasErrors = ks.errors > 0;
              const isThisVectorizing = vectorizing === ks.kodeks_nomi;

              return (
                <Card key={ks.kodeks_nomi} className={`border transition-all ${isComplete ? 'border-green-200/60 bg-green-50/30' : hasPending ? 'border-amber-200/60 bg-amber-50/20' : 'border-gray-100/80'}`}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-gray-800 truncate">{ks.kodeks_nomi}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {hasErrors && !isComplete && <AlertCircle className="h-4 w-4 text-red-400" />}
                        {isThisVectorizing && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold tabular-nums ${isComplete ? 'text-green-600' : 'text-gray-500'}`}>
                        {ks.vectorized}/{ks.total}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {isComplete ? (
                        <span className="text-[10px] text-green-600 font-bold">To'liq vektorlangan</span>
                      ) : (
                        <>
                          {hasPending && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!vectorizing}
                              onClick={() => startVectorization(ks.kodeks_nomi)}
                              className="h-6 px-2 text-[10px] rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50"
                            >
                              {isThisVectorizing ? (
                                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {vectorizeProgress ? `${vectorizeProgress.processed} vektorlandi` : 'Boshlandi...'}</>
                              ) : (
                                <><Zap className="h-3 w-3 mr-1" /> Vektorlashni davom ettirish</>
                              )}
                            </Button>
                          )}
                          {hasErrors && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={retryingErrors || !!vectorizing}
                              onClick={() => retryErroredArticles(ks.kodeks_nomi)}
                              className="h-6 px-2 text-[10px] rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <RotateCw className="h-3 w-3 mr-1" /> {ks.errors} ta xatoni qayta urinish
                            </Button>
                          )}
                          {hasPending && !isThisVectorizing && (
                            <span className="text-[10px] text-amber-600 font-bold">{ks.pending} ta kutilmoqda</span>
                          )}
                          {hasErrors && (
                            <span className="text-[10px] text-red-500 font-bold">{ks.errors} ta xato</span>
                          )}
                        </>
                      )}
                    </div>

                    {isThisVectorizing && vectorizeProgress && (
                      <div className="mt-2 p-2 rounded-lg bg-blue-50/80 border border-blue-100">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                          <span className="text-[10px] text-blue-700 font-bold">
                            {vectorizeProgress.processed} vektorlandi, {vectorizeProgress.remaining} ta qoldi
                            {vectorizeProgress.errors > 0 && `, ${vectorizeProgress.errors} xato`}
                          </span>
                        </div>
                        <p className="text-[9px] text-blue-500 mt-1">Jarayon server tomonida davom etmoqda — sahifani yopsangiz ham davom etadi</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Error articles list */}
          {errorArticles.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowErrors(!showErrors)}
                className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {errorArticles.length} ta modda vektorlanmadi (xato)
                {showErrors ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showErrors && (
                <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto rounded-xl border border-red-100 p-2 bg-red-50/30">
                  {errorArticles.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-white/80 border border-red-100/60">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-gray-700">{a.kodeks_nomi}</span>
                          <span className="text-[10px] font-bold text-gray-500">{a.modda_raqami}-modda</span>
                        </div>
                        <p className="text-[10px] text-red-500 leading-tight line-clamp-2">{a.embedding_error || 'Noma\'lum xato'}</p>
                      </div>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retryingErrors || !!vectorizing}
                    onClick={() => retryErroredArticles()}
                    className="w-full mt-1 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <RotateCw className="h-3.5 w-3.5 mr-1" /> Barcha xatolarni qayta urinish
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Constitution File Search (izolyatsiyalangan sinov moduli) */}
      {isAdmin && constStatus && (
        <Card className={`border-2 transition-all ${constStatus.enabled ? 'border-teal-200/60 bg-teal-50/20' : 'border-gray-200/60'}`}>
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FlaskConical className="h-4 w-4 text-teal-600 shrink-0" />
                <span className="text-xs font-bold text-gray-800 truncate">Konstitutsiya — Google File Search</span>
                <Badge variant="outline" className={`text-[9px] shrink-0 ${constStatus.enabled ? 'border-teal-300 text-teal-700 bg-teal-50' : 'border-gray-300 text-gray-500'}`}>
                  {constStatus.enabled ? 'Sinov rejimida' : 'O\'chiq'}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={constToggling}
                onClick={handleConstToggle}
                className={`h-7 px-3 text-[10px] rounded-lg shrink-0 ${constStatus.enabled ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-teal-300 text-teal-600 hover:bg-teal-50'}`}
              >
                {constToggling ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                {constStatus.enabled ? 'O\'chirish' : 'Yoqish'}
              </Button>
            </div>

            <div className="flex items-center gap-3 flex-wrap text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <Cloud className="h-3 w-3" />
                Store: {constStatus.store_exists ? 'yaratilgan' : 'yoq'}
              </span>
              <span>{constStatus.articles_count} ta modda</span>
              {constStatus.enabled && (
                <Badge variant="outline" className="text-[9px] border-teal-300 text-teal-700 bg-teal-50">
                  Google File Search (sinov rejimi)
                </Badge>
              )}
            </div>

            {!constStatus.store_exists && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={constSettingUp}
                  onClick={handleConstSetup}
                  className="h-7 px-3 text-[10px] rounded-lg border-teal-300 text-teal-600 hover:bg-teal-50"
                >
                  {constSettingUp ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                  Konstitutsiyani yuklash
                </Button>
                <span className="text-[10px] text-gray-400">155 moddani Google File Search store'ga yuklaydi</span>
              </div>
            )}

            {constStatus.enabled && constStatus.store_exists && (
              <div className="space-y-2 pt-1 border-t border-teal-100/60">
                <div className="flex gap-2">
                  <Input
                    value={constQuery}
                    onChange={e => setConstQuery(e.target.value)}
                    placeholder="Konstitutsiya bo'yicha savol..."
                    className="flex-1 rounded-xl text-xs h-8"
                    onKeyDown={e => { if (e.key === 'Enter' && !constSearching) handleConstSearch(); }}
                  />
                  <Button
                    size="sm"
                    disabled={constSearching}
                    onClick={handleConstSearch}
                    className="rounded-xl shrink-0 h-8"
                  >
                    {constSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                    So'rash
                  </Button>
                </div>
                {constResult && (
                  <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 space-y-2">
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{constResult.answer}</p>
                    {constResult.sources.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] text-gray-400 font-bold">Manbalar:</span>
                        {constResult.sources.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[9px] border-teal-200 text-teal-600">{s}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-gray-50/80 border border-gray-100">
              <AlertCircle className="h-3 w-3 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-[9px] text-gray-500 leading-relaxed">
                Bu sinov moduli butunlay alohida ishlaydi. Jinoyat va Fuqarolik kodeksi pgvector orqali ishlashda davom etadi.
                O'chirilganda (toggle=false) Konstitutsiya avtomatik eski pgvector yo'lga qaytadi (agar mavjud bo'lsa).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && showImport && (
        <Card className="border-2 border-red-200/60 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-red-50 to-red-100/50 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-red-500" /> Kodeks import qilish (faqat admin)
              </CardTitle>
              <button onClick={() => { setShowImport(false); resetImport(); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">lex.uz kodeks sahifa havolasi</Label>
              <div className="flex gap-2">
                <Input
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  placeholder="https://lex.uz/docs/XXXXX — butun kodeks sahifasi"
                  className="flex-1 rounded-xl"
                  disabled={importing}
                />
                {importing && autoImport ? (
                  <Button
                    type="button"
                    onClick={handleStopImport}
                    variant="outline"
                    className="rounded-xl shrink-0 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-1" /> To'xtatish
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleImportCode}
                    disabled={importResult?.done === true}
                    variant="destructive"
                    className="rounded-xl shrink-0"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {importOffset > 0 && !importResult?.done ? 'Davom ettirish' : 'Import qilish'}
                  </Button>
                )}
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/80 border border-blue-100">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Tizim avtomatik ravishda har 25 talik partiyani ketma-ket yuklaydi — hech narsa bosish shart emas.
                  Agar 429 (rate limit) xatosi kelsa, 12-24 soniya kutib qayta urinadi. Jarayonni "To'xtatish" tugmasi bilan to'xtatib, keyin "Davom ettirish" bilan davom ettirishingiz mumkin.
                </p>
              </div>
            </div>

            {/* Real-time progress bar */}
            {importing && importProgress && importProgress.total > 0 && (
              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {retrying429 ? (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                    )}
                    <span className="text-sm font-bold text-blue-800">
                      {retrying429 ? 'Rate limit — qayta urinilmoqda...' : 'Avtomatik import davom etmoqda...'}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-blue-700 tabular-nums">
                    {importProgress.loaded}/{importProgress.total}
                  </span>
                </div>
                <div className="h-3 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${retrying429 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (importProgress.loaded / importProgress.total) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-blue-600">
                  <span>Partiya #{importProgress.batches}</span>
                  <span>{Math.round((importProgress.loaded / importProgress.total) * 100)}%</span>
                </div>
                {importProgress.errors.length > 0 && (
                  <p className="text-[10px] text-amber-600 font-medium">
                    {importProgress.errors.length} ta xato aniqlandi
                  </p>
                )}
                <p className="text-[10px] text-blue-500">
                  Jarayon avtomatik — sahifani ochiq qoldirib, boshqa ish bilan shug'ullanishingiz mumkin.
                </p>
              </div>
            )}

            {/* Final report */}
            {importResult && !importing && (
              <div className={`p-4 rounded-xl border space-y-2 ${importResult.done ? 'bg-green-50/80 border-green-200' : 'bg-amber-50/80 border-amber-200'}`}>
                <div className="flex items-center gap-2">
                  {importResult.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  )}
                  <span className={`text-sm font-bold ${importResult.done ? 'text-green-800' : 'text-amber-800'}`}>
                    {importResult.done ? 'Import to\'liq yakunlandi' : 'Import to\'xtatildi'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-white/60">
                    <span className="text-gray-500">Kodeks:</span>
                    <span className="font-bold text-gray-900 ml-1">{importResult.kodeks_nomi || (importProgress && importResult.kodeks_nomi) || '—'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/60">
                    <span className="text-gray-500">Jami topilgan:</span>
                    <span className="font-bold text-gray-900 ml-1">{(importProgress?.total ?? importResult.total_found) ?? '—'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/60">
                    <span className="text-gray-500">Yuklandi (jami):</span>
                    <span className="font-bold text-green-700 ml-1">{importProgress?.loaded ?? importResult.db_written ?? '—'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/60">
                    <span className="text-gray-500">File Search:</span>
                    <span className="font-bold text-blue-700 ml-1">{importResult.file_search_uploaded ?? '—'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/60">
                    <span className="text-gray-500">Partiyalar:</span>
                    <span className="font-bold text-gray-900 ml-1">{importProgress?.batches ?? '—'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/60">
                    <span className="text-gray-500">Qoldi:</span>
                    <span className="font-bold text-amber-600 ml-1">{importResult.remaining ?? 0}</span>
                  </div>
                </div>
                {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 space-y-1">
                    <p className="font-bold">Xatolar ({importResult.errors.length}):</p>
                    {importResult.errors.slice(0, 10).map((error: string, index: number) => (
                      <p key={index} className="leading-relaxed">{error}</p>
                    ))}
                    {importResult.errors.length > 10 && (
                      <p className="text-gray-500">...va yana {importResult.errors.length - 10} ta xato</p>
                    )}
                  </div>
                )}
                {!importResult.done && importResult.remaining > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleImportCode}
                      variant="destructive"
                      className="rounded-xl"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" /> Davom ettirish ({importResult.remaining} ta qoldi)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card className="border-2 border-blue-200/60 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{editingId ? 'Moddani tahrirlash' : 'Yangi modda qo\'shish'}</CardTitle>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {!editingId && (
              <div className="flex gap-2 p-1 bg-gray-100/80 rounded-2xl">
                <button
                  onClick={() => setFormMode('url')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-300 ${
                    formMode === 'url' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <LinkIcon className="h-3.5 w-3.5 inline mr-1" /> Havola orqali (tavsiya)
                </button>
                <button
                  onClick={() => setFormMode('manual')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-300 ${
                    formMode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 inline mr-1" /> Qo'lda yozish
                </button>
              </div>
            )}

            {formMode === 'url' && !editingId && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">lex.uz havolasi</Label>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="https://lex.uz/docs/XXXXX#XXXXX"
                    className="flex-1 rounded-xl"
                  />
                  <Button
                    type="button"
                    onClick={handleFetchUrl}
                    disabled={fetching}
                    className="rounded-xl shrink-0"
                  >
                    {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-1" />}
                    Yuklab olish
                  </Button>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/80 border border-blue-100">
                  <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Aniq bitta moddaning sahifa havolasini kiriting (masalan, <code className="bg-blue-100 px-1 rounded">lex.uz/docs/XXXXX#YYYYY</code>).
                    Butun kodeks havolasi kiritmang. Tizim avtomatik ravishda modda matnini ajratib oladi — bu AI so'rov emas, token sarflamaydi.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Kodeks nomi</Label>
                <Input
                  value={kodeksNomi}
                  onChange={e => setKodeksNomi(e.target.value)}
                  placeholder="Masalan: Fuqarolik kodeksi"
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">Modda raqami</Label>
                <Input
                  value={moddaRaqami}
                  onChange={e => setModdaRaqami(e.target.value)}
                  placeholder="Masalan: 333"
                  className="mt-1.5 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Modda matni</Label>
              <Textarea
                value={moddaMatni}
                onChange={e => setModdaMatni(e.target.value)}
                placeholder="Moddaning to'liq matni..."
                className="mt-1.5 min-h-[150px] rounded-xl font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Manba havolasi (ixtiyoriy)</Label>
              <Input
                value={manbaHavola}
                onChange={e => setManbaHavola(e.target.value)}
                placeholder="https://lex.uz/docs/..."
                className="mt-1.5 rounded-xl"
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl shadow-lg shadow-blue-500/20">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? 'Saqlash' : 'Bazaga qo\'shish'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search & filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Modda qidirish (raqam yoki matn bo'yicha)..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur-sm text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
          />
        </div>
        {kodeksList.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-400 font-bold">Kodeks:</span>
            <button
              onClick={() => setKodeksFilter('')}
              className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all duration-200 ${
                !kodeksFilter ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200/80 hover:border-gray-300'
              }`}
            >
              Barchasi
            </button>
            {kodeksList.map(k => (
              <button
                key={k}
                onClick={() => setKodeksFilter(k === kodeksFilter ? '' : k)}
                className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all duration-200 ${
                  kodeksFilter === k ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200/80 hover:border-gray-300'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Articles list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center py-16">
          <BookMarked className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">{articles.length === 0 ? 'Hozircha moddalar yo\'q' : 'Qidiruv bo\'yicha modda topilmadi'}</p>
          {articles.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">"Yangi modda" tugmasini bosing</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredArticles.map((a) => (
            <Card key={a.id} className="group hover:shadow-md transition-shadow border-gray-100/80">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50/50">
                        {a.kodeks_nomi}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        {a.modda_raqami}-modda
                      </Badge>
                      {a.manba_havola && (
                        <a
                          href={a.manba_havola}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                        >
                          <ExternalLink className="h-3 w-3" /> lex.uz
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{a.modda_matni}</p>
                    {a.yaratgan_ustoz_ismi && (
                      <p className="text-[10px] text-gray-400 mt-2">Qo'shgan: {a.yaratgan_ustoz_ismi}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(a)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Tahrirlash"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
