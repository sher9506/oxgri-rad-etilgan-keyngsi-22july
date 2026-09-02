import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

// ─── INTERFEYLAR ──────────────────────────────────────────────────────────────

interface QoshimchaMezon {
  shart: string;
  ball: number;
}

interface StandartMezonSozlama {
  id: string;
  nom: string;
  faol: boolean;
  ball: number;
  asl_ball: number;
}

interface KazusJavob {
  kazus: string;
  javob: string;
  mezon_sozlamalar?: StandartMezonSozlama[];
  qoshimcha_mezonlar?: QoshimchaMezon[];
}

interface OquvchiJavob {
  kazus_index: number;
  javob: string;
  aflotun_guruh?: boolean;
}

interface MaxsusMezonTahlil {
  nom: string;
  ball: number;
  maksimal: number;
  sabab: string;
}

interface ImloXato {
  xato: string;
  togri: string;
  tur: 'imlo';
}

interface BatafilTahlil {
  mazmun_moslik_foiz: number;
  mazmun_ball: number;
  mazmun_izoh: string;
  maxsus_mezonlar: MaxsusMezonTahlil[];
  imlo_xatolar: ImloXato[];
  yetishmayotganlar: string[];
  umumiy_xulosa: string;
  qoshimcha_mezonlar_natija?: {
    index: number;
    shart: string;
    bajarildi: boolean;
    delta_ball: number;
    sabab: string;
  }[];
  qoshimcha_delta_ball?: number;
}

interface BahoNatija {
  kazus_index: number;
  ball: number;
  izoh: string;
  batafsil_tahlil: BatafilTahlil;
}

// ─── STANDART MEZONLAR KONSTANTASI (fallback) ─────────────────────────────────

const STANDART_MEZONLAR_ASL: StandartMezonSozlama[] = [
  { id: 'mazmun',      nom: 'Mazmuniy moslik (ustoz javobiga)',                          faol: true, ball: 25, asl_ball: 25 },
  { id: 'tizimli',    nom: 'Tizimli va chuqur bilim, dalillar bilan asoslash',            faol: true, ball: 1,  asl_ball: 1  },
  { id: 'terminologiya', nom: "Terminologiyadan (xorijiy) to'g'ri foydalanish",           faol: true, ball: 1,  asl_ball: 1  },
  { id: 'muammo',     nom: "Muammoli savollarni aniqlash va huquqiy pozitsiyani asoslash", faol: true, ball: 1,  asl_ball: 1  },
  { id: 'tayanch',    nom: "Tayanch tushunchalarni yechimda qo'llay olish",               faol: true, ball: 1,  asl_ball: 1  },
  { id: 'mantiq',     nom: "Argumentlarning bir-biriga zid emasligi",                     faol: true, ball: 1,  asl_ball: 1  },
];

// ─── XATOLIKKA BARDOSHLI FALLBACK NATIJA ──────────────────────────────────────

function fallbackNatija(kazus_index: number, sabab: string): BahoNatija {
  return {
    kazus_index,
    ball: 1,
    izoh: sabab,
    batafsil_tahlil: {
      mazmun_moslik_foiz: 0,
      mazmun_ball: 1,
      mazmun_izoh: sabab,
      maxsus_mezonlar: [],
      imlo_xatolar: [],
      yetishmayotganlar: [],
      umumiy_xulosa: sabab,
    },
  };
}

// ─── ASOSIY HANDLER ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { toplam_kod, oquvchi_ismi, javoblar, save_to_db = true } = await req.json();

    if (!toplam_kod || !oquvchi_ismi || !javoblar) {
      return new Response(
        JSON.stringify({ error: 'Toplam kodi, ism va javoblar talab qilinadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Toplamni olish
    const { data: toplam, error: toplamError } = await supabaseAdmin
      .from('toplamlar')
      .select('*')
      .eq('kod', toplam_kod)
      .single();

    if (toplamError || !toplam) {
      return new Response(
        JSON.stringify({ error: 'Toplam topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dublikat tekshirish (faqat save_to_db = true da)
    if (save_to_db) {
      const { data: mavjudJavob } = await supabaseAdmin
        .from('javoblar')
        .select('id')
        .eq('toplam_kod', toplam_kod)
        .eq('oquvchi_ismi', oquvchi_ismi)
        .single();

      if (mavjudJavob) {
        return new Response(
          JSON.stringify({ error: 'Siz allaqachon bu toplamni topshirgansiz' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const kazuslar = toplam.kazuslar as KazusJavob[];
    const oquvchiJavoblar = javoblar as OquvchiJavob[];
    const bahoNatijalari: BahoNatija[] = [];

    // ── Har bir kazusni baholash ──
    for (const oquvchiJavob of oquvchiJavoblar) {
      const kazus = kazuslar[oquvchiJavob.kazus_index];
      if (!kazus) continue;

      // AFLOTUN GURUHI tekshiruvi
      const aflotun = Boolean(oquvchiJavob.aflotun_guruh);
      const aflotunMaksimal = 22;

      // ── Mezon sozlamalarini olish ──
      // Kazusda mezon_sozlamalar bo'lsa → ishlatamiz, bo'lmasa → standartni ishlatamiz
      const mezonSozlamalar: StandartMezonSozlama[] = (kazus.mezon_sozlamalar && kazus.mezon_sozlamalar.length > 0)
        ? kazus.mezon_sozlamalar
        : STANDART_MEZONLAR_ASL;

      // Mazmun mezonini ajratib olish
      const mazmunMezon = mezonSozlamalar.find(m => m.id === 'mazmun');
      const mazmunFaol = mazmunMezon?.faol ?? true;
      const mazmunBall = mazmunMezon ? (aflotun ? Math.min(mazmunMezon.ball, 20) : mazmunMezon.ball) : (aflotun ? 20 : 25);

      // Maxsus mezonlarni olish (mazmun tashqari)
      const maxsusMezonlar = mezonSozlamalar
        .filter(m => m.id !== 'mazmun' && m.faol)
        .map(m => ({ nom: m.nom, ball: m.ball }));

      // Jami standart maksimal ball
      const maxsusBall = maxsusMezonlar.reduce((s, m) => s + m.ball, 0);
      const standartMaksimal = (mazmunFaol ? mazmunBall : 0) + maxsusBall;

      console.log(`Kazus ${oquvchiJavob.kazus_index + 1}: mazmun=${mazmunFaol}(${mazmunBall}), maxsus=${maxsusMezonlar.length} ta, standart maks=${standartMaksimal}`);

      // ── Qo'shimcha mezonlar ──
      const qoshimchaMezonlar = kazus.qoshimcha_mezonlar || [];

      // ── AI Prompt yaratish ──
      const natija = await baholashAI({
        kazus,
        oquvchiJavob,
        aflotun,
        aflotunMaksimal,
        mazmunFaol,
        mazmunBall,
        maxsusMezonlar,
        standartMaksimal,
        qoshimchaMezonlar,
      });

      bahoNatijalari.push(natija);
    }

    // Natijalarni saqlash
    if (save_to_db) {
      const { error: javobError } = await supabaseAdmin
        .from('javoblar')
        .insert({
          toplam_id: toplam.id,
          toplam_kod,
          oquvchi_ismi,
          javoblar: oquvchiJavoblar,
          baho: bahoNatijalari,
        });

      if (javobError) {
        console.error('Javob saqlash xatosi:', javobError);
        return new Response(
          JSON.stringify({ error: 'Javobni saqlashda xatolik' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('✅ Natija saqlandi');
    } else {
      console.log('ℹ️ Ustoz test yechdi - natija saqlanmadi (save_to_db=false)');
    }

    return new Response(
      JSON.stringify({ success: true, baho: bahoNatijalari }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Umumiy xato:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ─── AI BAHOLASH FUNKSIYASI ────────────────────────────────────────────────────

async function baholashAI(params: {
  kazus: KazusJavob;
  oquvchiJavob: OquvchiJavob;
  aflotun: boolean;
  aflotunMaksimal: number;
  mazmunFaol: boolean;
  mazmunBall: number;
  maxsusMezonlar: { nom: string; ball: number }[];
  standartMaksimal: number;
  qoshimchaMezonlar: QoshimchaMezon[];
}): Promise<BahoNatija> {
  const {
    kazus, oquvchiJavob, aflotun, aflotunMaksimal,
    mazmunFaol, mazmunBall, maxsusMezonlar, standartMaksimal, qoshimchaMezonlar
  } = params;

  try {
    // ── AFLOTUN GURUHI OGOHLANTIRISHI ──
    const aflotunOgohlantirish = aflotun
      ? `\n\n⚠️ QAT'IY CHEKLOV: Bu javob noto'g'ri usul bilan yozilgan. MAKSIMAL BALL: ${aflotunMaksimal}. 
- Ball HECH QACHON ${aflotunMaksimal}dan OSHMASLIGI kerak!
- "izoh" maydoniga FAQAT "Yuborilgan javob batafsil tahlil uchun mos emas" deb yozing
- "batafsil_tahlil" bo'limida MINIMAL ma'lumot bering
- "mazmun_izoh" ga "Baholash uchun mos emas" deb yozing
- "maxsus_mezonlar" da barcha "sabab" larga "Baholash uchun mos emas" deb yozing`
      : '';

    // ── MAZMUN BO'LIMI ──
    let mazmunPrompt = '';
    let mazmunJSON = '';
    if (mazmunFaol) {
      const m = mazmunBall;
      mazmunPrompt = `1️⃣ MAZMUNIY MOSLIK (1-${m} ball):
   📌 Talaba javobini USTOZ JAVOBI bilan MAZMUNAN solishtiring va FOIZDA baholang:
   ✅ 100% mos → ${m} ball
   ✅ 90% mos  → ${Math.round(m * 0.9)} ball
   ✅ 80% mos  → ${Math.round(m * 0.8)} ball
   ✅ 70% mos  → ${Math.round(m * 0.7)} ball
   ✅ 60% mos  → ${Math.round(m * 0.6)} ball
   ✅ 50% mos  → ${Math.round(m * 0.5)} ball
   ⚠️ Modda raqami xato → moslik foizidan 20% AYIRING!
   📝 "mazmun_izoh" da KONKRET yozing: nima yetishmayapti, qaysi qismlar xato`;

      mazmunJSON = `"mazmun_moslik_foiz": [0-100],
    "mazmun_ball": [1-${m}],
    "mazmun_izoh": "BATAFSIL: Nima uchun bu foiz? Talabaning javobidan ANIQ gap keltiring.",`;
    } else {
      mazmunPrompt = `1️⃣ MAZMUNIY MOSLIK: Bu mezon O'CHIRILGAN. mazmun_ball = 0, mazmun_moslik_foiz = 0 qiling.`;
      mazmunJSON = `"mazmun_moslik_foiz": 0,
    "mazmun_ball": 0,
    "mazmun_izoh": "Mazmun mezoni ustoz tomonidan o'chirilgan",`;
    }

    // ── MAXSUS MEZONLAR BO'LIMI ──
    let maxsusPrompt = '';
    let maxsusJSONMisol = '';
    if (maxsusMezonlar.length > 0) {
      maxsusPrompt = `\n2️⃣ MAXSUS MEZONLAR (jami ${maxsusMezonlar.reduce((s, m) => s + m.ball, 0)} ball):
   ${maxsusMezonlar.map((m, i) => `${i + 1}. ${m.nom} [0-${m.ball} ball]
      ↳ Talaba javobidan KONKRET misol keltiring`).join('\n   ')}`;

      maxsusJSONMisol = maxsusMezonlar.map(m => `{
        "nom": "${m.nom}",
        "ball": [0 yoki ${m.ball}],
        "maksimal": ${m.ball},
        "sabab": "KONKRET sabab va misol"
      }`).join(',\n      ');
    } else {
      maxsusPrompt = `\n2️⃣ MAXSUS MEZONLAR: Hech biri faol emas, bo'sh massiv qaytaring.`;
      maxsusJSONMisol = '';
    }

    // ── QO'SHIMCHA MEZONLAR BO'LIMI ──
    let qoshimchaPrompt = '';
    let qoshimchaJSONQisim = '';
    if (qoshimchaMezonlar.length > 0) {
      qoshimchaPrompt = `\n4️⃣ IXTIYORIY QO'SHIMCHA MEZONLAR (ustoz tomonidan belgilangan):
   ⚠️ Har bir shart uchun:
   - BAJARILSA → +ball qo'shiladi
   - BAJARILMASA → -ball ayiriladi
   ${qoshimchaMezonlar.map((m, i) => `
   ${i + 1}. Shart: "${m.shart}"
      ✅ Bajarilsa: +${m.ball} ball
      ❌ Bajarilmasa: -${m.ball} ball`).join('')}
   
   📌 JSON da "qoshimcha_mezonlar_natija" massivini qaytaring.`;

      qoshimchaJSONQisim = `,
    "qoshimcha_mezonlar_natija": [
      ${qoshimchaMezonlar.map((m, i) => `{
        "index": ${i},
        "shart": "${m.shart.replace(/"/g, "'")}",
        "bajarildi": true_yoki_false,
        "delta_ball": musbat_yoki_manfiy_son,
        "sabab": "Qisqa izoh"
      }`).join(',\n      ')}
    ]`;
    }

    // ── PROMPT ──
    const prompt = `Siz huquq sohasida professional baholovchi ekspertsiz.${aflotunOgohlantirish}

KAZUS:
${kazus.kazus}

TO'G'RI JAVOB (USTOZ JAVOBI):
${kazus.javob}

TALABA JAVOBI:
${oquvchiJavob.javob}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BAHOLASH TIZIMI (Maksimal standart ball: ${standartMaksimal}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${mazmunPrompt}
${maxsusPrompt}

3️⃣ IMLO XATOLAR:
   📝 Barcha imlo xatolarni toping. Imlo xatolari balldan AYIRILMAYDI, faqat ko'rsatiladi.
${qoshimchaPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 JSON FORMAT (faqat shu formatda javob bering):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "ball": [0-${standartMaksimal} STANDART BALL, qo'shimcha mezonlarsiz],
  "izoh": "${aflotun ? 'Yuborilgan javob batafsil tahlil uchun mos emas' : 'Qisqa umumiy izoh'}",
  "batafsil_tahlil": {
    ${mazmunJSON}
    "maxsus_mezonlar": [${maxsusJSONMisol}],
    "imlo_xatolar": [{"xato": "talaba so'zi", "togri": "to'g'ri variant", "tur": "imlo"}],
    "yetishmayotganlar": ["ustoz javobida bor, talabada yo'q 1", "..."],
    "umumiy_xulosa": "1-2 jumlada umumiy baho"
  }${qoshimchaJSONQisim}
}`;

    // ── AI GA SO'ROV ──
    const aiResponse = await fetch(`${Deno.env.get('ONSPACE_AI_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('ONSPACE_AI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI xato:', await aiResponse.text());
      return fallbackNatija(oquvchiJavob.kazus_index, 'Baholashda texnik xatolik yuz berdi.');
    }

    const aiData = await aiResponse.json();
    const aiText = aiData.choices[0]?.message?.content || '';
    console.log(`AI javob (kazus ${oquvchiJavob.kazus_index + 1}):`, aiText.substring(0, 200));

    // JSON parse
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('AI JSON qaytarmadi:', aiText);
      return fallbackNatija(oquvchiJavob.kazus_index, 'Baholashda texnik xatolik yuz berdi.');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // ── STANDART BALL HISOBLASH ──
    let standartBall = Math.min(standartMaksimal, Math.max(1, Number(parsed.ball) || 1));

    // AFLOTUN cheklovi
    if (aflotun && standartBall > aflotunMaksimal) {
      console.warn(`⚠️ AFLOTUN: ${standartBall} → ${aflotunMaksimal}`);
      standartBall = aflotunMaksimal;
    }

    let batafsil_tahlil: BatafilTahlil = parsed.batafsil_tahlil || {
      mazmun_moslik_foiz: 0,
      mazmun_ball: 0,
      mazmun_izoh: "Tahlil ma'lumotlari mavjud emas",
      maxsus_mezonlar: [],
      imlo_xatolar: [],
      yetishmayotganlar: [],
      umumiy_xulosa: 'Baholash jarayonida xatolik yuz berdi',
    };

    // ── QO'SHIMCHA MEZONLAR HISOBLASH ──
    const aiQoshimchaNatija = parsed.qoshimcha_mezonlar_natija || [];
    let qoshimchaDeltaBall = 0;
    const qoshimchaNatijaFinal: {
      index: number; shart: string; bajarildi: boolean; delta_ball: number; sabab: string;
    }[] = [];

    if (qoshimchaMezonlar.length > 0) {
      for (let i = 0; i < qoshimchaMezonlar.length; i++) {
        const mezon = qoshimchaMezonlar[i];
        const aiMezon = aiQoshimchaNatija.find((q: any) => q.index === i);
        const bajarildi = aiMezon ? Boolean(aiMezon.bajarildi) : false;
        const delta = bajarildi ? mezon.ball : -mezon.ball;
        qoshimchaDeltaBall += delta;

        qoshimchaNatijaFinal.push({
          index: i, shart: mezon.shart, bajarildi, delta_ball: delta,
          sabab: aiMezon?.sabab || (bajarildi ? "Shart bajarildi" : "Shart bajarilmadi"),
        });

        console.log(`Mezon [${i}]: "${mezon.shart}" → ${delta > 0 ? '+' : ''}${delta} (${bajarildi ? 'BAJARILDI' : 'BAJARILMADI'})`);
      }
      batafsil_tahlil.qoshimcha_mezonlar_natija = qoshimchaNatijaFinal;
      batafsil_tahlil.qoshimcha_delta_ball = qoshimchaDeltaBall;
    }

    // ── YAKUNIY BALL ──
    let finalBall = standartBall + qoshimchaDeltaBall;
    finalBall = Math.max(1, finalBall);
    console.log(`Standart: ${standartBall}, Delta: ${qoshimchaDeltaBall > 0 ? '+' : ''}${qoshimchaDeltaBall}, FINAL: ${finalBall}`);

    return {
      kazus_index: oquvchiJavob.kazus_index,
      ball: finalBall,
      izoh: parsed.izoh || 'Javob baholandi.',
      batafsil_tahlil,
    };

  } catch (err: any) {
    console.error('AI baholash xatosi:', err);
    return fallbackNatija(oquvchiJavob.kazus_index, 'Baholashda xatolik yuz berdi.');
  }
}
