import { useState, useEffect, useCallback } from 'react';
import { BookMarked, Plus, RefreshCw, Search, ExternalLink, Loader2, CheckCircle, AlertTriangle, ChevronRight, ChevronDown, FileText, Calendar, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Qonun {
  id: string;
  kod: string;
  nom: string;
  link: string;
  doc_id: string | null;
  oxirgi_tahrir_sanasi: string | null;
  modda_soni: number;
  olingan_sana: string;
}

interface Modda {
  id: string;
  qonun_kodi: string;
  modda_raqami: string;
  sarlavha: string | null;
  bob_nomi: string | null;
  matn: string | null;
  sud_amaliyoti: string | null;
  lex_element_id: string | null;
}

interface ImportResult {
  success: boolean;
  qonun?: { kod: string; nom: string; doc_id: string; oxirgi_tahrir: string | null };
  modda_soni?: number;
  saved_count?: number;
  gaps?: number[];
  superscript_moddalar?: { raqam: string; sarlavha: string }[];
  first_3?: { raqam: string; sarlavha: string; bob: string; matn_uzunligi: number; lex_id: string }[];
  last_3?: { raqam: string; sarlavha: string; bob: string; matn_uzunligi: number; lex_id: string }[];
  error?: string;
}

export default function LexUzQidiruvchi() {
  const [qonunlar, setQonunlar] = useState<Qonun[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [importYuklanyapti, setImportYuklanyapti] = useState(false);
  const [importNatija, setImportNatija] = useState<ImportResult | null>(null);

  // Form
  const [formKod, setFormKod] = useState('');
  const [formNom, setFormNom] = useState('');
  const [formLink, setFormLink] = useState('');

  // Modda qidiruv
  const [tanlanganQonun, setTanlanganQonun] = useState<Qonun | null>(null);
  const [moddalar, setModdalar] = useState<Modda[]>([]);
  const [moddaYuklanyapti, setModdaYuklanyapti] = useState(false);
  const [qidiruvSoz, setQidiruvSoz] = useState('');
  const [ochiqModda, setOchiqModda] = useState<string | null>(null);

  const { toast } = useToast();

  const qonunlarniYuklash = useCallback(async () => {
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase
        .from('qonunlar')
        .select('*')
        .order('kod');
      if (error) throw error;
      setQonunlar(data || []);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Qonunlarni yuklashda xatolik', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  }, [toast]);

  useEffect(() => { qonunlarniYuklash(); }, [qonunlarniYuklash]);

  const importQilish = async () => {
    if (!formLink.trim()) {
      toast({ title: 'Xato', description: 'Lex.uz linkini kiriting', variant: 'destructive' });
      return;
    }
    if (!formKod.trim()) {
      toast({ title: 'Xato', description: 'Qonun kodini kiriting (masalan: JK)', variant: 'destructive' });
      return;
    }
    setImportYuklanyapti(true);
    setImportNatija(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-qonun`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'import',
          link: formLink.trim(),
          kod: formKod.trim().toUpperCase(),
          nom: formNom.trim() || undefined,
        }),
      });
      const data: ImportResult = await res.json();
      if (data.error) {
        toast({ title: 'Import xatosi', description: data.error, variant: 'destructive' });
      } else if (data.success) {
        setImportNatija(data);
        toast({ title: 'Muvaffaqiyatli!', description: `${data.modda_soni} ta modda import qilindi` });
        await qonunlarniYuklash();
        setFormKod(''); setFormNom(''); setFormLink('');
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message || 'Importda xatolik', variant: 'destructive' });
    } finally {
      setImportYuklanyapti(false);
    }
  };

  const yangilash = async (qonun: Qonun) => {
    setImportYuklanyapti(true);
    setImportNatija(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-qonun`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          link: qonun.link,
          kod: qonun.kod,
          nom: qonun.nom,
        }),
      });
      const data: ImportResult = await res.json();
      if (data.error) {
        toast({ title: 'Yangilash xatosi', description: data.error, variant: 'destructive' });
      } else if (data.success) {
        setImportNatija(data);
        toast({ title: 'Yangilandi!', description: `${data.modda_soni} ta modda yangilandi` });
        await qonunlarniYuklash();
        if (tanlanganQonun?.kod === qonun.kod) {
          await moddalarniYuklash(qonun);
        }
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message || 'Yangilashda xatolik', variant: 'destructive' });
    } finally {
      setImportYuklanyapti(false);
    }
  };

  const moddalarniYuklash = async (qonun: Qonun) => {
    setTanlanganQonun(qonun);
    setModdaYuklanyapti(true);
    setQidiruvSoz('');
    try {
      const { data, error } = await supabase
        .from('qonun_moddalari_v2')
        .select('id, qonun_kodi, modda_raqami, sarlavha, bob_nomi, matn, sud_amaliyoti, lex_element_id')
        .eq('qonun_kodi', qonun.kod)
        .order('modda_raqami')
        .limit(500);
      if (error) throw error;
      setModdalar(data || []);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Moddalarni yuklashda xatolik', variant: 'destructive' });
    } finally {
      setModdaYuklanyapti(false);
    }
  };

  const filteredModdalar = qidiruvSoz.trim()
    ? moddalar.filter(m => {
        const s = qidiruvSoz.toLowerCase().replace(/[ʻʼ'']/g, "'");
        const sarlavha = (m.sarlavha || '').toLowerCase().replace(/[ʻʼ'']/g, "'");
        const matn = (m.matn || '').toLowerCase().replace(/[ʻʼ'']/g, "'");
        const raqam = m.modda_raqami.toLowerCase();
        return raqam.includes(s) || sarlavha.includes(s) || matn.includes(s);
      })
    : moddalar;

  const lexLink = (qonun: Qonun, modda?: Modda) => {
    if (modda?.lex_element_id) return `${qonun.link}#${modda.lex_element_id}`;
    return qonun.link;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-2">
        <BookMarked className="w-6 h-6 text-amber-500" />
        <h2 className="text-2xl font-serif font-bold text-amber-100">Lex.uz qidiruvchisi</h2>
      </div>

      {/* ─── QONUN QO'SHISH FORMASI ─── */}
      <Card className="bg-slate-900/60 border-amber-900/30">
        <CardHeader>
          <CardTitle className="text-amber-100 flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5" /> Qonun qo'shish
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Qonun kodi</label>
              <Input
                value={formKod}
                onChange={e => setFormKod(e.target.value)}
                placeholder="JK, MJTK, JPK..."
                className="bg-slate-800 border-slate-700 text-amber-50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Nomi (ixtiyoriy)</label>
              <Input
                value={formNom}
                onChange={e => setFormNom(e.target.value)}
                placeholder="Jinoyat kodeksi"
                className="bg-slate-800 border-slate-700 text-amber-50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Lex.uz linki</label>
              <Input
                value={formLink}
                onChange={e => setFormLink(e.target.value)}
                placeholder="https://lex.uz/uz/docs/-111453"
                className="bg-slate-800 border-slate-700 text-amber-50"
              />
            </div>
          </div>
          <Button
            onClick={importQilish}
            disabled={importYuklanyapti}
            className="bg-amber-700 hover:bg-amber-600 text-white"
          >
            {importYuklanyapti ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Import qilish
          </Button>
        </CardContent>
      </Card>

      {/* ─── IMPORT NATIJASI ─── */}
      {importNatija && importNatija.success && (
        <Card className="bg-slate-900/60 border-emerald-900/40">
          <CardHeader>
            <CardTitle className="text-emerald-300 flex items-center gap-2 text-lg">
              <CheckCircle className="w-5 h-5" /> Import natijasi: {importNatija.qonun?.nom}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline" className="border-emerald-700 text-emerald-300">
                <Layers className="w-3 h-3 mr-1" /> {importNatija.modda_soni} ta modda
              </Badge>
              <Badge variant="outline" className="border-emerald-700 text-emerald-300">
                <CheckCircle className="w-3 h-3 mr-1" /> {importNatija.saved_count} saqlandi
              </Badge>
              {importNatija.qonun?.oxirgi_tahrir && (
                <Badge variant="outline" className="border-slate-600 text-slate-300">
                  <Calendar className="w-3 h-3 mr-1" /> Oxirgi tahrir: {importNatija.qonun.oxirgi_tahrir}
                </Badge>
              )}
            </div>

            {importNatija.superscript_moddalar && importNatija.superscript_moddalar.length > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Superskript moddalar ({importNatija.superscript_moddalar.length} ta):</p>
                <div className="flex flex-wrap gap-1.5">
                  {importNatija.superscript_moddalar.map(m => (
                    <Badge key={m.raqam} variant="outline" className="border-amber-800 text-amber-300 text-xs">
                      {m.raqam}-modda
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {importNatija.gaps && importNatija.gaps.length > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Teshiklar (bekor qilingan moddalar):</p>
                <div className="flex flex-wrap gap-1.5">
                  {importNatija.gaps.map(g => (
                    <Badge key={g} variant="outline" className="border-red-800 text-red-400 text-xs">
                      {g}-modda
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {importNatija.first_3 && importNatija.first_3.length > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Birinchi 3 modda:</p>
                <div className="space-y-1">
                  {importNatija.first_3.map(m => (
                    <div key={m.raqam} className="text-sm text-slate-300 flex items-center gap-2">
                      <Badge variant="outline" className="border-slate-600 text-amber-200 text-xs">{m.raqam}</Badge>
                      <span className="truncate">{m.sarlavha}</span>
                      <span className="text-slate-500 text-xs">({m.matn_uzunligi} belgi)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importNatija.last_3 && importNatija.last_3.length > 0 && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Oxirgi 3 modda:</p>
                <div className="space-y-1">
                  {importNatija.last_3.map(m => (
                    <div key={m.raqam} className="text-sm text-slate-300 flex items-center gap-2">
                      <Badge variant="outline" className="border-slate-600 text-amber-200 text-xs">{m.raqam}</Badge>
                      <span className="truncate">{m.sarlavha}</span>
                      <span className="text-slate-500 text-xs">({m.matn_uzunligi} belgi)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── QONUNLAR RO'YXATI ─── */}
      <Card className="bg-slate-900/60 border-amber-900/30">
        <CardHeader>
          <CardTitle className="text-amber-100 flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" /> Qonunlar ({qonunlar.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {yuklanyapti ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
            </div>
          ) : qonunlar.length === 0 ? (
            <p className="text-slate-500 text-sm">Hozircha qonun qo'shilmagan. Yuqoridagi formadan qo'shing.</p>
          ) : (
            <div className="space-y-2">
              {qonunlar.map(q => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer border border-slate-700/50"
                  onClick={() => moddalarniYuklash(q)}
                >
                  <Badge variant="outline" className="border-amber-700 text-amber-300 font-mono">
                    {q.kod}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-amber-50 truncate">{q.nom}</p>
                    <p className="text-xs text-slate-500">
                      {q.modda_soni} ta modda
                      {q.oxirgi_tahrir_sanasi && ` · tahrir: ${q.oxirgi_tahrir_sanasi}`}
                      {q.olingan_sana && ` · import: ${new Date(q.olingan_sana).toLocaleDateString('uz')}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-amber-300"
                    onClick={(e) => { e.stopPropagation(); yangilash(q); }}
                    disabled={importYuklanyapti}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <a
                    href={q.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-slate-400 hover:text-amber-300 p-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── MODDA RO'YXATI ─── */}
      {tanlanganQonun && (
        <Card className="bg-slate-900/60 border-amber-900/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-amber-100 flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                {tanlanganQonun.kod} — {tanlanganQonun.nom}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400"
                onClick={() => { setTanlanganQonun(null); setModdalar([]); }}
              >
                Yopish
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                value={qidiruvSoz}
                onChange={e => setQidiruvSoz(e.target.value)}
                placeholder="Modda raqami yoki so'z bo'yicha qidirish..."
                className="pl-10 bg-slate-800 border-slate-700 text-amber-50"
              />
            </div>

            {moddaYuklanyapti ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Moddalar yuklanmoqda...
              </div>
            ) : filteredModdalar.length === 0 ? (
              <p className="text-slate-500 text-sm">Modda topilmadi.</p>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                <p className="text-xs text-slate-500 mb-2">{filteredModdalar.length} ta modda ko'rsatilmoqda</p>
                {filteredModdalar.map(m => (
                  <div key={m.id} className="border border-slate-700/40 rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-2 p-2.5 hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => setOchiqModda(ochiqModda === m.id ? null : m.id)}
                    >
                      {ochiqModda === m.id ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                      <Badge variant="outline" className="border-slate-600 text-amber-200 text-xs font-mono min-w-[50px] justify-center">
                        {m.modda_raqami}
                      </Badge>
                      <span className="text-sm text-slate-300 truncate flex-1">{m.sarlavha || '(sarlavha yo\'q)'}</span>
                      {m.bob_nomi && <span className="text-xs text-slate-600 hidden md:block truncate max-w-[200px]">{m.bob_nomi}</span>}
                      {m.sud_amaliyoti && <Badge variant="outline" className="border-blue-900 text-blue-400 text-xs">sud</Badge>}
                      <a
                        href={lexLink(tanlanganQonun, m)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-slate-500 hover:text-amber-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    {ochiqModda === m.id && (
                      <div className="p-3 bg-slate-800/30 border-t border-slate-700/40 space-y-2">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{m.matn}</p>
                        {m.bob_nomi && <p className="text-xs text-slate-500">Bob: {m.bob_nomi}</p>}
                        {m.sud_amaliyoti && (
                          <div className="mt-2 pt-2 border-t border-slate-700/30">
                            <p className="text-xs text-blue-400 mb-1">Sud amaliyoti (LexUZ sharhi):</p>
                            <p className="text-xs text-slate-400 whitespace-pre-wrap">{m.sud_amaliyoti}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
