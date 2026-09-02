// Ekspert darajasidagi Kazus tahlil tizimi (AI-siz)
// Muallif: FanFaster Core Logic

import { Kazus, OquvchiJavob, BahoNatija, BatafilTahlil } from '@/types';

// O'zbek tili uchun stop-so'zlar (tahlilda hisobga olinmaydi)
const STOP_WORDS = new Set(['va', 'bilan', 'uchun', 'ham', 'u', 'bu', 'shu', 'esa', 'edi', 'boʻlib', 'bolib', 'bo‘lib', 'hamda', 'orqali']);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

// Modda raqamlarini aniqlash (masalan: 122-modda yoki 122-m)
function extractArticles(text: string): string[] {
  const regex = /(\d+)-(modda|m)/gi;
  const matches = text.match(regex);
  return matches ? matches.map(m => m.toLowerCase()) : [];
}

export function analyzeCaseLocally(
  kazus: Kazus,
  studentAnswer: string,
  index: number,
  isAflotun: boolean
): BahoNatija {
  const teacherTokens = tokenize(kazus.javob);
  const studentTokens = tokenize(studentAnswer);
  
  const teacherArticles = extractArticleNumbers(kazus.javob);
  const studentArticles = extractArticleNumbers(studentAnswer);

  // 1. Mazmuniy moslikni hisoblash (Keyword Overlap)
  const commonTokens = studentTokens.filter(token => teacherTokens.includes(token));
  const uniqueTeacherTokens = Array.from(new Set(teacherTokens));
  const uniqueCommonTokens = Array.from(new Set(commonTokens));
  
  let mazmunFoiz = (uniqueCommonTokens.length / uniqueTeacherTokens.length) * 100;
  
  // Modda xatosi uchun jazo (AI shartiga muvofiq)
  let moddaXatosi = false;
  teacherArticles.forEach(art => {
    if (!studentArticles.includes(art)) moddaXatosi = true;
  });
  if (moddaXatosi && mazmunFoiz > 20) mazmunFoiz -= 20;
  
  const maxBall = isAflotun ? 22 : 30;
  const maxMazmunBall = isAflotun ? 20 : 25;
  const mazmunBall = Math.max(1, Math.round((mazmunFoiz / 100) * maxMazmunBall));

  // 2. Maxsus mezonlar (Heuristic check)
  const maxsusMezonlar = [
    { 
      nom: "Tizimli va chuqur bilim", 
      check: () => studentTokens.length > 15 && uniqueCommonTokens.length > 5,
      sabab: "Javob hajmi va kalit tushunchalar yetarli."
    },
    { 
      nom: "Terminologiyadan to'g'ri foydalanish", 
      check: () => studentTokens.some(t => ['huquqiy', 'javobgarlik', 'norma', 'shartnoma', 'modda', 'asos'].includes(t)),
      sabab: "Yuridik terminlar ishlatilgan."
    },
    { 
      nom: "Muammoli savollarni aniqlash", 
      check: () => studentAnswer.includes('?') || studentTokens.some(t => ['aniqlash', 'sabab', 'chunki'].includes(t)),
      sabab: "Muammo tahlil qilingan."
    },
    { 
      nom: "Tayanch tushunchalarni qo'llash", 
      check: () => uniqueCommonTokens.length > (uniqueTeacherTokens.length * 0.4),
      sabab: "Asosiy tushunchalar qamrab olingan."
    }
  ];

  const processedMaxsus = maxsusMezonlar.map(m => ({
    nom: m.nom,
    ball: m.check() ? 1 : 0,
    maksimal: 1,
    sabab: m.check() ? m.sabab : "Bu mezon bo'yicha dalillar yetarli emas."
  }));

  const maxsusTotal = processedMaxsus.reduce((s, m) => s + m.ball, 0);

  // 3. Qo'shimcha mezonlar (Teacher's custom rules)
  let qoshimchaDelta = 0;
  const qoshimchaNatija = (kazus.qoshimcha_mezonlar || []).map((m, i) => {
    const bajarildi = studentAnswer.toLowerCase().includes(m.shart.toLowerCase());
    const delta = bajarildi ? m.ball : -m.ball;
    qoshimchaDelta += delta;
    return {
      index: i,
      shart: m.shart,
      bajarildi,
      delta_ball: delta,
      sabab: bajarildi ? "Shart to'liq bajarildi." : "Javobda bu shart topilmadi."
    };
  });

  // Yakuniy ball hisobi
  let finalBall = mazmunBall + maxsusTotal + qoshimchaDelta;
  finalBall = Math.min(maxBall + qoshimchaDelta, Math.max(1, finalBall));

  // Imlo xatolar (Simulyatsiya - juda uzun so'zlarni yoki g'alati belgilarni topish)
  const suspiciousWords = studentTokens.filter(t => t.length > 20);

  const tahlil: BatafilTahlil = {
    mazmun_moslik_foiz: Math.round(mazmunFoiz),
    mazmun_ball: mazmunBall,
    mazmun_izoh: `Sizning javobingiz ustoz andozasiga ${Math.round(mazmunFoiz)}% mos keldi. ${moddaXatosi ? 'Modda raqamlarida noaniqlik bor.' : 'Moddalar to\'g\'ri ko\'rsatilgan.'}`,
    maxsus_mezonlar: processedMaxsus,
    imlo_xatolar: suspiciousWords.map(w => ({ xato: w, togri: "tekshiring", tur: 'imlo' })),
    yetishmayotganlar: uniqueTeacherTokens.filter(t => !studentTokens.includes(t)).slice(0, 3).map(t => `"${t}" tushunchasi`),
    umumiy_xulosa: mazmunFoiz > 70 ? "Juda yaxshi tahlil, davom eting!" : "Mavzuni yana bir bor takrorlash tavsiya etiladi.",
    qoshimcha_mezonlar_natija: qoshimchaNatija,
    qoshimcha_delta_ball: qoshimchaDelta
  };

  return {
    kazus_index: index,
    ball: finalBall,
    izoh: isAflotun ? "Yuborilgan javob standart baholashga mos emas (Cheklov)." : tahlil.umumiy_xulosa,
    batafsil_tahlil: tahlil
  };
}

function extractArticleNumbers(text: string): string[] {
  const regex = /\d+/g;
  return text.match(regex) || [];
}