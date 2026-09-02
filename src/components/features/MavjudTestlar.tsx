import { useState, useEffect, useCallback } from 'react';
import { FileText, Play, Search, Clock, BarChart2, Eye, Share2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import AutoStartWrapper from './AutoStartWrapper';
import { isDemoAvailable, markDemoUsed } from '@/lib/demo';
import { postRouteChange } from '@/lib/deepLink';

const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18 } }
};

export default function MavjudTestlar() {
  const { isAuthenticated } = useAuth();
  const { t } = useLang();
  const [testlar, setTestlar] = useState<any[]>([]);
  const [korishlar, setKorishlar] = useState<Record<string, number>>({});
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [qidiruv, setQidiruv] = useState('');
  const [boshlashModal, setBoshlashModal] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => { yuklash(); }, []);

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase.from('testlar').select('*').eq('ommaviy', true).order('created_at', { ascending: false });
      if (error) throw error;
      setTestlar(data || []);

      if (data && data.length > 0) {
        const kodlar = data.map((t: any) => t.kod);
        const { data: javoblarData } = await supabase
          .from('test_javoblar')
          .select('test_kod, oquvchi_ismi')
          .in('test_kod', kodlar);

        const korishMap: Record<string, number> = {};
        (javoblarData || []).forEach((j: any) => {
          korishMap[j.test_kod] = (korishMap[j.test_kod] || 0) + 1;
        });
        setKorishlar(korishMap);
      }
    } catch (e) { toast({ title: t('common.error'), description: t('common.loading'), variant: 'destructive' }); }
    finally { setYuklanyapti(false); }
  };

  const [copiedKod, setCopiedKod] = useState<string | null>(null);

  const handleStartAttempt = (test: any) => {
    if (!isAuthenticated) {
      if (isDemoAvailable('test')) {
        markDemoUsed('test');
        setBoshlashModal(test);
      } else {
        window.dispatchEvent(new CustomEvent('open-login-modal'));
      }
      return;
    }
    if (test.is_active) {
      setBoshlashModal(test);
    } else {
      toast({ title: t('sinov.waiting_title'), description: t('tests.not_active_msg') });
    }
  };

  const handleTestOpen = useCallback((test: any) => {
    postRouteChange('testlar/' + test.kod);
    handleStartAttempt(test);
  }, [isAuthenticated]);

  const handleShare = (e: React.MouseEvent, test: any) => {
    e.stopPropagation();
    const url = window.location.origin + window.location.pathname + '?tab=testlar/' + test.kod;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedKod(test.kod);
      setTimeout(() => setCopiedKod(null), 2000);
      toast({ title: '✅ Havola nusxalandi!' });
    });
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const { kod } = (e as CustomEvent).detail || {};
      if (!kod) return;
      const test = testlar.find(t => t.kod === kod);
      if (test) setBoshlashModal(test);
    };
    window.addEventListener('deeplink-test', handler);
    return () => window.removeEventListener('deeplink-test', handler);
  }, [testlar]);

  const filteredTestlar = testlar.filter(t =>
    t.test_nomi.toLowerCase().includes(qidiruv.toLowerCase()) ||
    t.kod.includes(qidiruv)
  );

  if (boshlashModal) {
    return (
      <AutoStartWrapper
        kod={boshlashModal.kod}
        tur="test"
        onOrqaga={() => { setBoshlashModal(null); }}
      />
    );
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="space-y-5 max-w-6xl mx-auto">

      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-200">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">{t('tests.title')}</h1>
            <p className="text-gray-400 text-xs mt-0.5">{t('tests.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder={t('tests.search')}
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          className="pl-11 h-12 bg-white border-none shadow-sm rounded-xl text-sm"
        />
      </div>

      {yuklanyapti ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-44 rounded-[20px] animate-pulse"
              style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F5EFE0' }} />
          ))}
        </div>
      ) : filteredTestlar.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">{t('tests.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTestlar.map((test, idx) => {
            const isEven = idx % 2 === 0;
            const bg = isEven ? '#FFFFFF' : '#F5EFE0';
            const shadowColor = '#0A0A0A';
            return (
              <div
                key={test.id}
                className="nb-card group flex flex-col cursor-pointer p-4"
                style={{
                  background: bg,
                  border: '3px solid #0A0A0A',
                  borderRadius: 16,
                  boxShadow: `6px 6px 0px ${shadowColor}`,
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px, -2px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `4px 4px 0px ${shadowColor}`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translate(0, 0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `6px 6px 0px ${shadowColor}`;
                }}
              >
                {/* Status + kod */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                    style={{
                      border: '2px solid #0A0A0A',
                      borderRadius: 6,
                      background: test.is_active ? '#D1FAE5' : '#F3F4F6',
                      color: test.is_active ? '#065F46' : '#6B7280',
                    }}
                  >
                    {test.is_active ? t('tests.active') : t('tests.waiting')}
                  </span>
                  <span className="text-[9px] font-mono font-black text-gray-400">#{test.kod}</span>
                </div>

                {/* Sarlavha */}
                <h3 className="text-sm font-black text-gray-900 mb-3 line-clamp-2 flex-1 leading-snug group-hover:text-blue-700 transition-colors">
                  {test.test_nomi}
                </h3>

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-600">
                    <Clock className="h-3 w-3" /> {test.vaqt_daqiqa} {t('tests.min')}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-600">
                    <BarChart2 className="h-3 w-3" /> {test.savollar?.length || 0} {t('tests.questions')}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-violet-600">
                    <Eye className="h-3 w-3" /> {korishlar[test.kod] || 0}
                  </div>
                </div>

                {/* Footer */}
                <div
                  className="mt-auto pt-2 flex items-center justify-between"
                  style={{ borderTop: '2px solid #0A0A0A' }}
                >
                  <div className="flex items-center gap-1">
                    <p className="text-[9px] text-gray-500 font-bold truncate max-w-[60px]">
                      {test.ustoz_ismi?.split(' ')[0]}
                    </p>
                    <button
                      onClick={(e) => handleShare(e, test)}
                      className="p-1 rounded-md hover:bg-black/5 transition-colors"
                      title="Havolani nusxalash"
                    >
                      {copiedKod === test.kod
                        ? <Check className="h-3 w-3 text-green-600" />
                        : <Share2 className="h-3 w-3 text-gray-400" />}
                    </button>
                  </div>
                  {!isAuthenticated ? (
                    <button
                      onClick={() => handleTestOpen(test)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black transition-all active:scale-95"
                      style={{
                        border: '2px solid #0A0A0A',
                        borderRadius: 8,
                        background: '#D1FAE5',
                        color: '#065F46',
                        boxShadow: '2px 2px 0px #0A0A0A',
                      }}
                    >
                      {isDemoAvailable('test') ? '🎁 Demo' : 'Kirish'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTestOpen(test)}
                      disabled={!test.is_active}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black transition-all active:scale-95"
                      style={{
                        border: '2px solid #0A0A0A',
                        borderRadius: 8,
                        background: test.is_active ? '#1D4ED8' : '#E5E7EB',
                        color: test.is_active ? '#FFFFFF' : '#9CA3AF',
                        boxShadow: test.is_active ? '2px 2px 0px #0A0A0A' : 'none',
                        cursor: test.is_active ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <Play className="h-3 w-3 fill-current" /> {t('tests.start')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
