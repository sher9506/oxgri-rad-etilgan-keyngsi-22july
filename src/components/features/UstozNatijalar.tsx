import { useState, useEffect } from 'react';
import { Users, Calendar, FileText, ArrowLeft, Eye, Edit, TrendingUp, Trophy, Medal, Download, Share2, Play, Square, Globe, Zap, FileDown } from 'lucide-react';
import GuruhgaUlashModal from './GuruhgaUlashModal';
import AvtomatikBoshlash from './AvtomatikBoshlash';
import { Textarea } from '@/components/ui/textarea';
import { Document, Paragraph, TextRun, AlignmentType, HeadingLevel, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Toplam, Javob } from '@/types';
import JavobTahlil from './JavobTahlil';

interface UstozNatijalarProps {
  ustozId: string;
  onTahrirlash?: (toplam: Toplam) => void;
}

export default function UstozNatijalar({ ustozId, onTahrirlash }: UstozNatijalarProps) {
  const STORAGE_KEY = `ustoz_tanlangan_toplam_${ustozId}`;

  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [toplamlar, setToplamlar] = useState<Toplam[]>([]);
  const [startToggleYuklanyapti, setStartToggleYuklanyapti] = useState<string | null>(null);
  const [tanlanganToplam, setTanlanganToplam] = useState<Toplam | null>(() => {
    try {
      const saved = localStorage.getItem(`ustoz_tanlangan_toplam_${ustozId}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [javoblar, setJavoblar] = useState<Javob[]>([]);
  const [tahlilModal, setTahlilModal] = useState<{
    kazus: string; togriJavob: string; oquvchiJavob: string;
    batafsil: any; ball: number; maksimalBall: number;
  } | null>(null);
  const [statistikaModal, setStatistikaModal] = useState<Toplam | null>(null);
  const [statistikaJavoblar, setStatistikaJavoblar] = useState<Javob[]>([]);
  const [tahrirlashModal, setTahrirlashModal] = useState<{
    javob: Javob; kazusIndex: number; togriJavob: string;
    oquvchiJavob: string; batafsil: any;
  } | null>(null);
  const [tahrirlashBall, setTahrirlashBall] = useState(0);
  const [tahrirlashIzoh, setTahrirlashIzoh] = useState('');
  const [tahrirlashYuklanyapti, setTahrirlashYuklanyapti] = useState(false);
  const [ulashModal, setUlashModal] = useState<{ kod: string; nomi: string; ommaviy?: boolean; kazuslarSoni?: number; vaqtDaqiqa?: number; ustozIsmi?: string; narx?: number } | null>(null);
  const [avtomatikModal, setAvtomatikModal] = useState<{ kod: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => { toplamlarniYuklash(); }, []);

  useEffect(() => {
    if (tanlanganToplam && javoblar.length === 0) {
      javoblarniQaytaYuklash(tanlanganToplam);
    }
  }, []);

  const javoblarniQaytaYuklash = async (toplam: Toplam) => {
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase.from('javoblar').select('*').eq('toplam_kod', toplam.kod).order('created_at', { ascending: false });
      if (error) throw error;
      setJavoblar(data as Javob[] || []);
    } catch (e: any) { console.error('Javoblar qayta yuklash xatosi:', e); }
    finally { setYuklanyapti(false); }
  };

  const startStopToggle = async (toplam: Toplam) => {
    setStartToggleYuklanyapti(toplam.id);
    const yangiHolat = !(toplam as any).is_active;
    try {
      const { error } = await supabase.from('toplamlar').update({ is_active: yangiHolat }).eq('id', toplam.id);
      if (error) throw error;
      setToplamlar(prev => prev.map(t => t.id === toplam.id ? { ...t, is_active: yangiHolat } as any : t));
      toast({
        title: yangiHolat ? '▶ Kazus boshlandi!' : '⏹ Kazus to\'xtatildi',
        description: yangiHolat ? `"${toplam.mavzu || 'Kazus'}" kazusiga kirish ochildi` : `"${toplam.mavzu || 'Kazus'}" kazusi to'xtatildi`,
      });
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Holatni yangilashda xatolik', variant: 'destructive' });
    } finally { setStartToggleYuklanyapti(null); }
  };

  const toplamlarniYuklash = async () => {
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase.from('toplamlar').select('*').eq('ustoz_id', ustozId).order('created_at', { ascending: false });
      if (error) throw error;
      setToplamlar(data as Toplam[] || []);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Toplamlarni yuklashda xatolik', variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const toplamniTanlash = async (toplam: Toplam) => {
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase.from('javoblar').select('*').eq('toplam_kod', toplam.kod).order('created_at', { ascending: false });
      if (error) throw error;
      setTanlanganToplam(toplam);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toplam));
      setJavoblar(data as Javob[] || []);
      if (!data || data.length === 0) toast({ title: 'Javoblar yo\'q', description: 'Bu toplam uchun hali javob yo\'q' });
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Natijalarni yuklashda xatolik', variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const ortachaBallHisoblash = (baho: any[]) => {
    if (!baho || baho.length === 0) return 0;
    return Math.round(baho.reduce((sum: number, b: any) => sum + b.ball, 0) / baho.length);
  };

  const qaytish = () => {
    setTanlanganToplam(null);
    setJavoblar([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const statistikaKorsatish = async (toplam: Toplam) => {
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase.from('javoblar').select('*').eq('toplam_kod', toplam.kod).order('created_at', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) { toast({ title: 'Javoblar yo\'q', description: 'Hali javob yo\'q' }); return; }
      const statistika = data.map(j => ({ ...j, ortachaBall: ortachaBallHisoblash(j.baho) })).sort((a, b) => {
        if (a.ortachaBall !== b.ortachaBall) return b.ortachaBall - a.ortachaBall;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      setStatistikaModal(toplam);
      setStatistikaJavoblar(statistika as Javob[]);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Statistikani yuklashda xatolik', variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const tahrirlashModalniOchish = (javob: Javob, kazusIndex: number, togriJavob: string, oquvchiJavob: string, batafsil: any, joriyBall: number, joriyIzoh: string) => {
    setTahrirlashModal({ javob, kazusIndex, togriJavob, oquvchiJavob, batafsil });
    setTahrirlashBall(joriyBall);
    setTahrirlashIzoh(joriyIzoh);
  };

  const bahoTahrirlashniSaqlash = async () => {
    if (!tahrirlashModal) return;
    if (tahrirlashBall < 0 || tahrirlashBall > 30) { toast({ title: 'Xato', description: 'Ball 0-30 orasida bo\'lishi kerak', variant: 'destructive' }); return; }
    if (!tahrirlashIzoh.trim()) { toast({ title: 'Xato', description: 'Izoh yozish majburiy', variant: 'destructive' }); return; }
    setTahrirlashYuklanyapti(true);
    try {
      const yangiBaho = tahrirlashModal.javob.baho.map((b: any) =>
        b.kazus_index === tahrirlashModal.kazusIndex ? { ...b, ball: tahrirlashBall, izoh: tahrirlashIzoh.trim() } : b
      );
      const { error } = await supabase.from('javoblar').update({ baho: yangiBaho }).eq('id', tahrirlashModal.javob.id);
      if (error) throw error;
      setJavoblar(prev => prev.map(j => j.id === tahrirlashModal.javob.id ? { ...j, baho: yangiBaho } : j));
      toast({ title: 'Muvaffaqiyatli!', description: 'Baho yangilandi' });
      setTahrirlashModal(null);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Tahrirlashda xatolik', variant: 'destructive' });
    } finally { setTahrirlashYuklanyapti(false); }
  };

  // ── PDF natijalar yuklash ──
  const pdfNatijalarYuklash = async (toplam: Toplam, javoblarList: Javob[]) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // Sarlavha
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(toplam.mavzu || 'Toplam natijalari', pageW / 2, y, { align: 'center' });
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Kod: ${toplam.kod} | Ustoz: ${toplam.ustoz_ismi} | Sana: ${new Date().toLocaleDateString('uz-UZ')}`, pageW / 2, y, { align: 'center' });
      y += 10;

      // Jadval sarlavhasi
      doc.setFillColor(30, 80, 180);
      doc.rect(margin, y, pageW - margin * 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('#', margin + 2, y + 5.5);
      doc.text("O'quvchi", margin + 8, y + 5.5);
      const kazuslarSoni = toplam.kazuslar.length;
      const kazusW = Math.min(10, (pageW - margin * 2 - 60) / kazuslarSoni);
      for (let k = 0; k < kazuslarSoni; k++) {
        doc.text(`K${k + 1}`, margin + 55 + k * kazusW, y + 5.5, { align: 'center' });
      }
      doc.text('Jami', pageW - margin - 15, y + 5.5, { align: 'center' });
      doc.text('%', pageW - margin - 5, y + 5.5, { align: 'right' });
      y += 8;
      doc.setTextColor(0, 0, 0);

      // Saralangan javoblar
      const sorted = [...javoblarList].sort((a, b) => {
        const aB = a.baho?.reduce((s: number, b: any) => s + b.ball, 0) || 0;
        const bB = b.baho?.reduce((s: number, b: any) => s + b.ball, 0) || 0;
        return bB - aB;
      });

      sorted.forEach((javob, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const rowH = 7;
        const isEven = idx % 2 === 0;
        if (isEven) {
          doc.setFillColor(245, 247, 255);
          doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`${idx + 1}`, margin + 2, y + 4.5);
        const ism = javob.oquvchi_ismi.length > 22 ? javob.oquvchi_ismi.substring(0, 22) + '...' : javob.oquvchi_ismi;
        doc.text(ism, margin + 8, y + 4.5);

        let jamiB = 0;
        const maks = javob.baho.length * 30;
        javob.baho.forEach((baho: any) => {
          const b = baho.ball || 0;
          jamiB += b;
          const kIdx = baho.kazus_index;
          if (kIdx < kazuslarSoni) {
            const xPos = margin + 55 + kIdx * kazusW;
            const color = b >= 21 ? [34, 197, 94] : b >= 15 ? [234, 179, 8] : [239, 68, 68];
            doc.setTextColor(color[0], color[1], color[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(`${b}`, xPos, y + 4.5, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
          }
        });
        doc.setFont('helvetica', 'bold');
        doc.text(`${jamiB}/${maks}`, pageW - margin - 15, y + 4.5, { align: 'center' });
        const foiz = maks > 0 ? Math.round((jamiB / maks) * 100) : 0;
        const fColor = foiz >= 70 ? [34, 197, 94] : foiz >= 50 ? [234, 179, 8] : [239, 68, 68];
        doc.setTextColor(fColor[0], fColor[1], fColor[2]);
        doc.text(`${foiz}%`, pageW - margin - 5, y + 4.5, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        y += rowH;
      });

      // Statistika qatori
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const jamiO = sorted.length;
      const avgBall = jamiO > 0 ? Math.round(sorted.reduce((s, j) => s + (j.baho?.reduce((b: number, x: any) => b + x.ball, 0) || 0), 0) / jamiO) : 0;
      doc.text(`Jami: ${jamiO} ta o'quvchi | O'rtacha ball: ${avgBall}/${toplam.kazuslar.length * 30}`, margin, y);

      doc.save(`${toplam.mavzu || 'Natijar'}_${toplam.kod}.pdf`);
      toast({ title: "PDF yuklandi!", description: `${jamiO} ta o'quvchi natijasi` });
    } catch (e: any) {
      toast({ title: 'Xato', description: 'PDF yaratishda xatolik: ' + e.message, variant: 'destructive' });
    }
  };

  const docxYuklash = async (toplam: Toplam) => {
    try {
      const doc = new Document({
        sections: [{
          properties: { page: { margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) } } },
          children: [
            new Paragraph({ text: toplam.mavzu || 'Toplam', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
            new Paragraph({ children: [new TextRun({ text: `Kod: ${toplam.kod} | Ustoz: ${toplam.ustoz_ismi}`, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
            ...toplam.kazuslar.flatMap((kazus, index) => [
              new Paragraph({ children: [new TextRun({ text: `${index + 1}. Kazus:`, bold: true, size: 28 })], spacing: { before: 400, after: 200 } }),
              new Paragraph({ text: kazus.kazus, spacing: { after: 300 } }),
              new Paragraph({ children: [new TextRun({ text: 'Javobi:', bold: true, size: 28 })], spacing: { after: 200 } }),
              new Paragraph({ text: kazus.javob, spacing: { after: 600 } }),
            ]),
          ],
        }],
      });
      const { Packer } = await import('docx');
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${toplam.mavzu || 'Toplam'}_${toplam.kod}.docx`);
      toast({ title: 'Muvaffaqiyatli!', description: 'Toplam DOCX formatda yuklandi' });
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Faylni yuklashda xatolik', variant: 'destructive' });
    }
  };

  // ── Batafsil natijalar ──
  if (tanlanganToplam && javoblar.length > 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <Card>
          <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-2xl mb-2">{tanlanganToplam.mavzu || 'Toplam natijalar'}</CardTitle>
                <div className="flex items-center gap-6 text-sm text-blue-100">
                  <span>Kod: {tanlanganToplam.kod}</span>
                  <span>Ustoz: {tanlanganToplam.ustoz_ismi}</span>
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" />{javoblar.length} o'quvchi</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => pdfNatijalarYuklash(tanlanganToplam, javoblar)} variant="secondary" className="bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600">
                  <FileDown className="mr-2 h-4 w-4" />PDF
                </Button>
                <Button onClick={() => docxYuklash(tanlanganToplam)} variant="secondary" className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600">
                  <Download className="mr-2 h-4 w-4" />DOCX
                </Button>
                <Button onClick={() => statistikaKorsatish(tanlanganToplam)} variant="secondary" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600">
                  <TrendingUp className="mr-2 h-4 w-4" />Statistika
                </Button>
                <Button onClick={qaytish} variant="secondary">Orqaga</Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Ixcham jadval sarlavha */}
        <div className="bg-[hsl(221,83%,53%)] text-white rounded-t-xl px-3 py-2 grid items-center text-xs font-bold" style={{gridTemplateColumns: '2rem 1fr auto auto'}}>
          <span>#</span>
          <span>O'quvchi</span>
          <span className="text-center pr-2">Kazuslar</span>
          <span className="text-right">Ball</span>
        </div>
        <div className="border-2 border-[hsl(221,83%,53%)] rounded-b-xl overflow-hidden">
          {javoblar.map((javob, rowIdx) => {
            const jamiB = javob.baho?.reduce((s: number, b: any) => s + (b.ball || 0), 0) || 0;
            const maksimalBall = javob.baho.length * 30;
            const foiz = maksimalBall > 0 ? Math.round((jamiB / maksimalBall) * 100) : 0;
            return (
              <div
                key={javob.id}
                className={`grid items-center px-3 py-1.5 border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors ${
                  rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                }`}
                style={{gridTemplateColumns: '2rem 1fr auto auto'}}
              >
                {/* # */}
                <span className="text-xs text-gray-400 font-bold">{rowIdx + 1}</span>
                {/* Ism + vaqt */}
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate leading-tight">{javob.oquvchi_ismi}</p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(javob.created_at).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {/* Kazus ballari — mini tugmalar */}
                <div className="flex items-center gap-0.5 px-2">
                  {javob.baho.map((baho: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-0.5">
                      <button
                        onClick={() => {
                          const kazus = tanlanganToplam.kazuslar[baho.kazus_index];
                          const oquvchiJavob = javob.javoblar.find((j: any) => j.kazus_index === baho.kazus_index);
                          setTahlilModal({ kazus: kazus?.kazus || '', togriJavob: kazus?.javob || '', oquvchiJavob: oquvchiJavob?.javob || '', batafsil: baho.batafsil_tahlil || {}, ball: baho.ball, maksimalBall: 30 });
                        }}
                        className={`w-8 h-8 rounded-lg text-xs font-black border-2 transition-all hover:scale-105 ${
                          baho.ball >= 21 ? 'bg-green-100 border-green-400 text-green-700' : baho.ball >= 15 ? 'bg-yellow-100 border-yellow-400 text-yellow-700' : 'bg-red-100 border-red-400 text-red-700'
                        }`}
                        title={`Kazus ${baho.kazus_index + 1}: ${baho.ball}/30`}
                      >{baho.ball}</button>
                      <button
                        onClick={() => {
                          const kazus = tanlanganToplam.kazuslar[baho.kazus_index];
                          const oquvchiJavob = javob.javoblar.find((j: any) => j.kazus_index === baho.kazus_index);
                          tahrirlashModalniOchish(javob, baho.kazus_index, kazus?.javob || '', oquvchiJavob?.javob || '', baho.batafsil_tahlil || {}, baho.ball, baho.izoh);
                        }}
                        className="w-8 h-4 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded text-[8px] text-blue-700 font-bold"
                        title="Tahrirlash"
                      >✏️</button>
                    </div>
                  ))}
                </div>
                {/* Ball + foiz */}
                <div className="text-right">
                  <span className={`text-sm font-black ${
                    foiz >= 70 ? 'text-green-600' : foiz >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>{jamiB}</span>
                  <span className="text-[10px] text-gray-400">/{maksimalBall}</span>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${
                        foiz >= 70 ? 'bg-green-500' : foiz >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} style={{ width: `${foiz}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500">{foiz}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {tahrirlashModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Edit className="h-7 w-7" />Baho tahrirlash</h3>
                    <p className="text-blue-100">{tahrirlashModal.javob.oquvchi_ismi} • Kazus {tahrirlashModal.kazusIndex + 1}</p>
                  </div>
                  <Button onClick={() => setTahrirlashModal(null)} variant="secondary" size="sm" disabled={tahrirlashYuklanyapti}>Yopish</Button>
                </div>
              </div>
              <div className="overflow-y-auto p-6 flex-1 space-y-6">
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">To'g'ri javob:</label>
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-gray-800 whitespace-pre-wrap">{tahrirlashModal.togriJavob}</div>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">O'quvchi javobi:</label>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-gray-800 whitespace-pre-wrap">{tahrirlashModal.oquvchiJavob || 'Javob berilmagan'}</div>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Ball (0-30):</label>
                  <div className="flex items-center gap-4">
                    <input type="number" min="0" max="30" value={tahrirlashBall} onChange={(e) => setTahrirlashBall(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))} className="w-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[hsl(221,83%,53%)] text-2xl font-bold text-center" />
                    <span className="text-gray-500 text-lg">/ 30</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 block">Ustoz izohi: <span className="text-red-500">*</span></label>
                  <Textarea placeholder="O'quvchi javobiga izoh yozing..." value={tahrirlashIzoh} onChange={(e) => setTahrirlashIzoh(e.target.value)} rows={6} className="resize-none border-2" />
                </div>
                <Button onClick={bahoTahrirlashniSaqlash} disabled={tahrirlashYuklanyapti} className="w-full" size="lg">
                  {tahrirlashYuklanyapti ? 'Saqlanmoqda...' : 'Saqlash'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {tahlilModal && tahlilModal.batafsil && (
          <JavobTahlil tahlil={tahlilModal.batafsil} ball={tahlilModal.ball} maksimalBall={tahlilModal.maksimalBall} onClose={() => setTahlilModal(null)} />
        )}

        {statistikaModal && statistikaJavoblar.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2 flex items-center gap-2"><Trophy className="h-7 w-7" />Toplam statistikasi</h3>
                    <p className="text-yellow-100">{statistikaModal.mavzu || 'Mavzusiz'} • Kod: {statistikaModal.kod}</p>
                  </div>
                  <Button onClick={() => { setStatistikaModal(null); setStatistikaJavoblar([]); }} variant="secondary" size="sm">Yopish</Button>
                </div>
              </div>
              <div className="overflow-y-auto p-6 flex-1 space-y-4">
                {statistikaJavoblar.map((javob, index) => {
                  const ortachaBall = ortachaBallHisoblash(javob.baho);
                  const maksimalBall = javob.baho.length * 30;
                  const foiz = Math.round((ortachaBall / maksimalBall) * 100);
                  const topClass = index === 0 ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100' : index === 1 ? 'border-gray-400 bg-gradient-to-br from-gray-50 to-gray-100' : index === 2 ? 'border-orange-400 bg-gradient-to-br from-orange-50 to-orange-100' : 'border-gray-200';
                  const medalIcon = index === 0 ? <Trophy className="h-8 w-8 text-yellow-500" /> : index === 1 ? <Medal className="h-8 w-8 text-gray-500" /> : index === 2 ? <Medal className="h-8 w-8 text-orange-500" /> : null;
                  return (
                    <div key={javob.id} className={`border-2 ${topClass} rounded-lg p-4 hover:shadow-lg transition-all`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-md">
                            {medalIcon || <span className="text-xl font-bold text-gray-700">{index + 1}</span>}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{javob.oquvchi_ismi}</p>
                            <p className="text-sm text-gray-500 mt-1">{new Date(javob.created_at).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-baseline gap-2">
                            <span className={`text-4xl font-bold ${ortachaBall >= 21 ? 'text-green-600' : ortachaBall >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{ortachaBall}</span>
                            <span className="text-2xl text-gray-500">/ {maksimalBall}</span>
                          </div>
                          <div className={`text-sm font-semibold mt-1 ${foiz >= 70 ? 'text-green-600' : foiz >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{foiz}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Javoblar yo'q ──
  if (tanlanganToplam && javoblar.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{tanlanganToplam.mavzu || 'Toplam'}</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Kod: {tanlanganToplam.kod} • {tanlanganToplam.kazuslar.length} ta kazus</p>
              </div>
              <Button onClick={qaytish} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Orqaga</Button>
            </div>
          </CardHeader>
          <CardContent className="py-12 text-center text-gray-500">
            <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Hali hech kim yechmagan</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Toplamlar ro'yxati ──
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />Mening toplamlarim
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">START — o'quvchilar kira oladi • STOP — kirish bloklangan</p>
        </CardHeader>
      </Card>

      {yuklanyapti ? (
        <Card><CardContent className="py-12 text-center">
          <div className="animate-spin h-12 w-12 border-4 border-[hsl(221,83%,53%)] border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-4">Yuklanmoqda...</p>
        </CardContent></Card>
      ) : toplamlar.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-500">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Hali toplam yaratilmagan</p>
          <p className="text-sm mt-2">"Toplam yaratish" bo'limidan yangi toplam yarating</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {toplamlar.map((toplam) => {
            const javoblarSoni = javoblar.filter(j => j.toplam_kod === toplam.kod).length;
            const isActive = (toplam as any).is_active;
            const isOmmaviy = (toplam as any).ommaviy;
            return (
              <Card key={toplam.id} className={`transition-all border-2 ${isActive ? 'border-green-400 shadow-green-100 shadow-md' : 'border-gray-200 hover:border-[hsl(221,83%,53%)] hover:shadow-md'}`}>
                <CardHeader className={`${isActive ? 'bg-gradient-to-br from-green-50 to-emerald-50' : 'bg-gradient-to-br from-[hsl(221,83%,53%)]/10 to-[hsl(221,83%,43%)]/5'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => toplamniTanlash(toplam)}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className={`text-lg font-bold ${isActive ? 'text-green-700' : 'text-[hsl(221,83%,53%)]'}`}>{toplam.mavzu || 'Mavzusiz'}</div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${isActive ? 'bg-green-100 border-green-400 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          {isActive ? 'FAOL' : "TO'XTATILGAN"}
                        </span>
                        {isOmmaviy && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 border border-emerald-300 text-emerald-700">
                            <Globe className="h-3 w-3" />Ommaviy
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">Kod:</div>
                      <div className={`text-2xl font-bold tracking-wider ${isActive ? 'text-green-700' : 'text-[hsl(221,83%,53%)]'}`}>{toplam.kod}</div>
                    </div>
                    <div className="flex flex-col gap-2 ml-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); startStopToggle(toplam); }}
                        disabled={startToggleYuklanyapti === toplam.id}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${isActive ? 'bg-red-600 border-red-600 text-white hover:bg-red-700' : 'bg-green-600 border-green-600 text-white hover:bg-green-700'}`}
                      >
                        {startToggleYuklanyapti === toplam.id ? (
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : isActive ? (
                          <><Square className="h-4 w-4" />STOP</>
                        ) : (
                          <><Play className="h-4 w-4" />START</>
                        )}
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setAvtomatikModal({ kod: toplam.kod }); }}
                          className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-600"
                          title="Avtomatik boshlash (Qat'iy Nazorat)"
                        >
                          <Zap className="h-4 w-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setUlashModal({ kod: toplam.kod, nomi: toplam.mavzu || 'Mavzusiz', ommaviy: isOmmaviy, kazuslarSoni: toplam.kazuslar?.length, vaqtDaqiqa: (toplam as any).vaqt_daqiqa || 30, ustozIsmi: toplam.ustoz_ismi, narx: (toplam as any).narx }); }} className="p-1.5 hover:bg-green-100 rounded-lg transition-colors text-green-600" title="Ulashish va ommaviy qilish">
                          <Share2 className="h-4 w-4" />
                        </button>
                        {onTahrirlash && (
                          <button onClick={(e) => { e.stopPropagation(); onTahrirlash(toplam); }} className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors text-blue-600" title="Tahrirlash">
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => toplamniTanlash(toplam)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500" title="Natijalar">
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Kazuslar:</span>
                    <span className={`font-semibold ${isActive ? 'text-green-600' : 'text-[hsl(221,83%,53%)]'}`}>{toplam.kazuslar.length} ta</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Yechganlar:</span>
                    <span className="font-semibold text-green-600">{javoblarSoni} kishi</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 pt-2 border-t">
                    <Calendar className="h-3 w-3" />{new Date(toplam.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Avtomatik boshlash modal */}
      {avtomatikModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAvtomatikModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-700 to-green-700 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl"><Zap className="h-5 w-5" /></div>
                <div>
                  <p className="font-black text-lg">Qat'iy Nazorat</p>
                  <p className="text-emerald-100 text-xs">Kod: {avtomatikModal.kod}</p>
                </div>
              </div>
              <button onClick={() => setAvtomatikModal(null)} className="hover:bg-white/20 p-2 rounded-xl transition-colors text-white font-bold text-lg leading-none">&times;</button>
            </div>
            <div className="p-4">
              <AvtomatikBoshlash ustozId={ustozId} defaultKod={avtomatikModal.kod} tur="kazus" />
            </div>
          </div>
        </div>
      )}

      {ulashModal && (
        <GuruhgaUlashModal
          isOpen={!!ulashModal}
          onClose={() => setUlashModal(null)}
          tur="toplam"
          kod={ulashModal.kod}
          nomi={ulashModal.nomi}
          ustozId={ustozId}
          ommaviyHolat={ulashModal.ommaviy}
          savollarSoni={ulashModal.kazuslarSoni}
          vaqtDaqiqa={ulashModal.vaqtDaqiqa}
          ustozIsmi={ulashModal.ustozIsmi}
          narx={ulashModal.narx}
          onOmmaviyOzgartirish={(yangiHolat) => {
            setToplamlar(prev => prev.map(t => t.kod === ulashModal.kod ? { ...t, ommaviy: yangiHolat } as any : t));
          }}
        />
      )}
    </div>
  );
}
