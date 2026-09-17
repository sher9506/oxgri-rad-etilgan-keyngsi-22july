import { useState, useEffect } from 'react';
import { Activity, Cpu, Zap, TrendingUp, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

const GEMINI_DAILY_QUOTA = 1000;

const MODEL_RPD: Record<string, number> = {
  'gemini-3.1-flash-lite': 1000,
  'gemini-embedding-001': 1500,
  'gemini-3.6-flash': 250,
};

const MODEL_LABELS: Record<string, string> = {
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite',
  'gemini-embedding-001': 'Gemini Embedding-001',
  'gemini-3.6-flash': 'Gemini 3.6 Flash',
};

const functionLabels: Record<string, string> = {
  'moot-court-chat': 'Moot Court suhbat',
  'moot-court-evaluate': 'Moot Court baholash',
  'mentor-chat': 'AI Mentor',
  'import-legal-code': 'Kodeks import',
  'find-relevant-articles': 'Modda qidirish',
  'vectorize-articles': 'Modda vektorlash',
  'rag-pipeline': 'RAG pipeline',
  'chunk-material': 'Material chunking',
  'baholash': 'Baholash',
};

interface UsageRow {
  function_name: string;
  provider: string;
  model: string | null;
  success: boolean;
}

interface ModelBreakdown {
  model: string;
  count: number;
  rpd: number;
  remaining: number;
}

interface FunctionBreakdown {
  function_name: string;
  provider: string;
  count: number;
}

export default function AiKvotaWidget() {
  const [geminiCount, setGeminiCount] = useState(0);
  const [groqCount, setGroqCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [byFunction, setByFunction] = useState<FunctionBreakdown[]>([]);
  const [byModel, setByModel] = useState<ModelBreakdown[]>([]);

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const startOfDay = `${today}T00:00:00Z`;

      const { data: geminiData } = await supabase
        .from('ai_usage_log')
        .select('id', { count: 'exact', head: true })
        .eq('provider', 'gemini')
        .gte('created_at', startOfDay);

      const { data: groqData } = await supabase
        .from('ai_usage_log')
        .select('id', { count: 'exact', head: true })
        .eq('provider', 'groq')
        .gte('created_at', startOfDay);

      setGeminiCount((geminiData as any)?.length ?? 0);
      setGroqCount((groqData as any)?.length ?? 0);

      const { data: rows } = await supabase
        .from('ai_usage_log')
        .select('function_name, provider, model, success')
        .gte('created_at', startOfDay) as { data: UsageRow[] | null };

      if (rows) {
        const fnMap: Record<string, FunctionBreakdown> = {};
        rows.forEach((r) => {
          const key = `${r.function_name}|${r.provider}`;
          if (!fnMap[key]) fnMap[key] = { function_name: r.function_name, provider: r.provider, count: 0 };
          fnMap[key].count++;
        });
        setByFunction(Object.values(fnMap).sort((a, b) => b.count - a.count));

        const modelMap: Record<string, number> = {};
        rows.forEach((r) => {
          const m = r.model || 'noma\'lum';
          modelMap[m] = (modelMap[m] || 0) + 1;
        });
        const modelBreakdown: ModelBreakdown[] = Object.entries(modelMap).map(([model, count]) => {
          const rpd = MODEL_RPD[model] || 1000;
          return { model, count, rpd, remaining: Math.max(0, rpd - count) };
        });
        setByModel(modelBreakdown.sort((a, b) => b.count - a.count));
      }
    } catch (e) {
      console.error('AI kvota yuklashda xato:', e);
    } finally {
      setLoading(false);
    }
  };

  const geminiPct = Math.min(100, (geminiCount / GEMINI_DAILY_QUOTA) * 100);
  const geminiColor = geminiPct < 70 ? 'bg-green-500' : geminiPct < 90 ? 'bg-yellow-500' : 'bg-red-500';
  const geminiTextColor = geminiPct < 70 ? 'text-green-600' : geminiPct < 90 ? 'text-yellow-600' : 'text-red-600';
  const geminiStatusText = geminiPct < 70 ? 'Normal' : geminiPct < 90 ? 'Yuqori' : "Kritik - Groq'ga o'tadi";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-bold text-gray-900">Tizim holati — AI resurslari</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Gemini quota card */}
          <Card className="border-2 border-blue-200/60 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Cpu className="h-4 w-4 text-blue-600" />
                Bugungi Gemini so'rovlari
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${geminiPct < 70 ? 'bg-green-100 text-green-700' : geminiPct < 90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  {geminiStatusText}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-gray-900">{geminiCount}</span>
                <span className="text-sm text-gray-500">/ {GEMINI_DAILY_QUOTA} (taxminiy)</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${geminiColor} rounded-full transition-all duration-500`}
                  style={{ width: `${geminiPct}%` }}
                />
              </div>
              <div className={`text-xs font-bold ${geminiTextColor}`}>
                {geminiPct.toFixed(1)}% ishlatilgan — qoldi: {Math.max(0, GEMINI_DAILY_QUOTA - geminiCount)} so'rov
              </div>
              {geminiPct >= 90 && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  Diqqat: Gemini kvotasi 90% dan oshdi. Yangi sessiyalar avtomatik ravishda Groq'ga yo'naltirilmoqda.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Per-model breakdown */}
          {byModel.length > 0 && (
            <Card className="border border-blue-200/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Database className="h-4 w-4 text-blue-500" />
                  Model bo'yicha kunlik limit
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {byModel.map((m) => {
                  const pct = Math.min(100, (m.count / m.rpd) * 100);
                  const color = pct < 70 ? 'bg-green-500' : pct < 90 ? 'bg-yellow-500' : 'bg-red-500';
                  const textColor = pct < 70 ? 'text-green-600' : pct < 90 ? 'text-yellow-600' : 'text-red-600';
                  return (
                    <div key={m.model} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-700">{MODEL_LABELS[m.model] || m.model}</span>
                        <span className={`font-bold ${textColor}`}>
                          {m.count} / {m.rpd} RPD — qoldi: {m.remaining}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-gray-400 pt-1">
                  RPD = Requests Per Day (bepul tarif). Chegaralar Google AI Studio'dagi hisobga bog'liq o'zgarishi mumkin.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Groq usage card */}
          <Card className="border-2 border-orange-200/60 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100/50 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-orange-600" />
                Bugungi Groq so'rovlari
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-gray-900">{groqCount}</span>
                <span className="text-sm text-gray-500">so'rov (chegarasiz)</span>
              </div>
              <p className="text-xs text-gray-400">
                Groq kvotasi juda katta — aniq raqam kifoya. Fallback faol holatda.
                {!geminiCount && !groqCount && " Hozircha so\u2019rovlar yo\u2019q."}
              </p>
            </CardContent>
          </Card>

          {/* Breakdown by function */}
          {byFunction.length > 0 && (
            <Card className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-gray-600" />
                  Funksiya bo'yicha taqsimot
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {byFunction.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-gray-50/80">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.provider === 'gemini' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                        <span className="font-medium text-gray-700">
                          {functionLabels[item.function_name] || item.function_name}
                        </span>
                        <span className="text-gray-400">({item.provider})</span>
                      </div>
                      <span className="font-bold text-gray-900">{item.count} ta</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Groq status note */}
          <Card className="border border-dashed border-green-300 bg-green-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  <p className="font-bold text-green-700 mb-0.5">Groq fallback — FAOL</p>
                  <p>
                    Groq API kaliti sozlangan. Gemini 429 (kvota tugagan) xatosi bo'lsa,
                    tizim avtomatik ravishda Groq (llama-3.3-70b-versatile) modeliga o'tadi.
                    Gemini kunlik kvotasi 90% dan oshsa, yangi sessiyalar to'g'ridan-to'g'ri Groq'ga yo'naltiriladi.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
