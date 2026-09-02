
import { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit, Save, Loader2, CheckCircle, AlertCircle,
  Eye, EyeOff, Key, Cpu, Power, RefreshCw, Zap,
  Sparkles, FileText, Info, Plus, Trash2, GripVertical,
  Copy, Shield, ChevronDown, ChevronUp, FlaskConical,
  CheckCircle2, XCircle, Clock, Database, BookOpen
} from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const SETTING_KEYS = [
  'GROQ_API_KEY',
  'GROQ_API_KEYS',
  'AI_MENTOR_MODEL',
  'AI_MENTOR_FAOL',
  'AI_MENTOR_SYSTEM_INSTRUCTION',
];

const ONSPACE_MODELLAR = [
  { label: 'Gemini 3 Flash Preview ✅ (Tavsiya)', value: 'google/gemini-3-flash-preview' },
  { label: 'Gemini 2.5 Flash Lite (Eng tez)', value: 'google/gemini-2.5-flash-lite' },
  { label: 'Gemini 3 Pro Preview (Kuchli)', value: 'google/gemini-3-pro-preview' },
  { label: 'GPT-5 Mini (Tez)', value: 'openai/gpt-5-mini' },
  { label: 'GPT-5.1 (Kuchli)', value: 'openai/gpt-5.1' },
];

const GROQ_MODELLAR = [
  { label: 'Llama 3.3 70B Versatile ✅ (Tavsiya)', value: 'llama-3.3-70b-versatile' },
  { label: 'Llama 3.1 8B Instant (Tez)', value: 'llama-3.1-8b-instant' },
  { label: 'Llama 3.3 70B Speculative Decoding', value: 'llama-3.3-70b-specdec' },
  { label: 'Mixtral 8x7B (Ko\'p tilli)', value: 'mixtral-8x7b-32768' },
  { label: 'Gemma2 9B', value: 'gemma2-9b-it' },
];

type AiProvider = 'onspace' | 'groq';

const DEFAULT_SYSTEM_INSTRUCTION = '';

type TestStatus = 'idle' | 'testing' | 'ok' | 'error' | 'rate_limit';

interface ApiKeyItem {
  id: string;
  value: string;
  visible: boolean;
  label: string;
  testStatus: TestStatus;
  testMsg: string;
  testMs?: number;
}

function maskaKey(key: string): string {
  if (!key || key.length < 12) return key;
  return key.slice(0, 8) + '••••••••' + key.slice(-4);
}

// Alohida API kalitni to'g'ridan-to'g'ri Groq ga test qilish
async function testSingleGroqKey(
  apiKey: string,
  model: string
): Promise<{ ok: boolean; ms: number; xabar: string; isRateLimit: boolean }> {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Salom! Faqat "ok" deb javob ber.' }],
        max_tokens: 10,
        temperature: 0,
      }),
    });
    const ms = Date.now() - t0;
    const data = await res.json();

    if (res.ok && data?.choices?.[0]?.message?.content) {
      return {
        ok: true,
        ms,
        xabar: `✅ Ishlaydi (${ms}ms) — javob: "${data.choices[0].message.content.trim()}"`,
        isRateLimit: false,
      };
    }

    const errMsg =
      data?.error?.message || data?.message || res.statusText || 'Noma\'lum xato';
    const isRL =
      res.status === 429 ||
      errMsg.toLowerCase().includes('rate') ||
      errMsg.toLowerCase().includes('quota');
    return {
      ok: false,
      ms,
      xabar: isRL
        ? `⚠️ 429 Rate Limit — Bu kalit limitga yetgan (${ms}ms)`
        : `❌ Xato ${res.status}: ${errMsg.slice(0, 120)}`,
      isRateLimit: isRL,
    };
  } catch (e: any) {
    const ms = Date.now() - t0;
    return {
      ok: false,
      ms,
      xabar: `❌ Tarmoq xatosi: ${e.message?.slice(0, 100)}`,
      isRateLimit: false,
    };
  }
}

export default function MentorAiSozlamalari() {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [yangiKey, setYangiKey] = useState('');
  const [yangiKeyLabel, setYangiKeyLabel] = useState('');
  const [yangiKeyVisible, setYangiKeyVisible] = useState(false);
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  const [faol, setFaol] = useState(true);
  const [systemInstruction, setSystemInstruction] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [saqlanyapti, setSaqlanyapti] = useState(false);
  const [testYuklanyapti, setTestYuklanyapti] = useState(false);
  const [testNatija, setTestNatija] = useState<{ ok: boolean; xabar: string } | null>(null);
  const [instrOchiq, setInstrOchiq] = useState(false);
  const [qoshForma, setQoshForma] = useState(false);
  const [barchaTestYuklanyapti, setBarchaTestYuklanyapti] = useState(false);
  const [aiProvider, setAiProvider] = useState<AiProvider>('onspace');
  const [indexYuklanyapti, setIndexYuklanyapti] = useState(false);
  const [indexNatija, setIndexNatija] = useState<{ ok: boolean; xabar: string } | null>(null);
  const [chunksCount, setChunksCount] = useState<number | null>(null);
  const { toast } = useToast();

  const yuklash = useCallback(async () => {
    setYuklanyapti(true);
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, text_value, value')
        .in('key', SETTING_KEYS);

      const map: Record<string, any> = {};
      (data || []).forEach((r: any) => {
        if (r.key === 'AI_MENTOR_FAOL') map[r.key] = r.value ?? true;
        else map[r.key] = r.text_value || '';
      });

      const savedModel = map['AI_MENTOR_MODEL'] || 'google/gemini-3-flash-preview';
      setModel(savedModel);
      // Provider aniqlaash
      if (savedModel.startsWith('google/') || savedModel.startsWith('openai/')) {
        setAiProvider('onspace');
      } else {
        setAiProvider('groq');
      }
      setModel(savedModel);
      setFaol(map['AI_MENTOR_FAOL'] ?? true);
      setSystemInstruction(map['AI_MENTOR_SYSTEM_INSTRUCTION'] || '');

      let loadedKeys: ApiKeyItem[] = [];
      const keysJson = map['GROQ_API_KEYS'] || '';
      if (keysJson && keysJson.trim() !== '' && keysJson.trim() !== '[]') {
        try {
          const parsed = JSON.parse(keysJson);
          if (Array.isArray(parsed)) {
            loadedKeys = parsed.map((item: any, i: number) => ({
              id: `key_${Date.now()}_${i}`,
              value: typeof item === 'string' ? item : (item.value || ''),
              label:
                typeof item === 'object' && item.label
                  ? item.label
                  : `API kalit ${i + 1}`,
              visible: false,
              testStatus: 'idle' as TestStatus,
              testMsg: '',
            }));
          }
        } catch {}
      }

      const singleKey = map['GROQ_API_KEY'] || '';
      if (singleKey && singleKey.startsWith('gsk_') && loadedKeys.length === 0) {
        loadedKeys = [
          {
            id: 'key_legacy_0',
            value: singleKey,
            label: 'Asosiy API kalit',
            visible: false,
            testStatus: 'idle',
            testMsg: '',
          },
        ];
      }

      setApiKeys(loadedKeys);

      // Chunk statistikasi
      const { count } = await supabase.from('om_chunks').select('*', { count: 'exact', head: true });
      setChunksCount(count ?? 0);
    } finally {
      setYuklanyapti(false);
    }
  }, []);

  useEffect(() => {
    yuklash();
  }, [yuklash]);

  const keysToJson = (keys: ApiKeyItem[]) =>
    JSON.stringify(
      keys.map(k => ({ value: k.value.trim(), label: k.label.trim() || 'API kalit' }))
    );

  // Material chunklarni qayta indekslash
  const materiallarniIndekslash = async () => {
    setIndexYuklanyapti(true);
    setIndexNatija(null);
    try {
      const { data, error } = await supabase.functions.invoke('chunk-material', {
        body: { action: 'index_all' },
      });
      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { const t = await error.context?.text?.(); if (t) errMsg = t; } catch {}
        }
        setIndexNatija({ ok: false, xabar: `Xato: ${errMsg}` });
        return;
      }
      const { count } = await supabase.from('om_chunks').select('*', { count: 'exact', head: true });
      setChunksCount(count ?? 0);
      setIndexNatija({
        ok: true,
        xabar: `✅ ${data?.indexlangan ?? 0} ta material indekslandi, ${data?.xato ?? 0} ta xato`,
      });
      toast({ title: '✅ Indekslash tugadi!', description: `${data?.indexlangan} ta material AI uchun tayyorlandi` });
    } catch (e: any) {
      setIndexNatija({ ok: false, xabar: e.message });
    } finally {
      setIndexYuklanyapti(false);
    }
  };

  const saqlash = async () => {
    if (aiProvider === 'groq') {
      const validKeysCheck = apiKeys.filter(k => k.value.trim().startsWith('gsk_'));
      if (validKeysCheck.length === 0) {
        toast({
          title: 'Xato',
          description: 'Kamida 1 ta to\'g\'ri Groq API kalit kiriting (gsk_ bilan boshlanadi)',
          variant: 'destructive',
        });
        return;
      }
    }
    setSaqlanyapti(true);
    try {
      const validKeys = apiKeys.filter(k => k.value.trim().startsWith('gsk_'));
      const keysJson = keysToJson(validKeys);
      await Promise.all([
        supabase.from('settings').upsert(
          {
            key: 'GROQ_API_KEYS',
            text_value: aiProvider === 'groq' ? keysJson : '[]',
            value: true,
            tavsif: "Groq API kalitlar ro'yxati (JSON array) — bir biri 429 berganda keyingisiga o'tadi",
          },
          { onConflict: 'key' }
        ),
        supabase.from('settings').upsert(
          {
            key: 'GROQ_API_KEY',
            text_value: aiProvider === 'groq' && validKeys.length > 0 ? validKeys[0].value.trim() : '',
            value: true,
            tavsif: 'Groq API kaliti (birinchi)',
          },
          { onConflict: 'key' }
        ),
        supabase.from('settings').upsert(
          { key: 'AI_MENTOR_MODEL', text_value: model.trim(), value: true, tavsif: 'AI Mentor modeli' },
          { onConflict: 'key' }
        ),
        supabase.from('settings').upsert(
          { key: 'AI_MENTOR_FAOL', text_value: null, value: faol, tavsif: 'AI Mentor chatbot faol/nofaol' },
          { onConflict: 'key' }
        ),
        supabase.from('settings').upsert(
          {
            key: 'AI_MENTOR_SYSTEM_INSTRUCTION',
            text_value: systemInstruction.trim(),
            value: true,
            tavsif: "AI Mentor tizim yo'riqnomasi",
          },
          { onConflict: 'key' }
        ),
      ]);
      toast({
        title: `✅ Saqlandi!`,
        description: 'AI Mentor sozlamalari yangilandi',
      });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setSaqlanyapti(false);
    }
  };

  // Umumiy test (Edge Function orqali)
  const testQilish = async () => {
    setTestYuklanyapti(true);
    setTestNatija(null);
    try {
      const { data, error } = await supabase.functions.invoke('mentor-chat', {
        body: {
          messages: [{ role: 'user', parts: [{ text: 'Salom! Test xabari.' }] }],
          studentContext: { ism: 'Admin', familiya: 'Test' },
        },
      });

      if (error) {
        let errMsg = error.message;
        try {
          const t = await (error as any).context?.text?.();
          if (t) errMsg = t;
        } catch {}
        setTestNatija({ ok: false, xabar: `Xato: ${errMsg}` });
        return;
      }
      if (data?.reply) {
        const keyInfo =
          data.keyIndex !== undefined ? ` (${data.keyIndex + 1}-kalit ishlatildi)` : '';
        setTestNatija({
          ok: true,
          xabar: `✅ Javob keldi (${data.model})${keyInfo}: "${data.reply.slice(0, 120)}..."`,
        });
      } else {
        setTestNatija({ ok: false, xabar: "Bo'sh javob qaytdi" });
      }
    } catch (e: any) {
      setTestNatija({ ok: false, xabar: e.message });
    } finally {
      setTestYuklanyapti(false);
    }
  };

  // Bitta kalitni alohida test qilish
  const testSingleKey = async (id: string) => {
    const item = apiKeys.find(k => k.id === id);
    if (!item) return;
    setApiKeys(prev =>
      prev.map(k => (k.id === id ? { ...k, testStatus: 'testing' as TestStatus, testMsg: '' } : k))
    );
    const result = await testSingleGroqKey(item.value, model);
    const status: TestStatus = result.ok ? 'ok' : result.isRateLimit ? 'rate_limit' : 'error';
    setApiKeys(prev =>
      prev.map(k =>
        k.id === id ? { ...k, testStatus: status, testMsg: result.xabar, testMs: result.ms } : k
      )
    );
  };

  // Barcha kalitlarni ketma-ket test qilish
  const testAllKeys = async () => {
    if (apiKeys.length === 0) return;
    setBarchaTestYuklanyapti(true);
    setApiKeys(prev => prev.map(k => ({ ...k, testStatus: 'testing' as TestStatus, testMsg: '' })));
    for (const item of apiKeys) {
      const result = await testSingleGroqKey(item.value, model);
      const status: TestStatus = result.ok ? 'ok' : result.isRateLimit ? 'rate_limit' : 'error';
      setApiKeys(prev =>
        prev.map(k =>
          k.id === item.id
            ? { ...k, testStatus: status, testMsg: result.xabar, testMs: result.ms }
            : k
        )
      );
      await new Promise(r => setTimeout(r, 300));
    }
    setBarchaTestYuklanyapti(false);
  };

  const keyQosh = () => {
    if (!yangiKey.trim()) return;
    if (!yangiKey.trim().startsWith('gsk_')) {
      toast({
        title: 'Xato',
        description: 'Groq API kalit gsk_ bilan boshlanishi kerak',
        variant: 'destructive',
      });
      return;
    }
    if (apiKeys.some(k => k.value.trim() === yangiKey.trim())) {
      toast({ title: 'Xato', description: "Bu kalit allaqachon qo'shilgan", variant: 'destructive' });
      return;
    }
    const newItem: ApiKeyItem = {
      id: `key_${Date.now()}`,
      value: yangiKey.trim(),
      label: yangiKeyLabel.trim() || `API kalit ${apiKeys.length + 1}`,
      visible: false,
      testStatus: 'idle',
      testMsg: '',
    };
    setApiKeys(prev => [...prev, newItem]);
    setYangiKey('');
    setYangiKeyLabel('');
    setQoshForma(false);
    toast({
      title: "✅ Qo'shildi",
      description: `${newItem.label} ro'yxatga qo'shildi. Saqlashni unutmang!`,
    });
  };

  const keyOchir = (id: string) => setApiKeys(prev => prev.filter(k => k.id !== id));
  const keyVisibleToggle = (id: string) =>
    setApiKeys(prev => prev.map(k => (k.id === id ? { ...k, visible: !k.visible } : k)));

  const keyYuqoriKo = (idx: number) => {
    if (idx === 0) return;
    const arr = [...apiKeys];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setApiKeys(arr);
  };

  const keyPastKo = (idx: number) => {
    if (idx === apiKeys.length - 1) return;
    const arr = [...apiKeys];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setApiKeys(arr);
  };

  const keyKopir = (value: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast({ title: 'Nusxalandi', description: "API kalit clipboard ga ko'chirildi" }))
      .catch(() => {});
  };

  const getTestStatusIcon = (status: TestStatus) => {
    if (status === 'testing') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (status === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'rate_limit') return <Clock className="h-4 w-4 text-amber-500" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    return <FlaskConical className="h-4 w-4 text-gray-400" />;
  };

  const getTestBorderColor = (status: TestStatus, isFirst: boolean) => {
    if (status === 'ok') return 'border-green-300 bg-green-50/50';
    if (status === 'rate_limit') return 'border-amber-300 bg-amber-50/50';
    if (status === 'error') return 'border-red-300 bg-red-50/50';
    if (status === 'testing') return 'border-blue-300 bg-blue-50/50';
    return isFirst ? 'border-violet-300 bg-violet-50/50' : 'border-gray-200 bg-white';
  };

  const inputCls =
    'w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:border-violet-500 bg-gray-50';

  if (yuklanyapti)
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );

  const validKeysCount = apiKeys.filter(k => k.value.trim().startsWith('gsk_')).length;
  const okKeysCount = apiKeys.filter(k => k.testStatus === 'ok').length;
  const rateLimitKeysCount = apiKeys.filter(k => k.testStatus === 'rate_limit').length;
  const testedCount = apiKeys.filter(
    k => k.testStatus !== 'idle' && k.testStatus !== 'testing'
  ).length;

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* ── Header ── */}
      <Card className="border-2 border-violet-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl">
              <BrainCircuit className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black">AI Mentor Sozlamalari</h1>
              <p className="text-violet-200 text-sm mt-1">
                {aiProvider === 'onspace' ? '🚀 OnSpace AI' : `⚡ Groq API · ${validKeysCount} ta kalit`}
                {chunksCount !== null && ` · 📚 ${chunksCount} ta material chunk`}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Faol/nofaol ── */}
      <Card className="border-2 border-slate-200">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-violet-200 rounded-xl">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1.5">
                <Power className={`h-5 w-5 ${faol ? 'text-green-600' : 'text-gray-400'}`} />
                <h3 className="text-base font-bold text-gray-900">AI Mentor chatbot</h3>
              </div>
              <p className="text-xs text-gray-600 ml-8">
                O'quvchilar saytida AI Mentor tugmasi ko'rinadi va suhbat qilish mumkin
              </p>
              <div className="mt-2 ml-8">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${
                    faol
                      ? 'bg-green-100 border-green-400 text-green-700'
                      : 'bg-gray-100 border-gray-300 text-gray-500'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${faol ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
                  />
                  {faol ? 'Faol' : "O'chirilgan"}
                </span>
              </div>
            </div>
            <Switch
              checked={faol}
              onCheckedChange={setFaol}
              className="data-[state=checked]:bg-violet-600 ml-4"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── AI PROVIDER TANLASH ── */}
      <Card className="border-2 border-blue-300 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-5 w-5 text-blue-600" />
            AI Provayder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => { setAiProvider('onspace'); setModel('google/gemini-3-flash-preview'); }}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                aiProvider === 'onspace' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${aiProvider === 'onspace' ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div>
                <p className="text-sm font-black text-gray-900">🚀 OnSpace AI</p>
                <p className="text-xs text-gray-500 mt-1">Gemini 3, GPT-5 — API kalit talab qilinmaydi</p>
                <span className="inline-block mt-1 text-[10px] bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 rounded-full font-black">TAVSIYA</span>
              </div>
            </button>
            <button
              onClick={() => { setAiProvider('groq'); setModel('llama-3.3-70b-versatile'); }}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                aiProvider === 'groq' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${aiProvider === 'groq' ? 'bg-purple-600' : 'bg-gray-300'}`} />
              <div>
                <p className="text-sm font-black text-gray-900">⚡ Groq API</p>
                <p className="text-xs text-gray-500 mt-1">Llama, Mixtral — alohida API kalit kerak</p>
              </div>
            </button>
          </div>

          {/* OnSpace AI model tanlash */}
          {aiProvider === 'onspace' && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-600">Model tanlang:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ONSPACE_MODELLAR.map(m => (
                  <button key={m.value} onClick={() => setModel(m.value)}
                    className={`flex items-start gap-2 p-2.5 rounded-xl border-2 text-left transition-all text-xs ${
                      model === m.value ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-gray-200 hover:border-blue-300 text-gray-700'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${model === m.value ? 'bg-blue-600' : 'bg-gray-300'}`} />
                    <span className="font-semibold">{m.label}</span>
                  </button>
                ))}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                <p className="font-bold mb-1">OnSpace AI haqida:</p>
                <p>API kalit talab qilinmaydi — OnSpace platformasi orqali to'g'ridan-to'g'ri ishlaydi. Groq API kalitlarini sozlamasangiz ham AI Mentor ishlaydi.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── O'QUV MATERIALLAR INDEKSLASH ── */}
      <Card className="border-2 border-teal-300 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-teal-600" />
            O'quv Materiallar AI Indeksi
            {chunksCount !== null && (
              <span className="text-xs font-bold bg-teal-100 text-teal-700 border border-teal-300 px-2 py-0.5 rounded-full">
                {chunksCount} ta chunk
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-900 space-y-2">
            <p className="font-bold">Bu nima?</p>
            <p>O'quvchi savol berganda AI Mentor <strong>avvalo shu indeksdan</strong> izlaydi. Materiallar HTML formatida bo'lsa, ulardan matn chiqarilib, qismlarga (chunk) bo'linadi.</p>
            <p className="font-semibold">Qachon indekslash kerak?</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Yangi materiallar yuklanganda</li>
              <li>Materiallar tahrirlanganda</li>
              <li>Birinchi sozlash paytida</li>
            </ul>
          </div>

          {indexNatija && (
            <div className={`flex items-start gap-2 p-3 rounded-xl border-2 text-sm ${
              indexNatija.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'
            }`}>
              {indexNatija.ok ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              <p>{indexNatija.xabar}</p>
            </div>
          )}

          <Button
            onClick={materiallarniIndekslash}
            disabled={indexYuklanyapti}
            className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl"
          >
            {indexYuklanyapti ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Indekslash davom etmoqda...</>
            ) : (
              <><Database className="h-4 w-4 mr-2" />Barcha materiallari qayta indekslash</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── KO'P API KEYLAR (faqat Groq uchun) ── */}
      {aiProvider === 'groq' && <>
      <Card className="border-2 border-violet-300 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-base">
              <Key className="h-5 w-5 text-violet-600" />
              Groq API Kalitlar
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  validKeysCount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {validKeysCount} ta
              </span>
            </div>
            <div className="flex items-center gap-2">
              {apiKeys.length > 0 && (
                <button
                  onClick={testAllKeys}
                  disabled={barchaTestYuklanyapti}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all"
                >
                  {barchaTestYuklanyapti ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Tekshirilmoqda...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="h-3.5 w-3.5" /> Barchasini test qilish
                    </>
                  )}
                </button>
              )}
              <button
                onClick={() => setQoshForma(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Kalit qo'shish
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">

          {/* Tushuntirish */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <Shield className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <p className="font-bold mb-1">Avtomatik fallback tizimi:</p>
              <p>
                1-kalit 429 xato bersa → 2-kalit urinadi → 3-kalit urinadi... Kalitlar{' '}
                <strong>tartib bo'yicha</strong> ishlatiladi. Birinchi kalit asosiy, qolganlar zahira.
              </p>
              <p className="mt-1">
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline hover:text-blue-900"
                >
                  console.groq.com/keys
                </a>{' '}
                → bepul ro'yxatdan o'tib API kalitlar oling.
              </p>
            </div>
          </div>

          {/* Test natijalari xulosa */}
          {testedCount > 0 && (
            <div
              className={`rounded-xl p-3 border-2 flex items-center gap-3 text-sm font-bold ${
                rateLimitKeysCount === validKeysCount
                  ? 'bg-red-50 border-red-300 text-red-800'
                  : okKeysCount > 0
                  ? 'bg-green-50 border-green-300 text-green-800'
                  : 'bg-amber-50 border-amber-300 text-amber-800'
              }`}
            >
              {okKeysCount > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <span>
                {okKeysCount > 0
                  ? `${okKeysCount} ta kalit ishlamoqda${
                      rateLimitKeysCount > 0 ? `, ${rateLimitKeysCount} ta limitga yetgan` : ''
                    }`
                  : "Barcha kalitlar limitga yetgan yoki ishlamayapti! Yangi kalit qo'shing."}
              </span>
            </div>
          )}

          {/* Qo'shish formasi */}
          {qoshForma && (
            <div className="bg-violet-50 border-2 border-violet-300 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-violet-800">Yangi API kalit qo'shish</p>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  Nomi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={yangiKeyLabel}
                  onChange={e => setYangiKeyLabel(e.target.value)}
                  placeholder="Masalan: Asosiy kalit, Zahira 1..."
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">
                  API kalit (gsk_ bilan boshlanadi)
                </label>
                <div className="relative">
                  <input
                    type={yangiKeyVisible ? 'text' : 'password'}
                    value={yangiKey}
                    onChange={e => setYangiKey(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && keyQosh()}
                    placeholder="gsk_..."
                    className={`${inputCls} pr-12`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setYangiKeyVisible(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {yangiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={keyQosh}
                  disabled={!yangiKey.trim()}
                  className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all"
                >
                  <Plus className="h-4 w-4 inline mr-1" /> Qo'shish
                </button>
                <button
                  onClick={() => {
                    setQoshForma(false);
                    setYangiKey('');
                    setYangiKeyLabel('');
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-xl transition-all"
                >
                  Bekor
                </button>
              </div>
            </div>
          )}

          {/* Kalitlar ro'yxati */}
          {apiKeys.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <Key className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Hali API kalit qo'shilmagan</p>
              <p className="text-xs text-gray-400 mt-1">
                Yuqoridagi "Kalit qo'shish" tugmasini bosing
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((item, idx) => (
                <div
                  key={item.id}
                  className={`rounded-xl border-2 transition-all overflow-hidden ${getTestBorderColor(item.testStatus, idx === 0)}`}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Tartib almashish */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => keyYuqoriKo(idx)}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-violet-200 disabled:opacity-20 text-violet-500 transition-all"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => keyPastKo(idx)}
                        disabled={idx === apiKeys.length - 1}
                        className="p-0.5 rounded hover:bg-violet-200 disabled:opacity-20 text-violet-500 transition-all"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />

                    {/* Raqam */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                        idx === 0 ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Kalit ma'lumotlari */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <p className="text-xs font-bold text-gray-700">{item.label}</p>
                        {idx === 0 && (
                          <span className="text-[9px] bg-violet-100 text-violet-700 border border-violet-300 px-1.5 py-0.5 rounded-full font-black">
                            ASOSIY
                          </span>
                        )}
                        {!item.value.startsWith('gsk_') && (
                          <span className="text-[9px] bg-red-100 text-red-600 border border-red-300 px-1.5 py-0.5 rounded-full font-black">
                            NOTO'G'RI
                          </span>
                        )}
                        {item.testStatus === 'ok' && (
                          <span className="text-[9px] bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 rounded-full font-black">
                            ✅{item.testMs ? ` ${item.testMs}ms` : ''}
                          </span>
                        )}
                        {item.testStatus === 'rate_limit' && (
                          <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-black">
                            ⚠️ 429
                          </span>
                        )}
                        {item.testStatus === 'error' && (
                          <span className="text-[9px] bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-full font-black">
                            ❌ XATO
                          </span>
                        )}
                        {item.testStatus === 'testing' && (
                          <span className="text-[9px] bg-blue-100 text-blue-700 border border-blue-300 px-1.5 py-0.5 rounded-full font-black animate-pulse">
                            ⏳ TEST...
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-gray-500 truncate">
                        {item.visible ? item.value : maskaKey(item.value)}
                      </p>
                    </div>

                    {/* Tugmalar */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => testSingleKey(item.id)}
                        disabled={item.testStatus === 'testing' || barchaTestYuklanyapti}
                        className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-500 hover:text-emerald-700 transition-all disabled:opacity-40"
                        title="Bu kalitni test qilish"
                      >
                        {getTestStatusIcon(item.testStatus)}
                      </button>
                      <button
                        onClick={() => keyVisibleToggle(item.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-all"
                        title="Ko'rsatish/Yashirish"
                      >
                        {item.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => keyKopir(item.value)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-all"
                        title="Nusxalash"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => keyOchir(item.id)}
                        className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 transition-all"
                        title="O'chirish"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Test natijasi tavsifi */}
                  {item.testMsg && item.testStatus !== 'testing' && (
                    <div
                      className={`px-4 py-2 text-xs font-medium border-t ${
                        item.testStatus === 'ok'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : item.testStatus === 'rate_limit'
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      {item.testMsg}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {apiKeys.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-xs text-emerald-800">
              <Info className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>{validKeysCount}</strong> ta kalit saqlashga tayyor.
                {apiKeys.length > 1 &&
                  ` 1-kalit 429 berganda avtomatik ${apiKeys.length}-kaligacha urinib ko'riladi.`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Groq Model tanlash ── */}
      <Card className="border-2 border-slate-200"> {/* This Card should be nested under the aiProvider === 'groq' condition, and not have a duplicated CardHeader */}
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-5 w-5 text-violet-600" />
            Groq Modeli
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {GROQ_MODELLAR.map(m => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  model === m.value
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-gray-200 hover:border-violet-300 bg-white'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    model === m.value ? 'bg-violet-600' : 'bg-gray-300'
                  }`}
                />
                <div>
                  <p
                    className={`text-xs font-bold leading-tight ${
                      model === m.value ? 'text-violet-900' : 'text-gray-700'
                    }`}
                  >
                    {m.label}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{m.value}</p>
                </div>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Yoki qo'lda kiriting:
            </label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="llama-3.3-70b-versatile"
              className={inputCls}
            />
          </div>
        </CardContent>
      </Card>
      </>} {/* The closing tag for aiProvider === 'groq' condition */}

      {/* ── Tizim yo'riqnomasi ── */}
      <Card className="border-2 border-amber-300">
        <CardHeader className="pb-0">
          <button
            onClick={() => setInstrOchiq(p => !p)}
            className="w-full flex items-center justify-between py-2"
          >
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-amber-600" />
              Tizim Yo'riqnomasi
              <span className="text-xs font-normal text-gray-400 ml-1">ixtiyoriy</span>
            </CardTitle>
            <span className="text-xs text-amber-600 font-semibold">
              {instrOchiq ? "▲ Yig'ish" : '▼ Ochish'}
            </span>
          </button>
        </CardHeader>
        {instrOchiq && (
          <CardContent className="pt-2 space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Bu maydon nima uchun?</p>
              <p>
                AI Mentor har so'rovda ushbu matnni "tizim ko'rsatmasi" sifatida oladi. Bo'sh
                qoldirsangiz — standart prompt ishlatiladi.
              </p>
            </div>
            <textarea
              value={systemInstruction}
              onChange={e => setSystemInstruction(e.target.value)}
              rows={10}
              placeholder={DEFAULT_SYSTEM_INSTRUCTION}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 bg-gray-50 resize-y font-mono leading-relaxed"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION)}
                className="text-xs text-amber-700 font-bold px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all"
              >
                <Sparkles className="h-3.5 w-3.5 inline mr-1" /> Namunani yuklash
              </button>
              <button
                onClick={() => setSystemInstruction('')}
                className="text-xs text-gray-500 font-bold px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-all"
              >
                Tozalash
              </button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Saqlash ── */}
      <Button
        onClick={saqlash}
        disabled={saqlanyapti || (aiProvider === 'groq' && validKeysCount === 0)}
        className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-2xl text-base"
      >
        {saqlanyapti ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Saqlanmoqda...
          </>
        ) : (
          <>
            <Save className="mr-2 h-5 w-5" />
            {aiProvider === 'onspace' ? `Saqlash (${model})` : `Saqlash (${validKeysCount} ta kalit)`}
          </>
        )}
      </Button>

      {/* ── Umumiy test ── */}
      <Card className="border-2 border-emerald-300">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-emerald-600" />
            Edge Function orqali test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
            Saqlangan sozlamalar bilan Edge Function ga test so'rov yuboradi. 429 holatida keyingi
            kalit urinib ko'riladi.
          </div>

          {testNatija && (
            <div
              className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
                testNatija.ok ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
              }`}
            >
              {testNatija.ok ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${testNatija.ok ? 'text-green-800' : 'text-red-800'}`}>
                {testNatija.xabar}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={testQilish}
              disabled={testYuklanyapti}
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              {testYuklanyapti ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Tekshirilmoqda...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Test so'rov yuborish
                </>
              )}
            </Button>
            <Button
              onClick={yuklash}
              variant="outline"
              className="h-10 px-4 rounded-xl border-2 border-gray-300"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Qo'llanma ── */}
      <Card className="border border-teal-200 bg-teal-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3 text-sm text-teal-900">
            <BrainCircuit className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-2">AI Mentor + O'quv materiallar integratsiyasi:</p>
              <ol className="space-y-1 list-decimal list-inside text-xs">
                <li>O'qituvchi material yuklaydi (HTML format tavsiya)</li>
                <li>Admin "Barcha materiallari qayta indekslash" bosadi</li>
                <li>O'quvchi savol berganda — AI avvalo o'sha materiallardan javob qidiradi</li>
                <li>Topilsa: "Platformadagi materiallar asosida:" deb tushuntiradi</li>
                <li>Topilmasa: "Bu mavzuda material yo'q" deb bildiradi, keyin umumiy bilimdan javob beradi</li>
              </ol>
              <p className="mt-2 font-bold">Token tejash:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>Bir xil savollar keshlanadi (4 soat)</li>
                <li>Material chunklari max 700 belgi</li>
                <li>Har so'rovda max 3 ta chunk uzatiladi</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
