import { useState, useEffect } from 'react';
import { Trophy, Medal, TrendingUp, Lock, LogIn, Clock, FileText, Users, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ReytigSatri {
  oquvchi_ismi: string;
  testlar_soni: number;
  ortacha_foiz: number;
  jami_togri: number;
  jami_savol: number;
}

interface TestReyting {
  test_nomi: string;
  kod: string;
  ustoz_ismi: string;
  qatnashuvchi: number;
  ortacha_foiz: number;
}

export default function ReytingSahifa() {
  const { isAuthenticated, user } = useAuth();
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [umumiyReyting, setUmumiyReyting] = useState<ReytigSatri[]>([]);
  const [testReyting, setTestReyting] = useState<TestReyting[]>([]);
  const [aktifTab, setAktifTab] = useState<'umumiy' | 'testlar'>('umumiy');

  useEffect(() => {
    if (isAuthenticated) yuklash();
  }, [isAuthenticated]);

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      // Umumiy reyting — test_javoblar jadvalidan
      const { data: javoblar } = await supabase
        .from('test_javoblar')
        .select('oquvchi_ismi, togri_soni, xato_soni, javob_berilmagan, foiz, test_kod');

      if (javoblar) {
        const map: Record<string, { testlar: number; foizSum: number; togri: number; savol: number }> = {};
        javoblar.forEach(j => {
          if (!map[j.oquvchi_ismi]) map[j.oquvchi_ismi] = { testlar: 0, foizSum: 0, togri: 0, savol: 0 };
          map[j.oquvchi_ismi].testlar++;
          map[j.oquvchi_ismi].foizSum += j.foiz || 0;
          map[j.oquvchi_ismi].togri += j.togri_soni || 0;
          map[j.oquvchi_ismi].savol += (j.togri_soni || 0) + (j.xato_soni || 0) + (j.javob_berilmagan || 0);
        });
        const satrlari: ReytigSatri[] = Object.entries(map)
          .map(([ism, d]) => ({ oquvchi_ismi: ism, testlar_soni: d.testlar, ortacha_foiz: Math.round(d.foizSum / d.testlar), jami_togri: d.togri, jami_savol: d.savol }))
          .sort((a, b) => b.ortacha_foiz - a.ortacha_foiz || b.testlar_soni - a.testlar_soni)
          .slice(0, 50);
        setUmumiyReyting(satrlari);
      }

      // Test reytingi
      const { data: testlar } = await supabase
        .from('testlar')
        .select('test_nomi, kod, ustoz_ismi')
        .eq('ommaviy', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (testlar) {
        const testReytingData: TestReyting[] = await Promise.all(testlar.map(async t => {
          const { data: tj } = await supabase
            .from('test_javoblar')
            .select('foiz')
            .eq('test_kod', t.kod);
          const foizlar = (tj || []).map((j: any) => j.foiz || 0);
          return {
            test_nomi: t.test_nomi,
            kod: t.kod,
            ustoz_ismi: t.ustoz_ismi,
            qatnashuvchi: foizlar.length,
            ortacha_foiz: foizlar.length > 0 ? Math.round(foizlar.reduce((a, b) => a + b, 0) / foizlar.length) : 0,
          };
        }));
        setTestReyting(testReytingData.sort((a, b) => b.qatnashuvchi - a.qatnashuvchi));
      }
    } finally {
      setYuklanyapti(false);
    }
  };

  const menimReyting = isAuthenticated && user
    ? umumiyReyting.findIndex(r => r.oquvchi_ismi === `${user.ism} ${user.familiya}`) + 1
    : 0;

  // LOGIN TALAB
  if (!isAuthenticated) {
    return (
      <div className="max-w-lg mx-auto pt-20 text-center space-y-6 animate-in fade-in duration-300">
        <div className="bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-100">
          <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <Trophy className="h-10 w-10 text-blue-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3">Reyting</h2>
          <p className="text-slate-500 mb-2 font-medium">Reytingingizni ko'rish uchun tizimga kiring</p>
          <p className="text-slate-400 text-sm mb-8">O'quvchilar o'rtasidagi umumiy natijalar jadvalini ko'rish uchun hisobingizga kiring</p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
            className="inline-flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-base shadow-xl shadow-blue-200 transition-all hover:scale-105 active:scale-95"
          >
            <LogIn className="h-5 w-5" /> Tizimga kirish
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[{ icon: Trophy, label: "Top o'quvchilar", color: 'amber' }, { icon: BarChart2, label: 'Test statistikasi', color: 'blue' }, { icon: TrendingUp, label: 'O\'rtacha natijalar', color: 'green' }].map((c, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm opacity-50 blur-[1px]">
              <c.icon className="h-6 w-6 text-slate-300 mx-auto mb-2" />
              <p className="text-[10px] font-bold text-slate-400 text-center">{c.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-3 rounded-xl shadow-lg shadow-amber-200">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Reyting</h1>
            <p className="text-gray-400 text-xs mt-0.5">O'quvchilar natijalari jadvali</p>
          </div>
        </div>
        {menimReyting > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-center">
            <p className="text-xs text-blue-500 font-bold">Sizning o'rningiz</p>
            <p className="text-2xl font-black text-blue-600">#{menimReyting}</p>
          </div>
        )}
      </div>

      {/* TABS */}
      <div className="flex gap-2">
        {[{ id: 'umumiy', label: "Umumiy reyting", icon: Trophy }, { id: 'testlar', label: 'Testlar statistikasi', icon: FileText }].map(tab => (
          <button key={tab.id} onClick={() => setAktifTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${aktifTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}>
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {yuklanyapti ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Yuklanmoqda...</p>
        </div>
      ) : aktifTab === 'umumiy' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {umumiyReyting.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Hali natijalar yo'q</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[2rem_1fr_auto_auto_auto] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>#</span>
                <span>O'quvchi</span>
                <span className="text-center">Testlar</span>
                <span className="text-center">To'g'ri</span>
                <span className="text-right">O'rtacha</span>
              </div>
              {umumiyReyting.map((satir, idx) => {
                const mening = user && satir.oquvchi_ismi === `${user.ism} ${user.familiya}`;
                return (
                  <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                    className={`grid grid-cols-[2rem_1fr_auto_auto_auto] gap-2 px-4 py-3 border-b border-slate-50 items-center ${mening ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                      idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </div>
                    <div>
                      <p className={`text-sm font-bold truncate ${mening ? 'text-blue-700' : 'text-slate-800'}`}>{satir.oquvchi_ismi}</p>
                      {mening && <p className="text-[9px] text-blue-500 font-black uppercase">Siz</p>}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-700">{satir.testlar_soni}</p>
                      <p className="text-[9px] text-slate-400">test</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-green-600">{satir.jami_togri}</p>
                      <p className="text-[9px] text-slate-400">/{satir.jami_savol}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-base font-black ${satir.ortacha_foiz >= 85 ? 'text-green-600' : satir.ortacha_foiz >= 70 ? 'text-blue-600' : satir.ortacha_foiz >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {satir.ortacha_foiz}%
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {testReyting.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Hali testlar yo'q</p>
            </div>
          ) : (
            testReyting.map((test, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-4 px-5 py-4 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center font-black text-blue-600 text-sm shrink-0">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">{test.test_nomi}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{test.ustoz_ismi}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-700">{test.qatnashuvchi}</p>
                    <p className="text-[9px] text-slate-400">qatnashdi</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-black ${test.ortacha_foiz >= 70 ? 'text-green-600' : test.ortacha_foiz >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{test.ortacha_foiz}%</p>
                    <p className="text-[9px] text-slate-400">o'rtacha</p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
