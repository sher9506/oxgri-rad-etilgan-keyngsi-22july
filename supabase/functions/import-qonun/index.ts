import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ─── NORMALIZATSIYA ────────────────────────────────────────────────────────────
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ʻʼ'’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeModdaRaqam(raqam: string): string {
  return raqam
    .replace(/\s+/g, '')
    .replace(/[ʻʼ'’‘`]/g, "'")
    .toLowerCase();
}

// ─── HTML'DAN MODDALARNI AJRATISH ─────────────────────────────────────────────
interface ParsedModda {
  modda_raqami: string;
  sarlavha: string;
  bob_nomi: string;
  matn: string;
  sud_amaliyoti: string;
  lex_element_id: string;
}

interface ParseResult {
  moddalar: ParsedModda[];
  qonun_nomi: string;
  oxirgi_tahrir_sanasi: string | null;
  gaps: number[];
  superscript_moddalar: { raqam: string; sarlavha: string }[];
}

// TOC'dan bob nomi va modda element ID'sini ajratib olish
interface TocEntry {
  target: string;
  text: string;
  isModda: boolean;
  isBob: boolean;
  moddaNum: string | null;
  bobName: string | null;
}

function parseToc(html: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const regex = /scrollText\(["']([^"']+)["']\).*?>([^<]*)</g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const target = match[1];
    const text = match[2].trim();
    if (!text) continue;

    const moddaMatch = text.match(/^(\d+)(?:<sup>(\d+)<\/sup>)?-modda\.\s*(.*)/);
    const bobMatch = text.match(/^([IVX]+)\s*bob\.\s*(.*)/i);

    if (moddaMatch) {
      const num = moddaMatch[2] ? `${moddaMatch[1]}-${moddaMatch[2]}` : moddaMatch[1];
      entries.push({ target, text, isModda: true, isBob: false, moddaNum: num, bobName: null });
    } else if (bobMatch) {
      entries.push({ target, text, isModda: false, isBob: true, moddaNum: null, bobName: text });
    } else {
      entries.push({ target, text, isModda: false, isBob: false, moddaNum: null, bobName: null });
    }
  }
  return entries;
}

// Modda sarlavhasini HTML'dan ajratib olish (superskript bilan)
function extractModdaTitle(divHtml: string): { num: string; title: string } | null {
  // Pattern: >N-modda. Title<  yoki  >N<sup>S</sup>-modda. Title<
  const simpleMatch = divHtml.match(/>(\d+)-modda\.\s*([^<]*)</);
  if (simpleMatch) {
    return { num: simpleMatch[1], title: simpleMatch[2].trim() };
  }
  // Superscript variant
  const supMatch = divHtml.match(/>(\d+)<sup[^>]*>(\d+)<\/sup>-modda\.\s*([^<]*)</);
  if (supMatch) {
    return { num: `${supMatch[1]}-${supMatch[2]}`, title: supMatch[3].trim() };
  }
  return null;
}

// HTML elementidan toza matn olish
function stripHtml(html: string): string {
  return html
    .replace(/<a[^>]*href=["']\/uz\/docs\/[^"']*["'][^>]*>(.*?)<\/a>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Sud amaliyoti (LexUZ sharhi) ni ajratish
function extractSudAmaliyoti(commentHtml: string): string {
  // COMMENTLEXUZ div ichidagi "Qarang:" qismlari
  const qarangMatch = commentHtml.match(/Qarang:\s*([^<]*(?:<a[^>]*>[^<]*<\/a>[^<]*)*)/);
  if (qarangMatch) {
    const clean = stripHtml(qarangMatch[0]);
    return clean;
  }
  // Butun comment ichidagi matn
  const clean = stripHtml(commentHtml);
  if (clean.length > 5) return clean;
  return '';
}

// "O'z kuchini yo'qotgan" tekshiruvi
function isExpired(text: string): boolean {
  return /o[''']z\s*kuchini\s*yo[''']qotgan/i.test(text);
}

// Keraksiz elementlarni tozalash
function shouldRemoveElement(text: string): boolean {
  return /Hujjatga taklif yuborish|Audioni tinglash|Hujjat elementidan havola olish|Oldingi tahrirga qarang|SPiT:/.test(text);
}

function parseLexUzHtml(html: string): ParseResult {
  const moddalar: ParsedModda[] = [];
  const gaps: number[] = [];
  const superscript_moddalar: { raqam: string; sarlavha: string }[] = [];

  // Qonun nomini title'dan olish
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  let qonunNomi = '';
  if (titleMatch) {
    qonunNomi = stripHtml(titleMatch[1]).replace(/^\s*\d{2}\.\d{2}\.\d{4}\.\s*/, '').trim();
  }

  // Oxirgi tahrir sanasi - eng katta sanani topish va ISO formatga keltirish
  const dateMatches = html.match(/(\d{2})\.(\d{2})\.(\d{4})/g);
  let oxirgiTahrir: string | null = null;
  if (dateMatches && dateMatches.length > 0) {
    const isoDates = dateMatches.map(d => {
      const [dd, mm, yyyy] = d.split('.');
      return `${yyyy}-${mm}-${dd}`;
    }).sort().reverse();
    oxirgiTahrir = isoDates[0];
  }

  // TOC'dan bob nomlari va modda lex ID'larini olish
  const toc = parseToc(html);

  // Bob nomini modda raqamiga moslash uchun map
  const moddaBobMap: Record<string, string> = {};
  let currentBob = '';
  for (const entry of toc) {
    if (entry.isBob) {
      currentBob = entry.bobName || '';
    } else if (entry.isModda && entry.moddaNum) {
      moddaBobMap[entry.moddaNum] = currentBob;
    }
  }

  // Content area: divCont ichidagi elementlar
  const divContStart = html.indexOf('id="divCont"');
  if (divContStart < 0) {
    return { moddalar: [], qonun_nomi: qonunNomi, oxirgi_tahrir_sanasi: oxirgiTahrir, gaps, superscript_moddalar };
  }

  const contentHtml = html.substring(divContStart);

  // CLAUSE_DEFAULT va ACT_TITLE class'li divlardan modda sarlavhalarini topish
  // Pattern: class="...CLAUSE_DEFAULT lx_elem"...>...id="LEX_ID">N-modda. Title</div>
  // Yoki: class="...ACT_TITLE lx_elem"...>...id="LEX_ID">N-modda. Title</div>

  // Barcha modda sarlavha elementlarini topish
  // Regex: class="...lx_elem"...> ichida id="(-\d+)"> raqam-modda. sarlavha
  const titleRegex = /class="[^"]*(?:CLAUSE_DEFAULT|ACT_TITLE)[^"]*lx_elem[^"]*"[^>]*>.*?id="(-?\d+)"[^>]*>(\d+)(?:<sup[^>]*>(\d+)<\/sup>)?-modda\.\s*([^<]*)<\/div>/gs;

  const titleMatches: { lexId: string; num: string; sup: string | undefined; title: string; fullMatch: string; index: number }[] = [];
  let tm;
  while ((tm = titleRegex.exec(contentHtml)) !== null) {
    const lexId = tm[1];
    const num = tm[2];
    const sup = tm[3];
    const title = tm[4].trim();
    const fullMatch = tm[0];
    const index = tm.index;
    titleMatches.push({ lexId, num, sup, title, fullMatch, index });
  }

  // Har bir modda sarlavhasidan keyingi ACT_TEXT elementlari = modda matni
  // COMMENT elementlari = sud amaliyoti
  for (let i = 0; i < titleMatches.length; i++) {
    const tm = titleMatches[i];
    const moddaRaqam = tm.sup ? `${tm.num}-${tm.sup}` : tm.num;

    // Superscript moddalarni qayd qilish
    if (tm.sup) {
      superscript_moddalar.push({ raqam: moddaRaqam, sarlavha: tm.title });
    }

    // Bu moddaning matni: keyingi modda sarlavhasigacha bo'lgan ACT_TEXT elementlari
    const nextIndex = i + 1 < titleMatches.length ? titleMatches[i + 1].index : contentHtml.length;
    const sectionHtml = contentHtml.substring(tm.index + tm.fullMatch.length, nextIndex);

    // ACT_TEXT divlarini ajratib olish
    const textRegex = /class="[^"]*ACT_TEXT[^"]*lx_elem[^"]*"[^>]*>.*?id="(-?\d+)"[^>]*>([\s\S]*?)<\/div><\/div>/g;
    const textParts: string[] = [];
    let textMatch;
    while ((textMatch = textRegex.exec(sectionHtml)) !== null) {
      const rawText = textMatch[2];
      // "O'z kuchini yo'qotgan" matnlarni o'tkazib yuborish
      if (isExpired(rawText)) continue;
      // Keraksiz elementlarni o'tkazib yuborish
      if (shouldRemoveElement(rawText)) continue;
      const clean = stripHtml(rawText);
      if (clean.length > 0) textParts.push(clean);
    }

    // COMMENT divlardan sud amaliyotini olish
    const commentRegex = /class="[^"]*COMMENT[^"]*"[^>]*>([\s\S]*?)<\/div>(?=<div class="[^"]*(?:ACT_TEXT|CLAUSE|COMMENT|TEXT_HEADER))/g;
    const sudParts: string[] = [];
    let commentMatch;
    while ((commentMatch = commentRegex.exec(sectionHtml)) !== null) {
      const commentContent = commentMatch[1];
      // LexUZ sharhi ichidagi "Qarang:" qismlari
      if (commentContent.includes('COMMENTLEXUZ')) {
        const sud = extractSudAmaliyoti(commentContent);
        if (sud) sudParts.push(sud);
      }
    }

    const matn = textParts.join(' ');
    const sudAmaliyoti = sudParts.join('\n');

    // Modda matni bo'sh bo'lsa (masalan 113 bekor qilingan) - o'tkazib yuborish
    if (matn.length === 0) {
      gaps.push(parseInt(tm.num));
      continue;
    }

    moddalar.push({
      modda_raqami: moddaRaqam,
      sarlavha: tm.title,
      bob_nomi: moddaBobMap[moddaRaqam] || moddaBobMap[tm.num] || '',
      matn,
      sud_amaliyoti: sudAmaliyoti,
      lex_element_id: tm.lexId,
    });
  }

  // Modda raqamlaridagi teshiklarni topish
  const allNums = moddalar.map(m => parseInt(m.modda_raqami.split('-')[0])).sort((a, b) => a - b);
  for (let i = 1; i < allNums.length; i++) {
    if (allNums[i] - allNums[i - 1] > 1) {
      for (let g = allNums[i - 1] + 1; g < allNums[i]; g++) {
        gaps.push(g);
      }
    }
  }

  return { moddalar, qonun_nomi: qonunNomi, oxirgi_tahrir_sanasi: oxirgiTahrir, gaps, superscript_moddalar };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  let lastError = '';
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`fetch failed: ${lastError}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, link, kod, nom } = await req.json() as {
      action: 'import' | 'update';
      link?: string;
      kod?: string;
      nom?: string;
    };

    if (!link) {
      return new Response(JSON.stringify({ error: 'link majburiy' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // doc_id ni linkdan ajratish
    const docIdMatch = link.match(/\/docs\/(-?\d+)/);
    const docId = docIdMatch ? docIdMatch[1] : '';
    if (!docId) {
      return new Response(JSON.stringify({ error: 'linkdan doc ID topilmadi' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Qonun kodini aniqlash
    let qonunKod = kod || '';
    if (!qonunKod) {
      // Linkdan avtomatik aniqlash (masalan -111453 = JK)
      const { data: existing } = await supabaseAdmin
        .from('qonunlar')
        .select('kod')
        .eq('doc_id', docId)
        .maybeSingle();
      qonunKod = existing?.kod || `DOC${docId}`;
    }

    console.log(`[import-qonun] Boshlandi: link=${link} kod=${qonunKod} docId=${docId}`);

    // Sahifani olish
    const html = await fetchWithRetry(link);
    console.log(`[import-qonun] HTML olindi: ${html.length} bytes`);

    // Parslash
    const result = parseLexUzHtml(html);
    console.log(`[import-qonun] Topildi: ${result.moddalar.length} ta modda, ${result.gaps.length} ta teshik, ${result.superscript_moddalar.length} ta superskript`);

    if (result.moddalar.length === 0) {
      const hint = result.qonun_nomi ? `Sahifa sarlavhasi: "${result.qonun_nomi}". ` : '';
      return new Response(JSON.stringify({
        error: `0 ta modda topildi. ${hint}Link to'g'ri ekanligini tekshiring — bu sahifa qonun kodeksi emas, balki alohida hujjat bo'lishi mumkin.`,
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Qonun nomini aniqlash
    const qonunNom = nom || result.qonun_nomi || qonunKod;

    // Avval eski moddalarni o'chirish (yangilash uchun)
    await supabaseAdmin.from('qonun_moddalari_v2').delete().eq('qonun_kodi', qonunKod);

    // Qonun yozuvi
    const { data: qonunRow, error: qonunErr } = await supabaseAdmin
      .from('qonunlar')
      .upsert({
        kod: qonunKod,
        nom: qonunNom,
        link,
        doc_id: docId,
        oxirgi_tahrir_sanasi: result.oxirgi_tahrir_sanasi || null,
        modda_soni: result.moddalar.length,
        olingan_sana: new Date().toISOString(),
      }, { onConflict: 'kod' })
      .select()
      .single();

    if (qonunErr) {
      console.error('[import-qonun] qonunlar yozish xato:', qonunErr);
      return new Response(JSON.stringify({ error: 'qonun saqlashda xato' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Moddalarni batch saqlash
    const batchSize = 50;
    let savedCount = 0;
    for (let i = 0; i < result.moddalar.length; i += batchSize) {
      const batch = result.moddalar.slice(i, i + batchSize).map(m => ({
        qonun_kodi: qonunKod,
        modda_raqami: m.modda_raqami,
        sarlavha: m.sarlavha,
        bob_nomi: m.bob_nomi,
        matn: m.matn,
        sud_amaliyoti: m.sud_amaliyoti || null,
        sarlavha_normal: normalizeText(m.sarlavha),
        matn_normal: normalizeText(m.matn),
        lex_element_id: m.lex_element_id || null,
      }));

      const { error: batchErr } = await supabaseAdmin
        .from('qonun_moddalari_v2')
        .insert(batch);

      if (batchErr) {
        console.error(`[import-qonun] batch ${i} xato:`, batchErr);
      } else {
        savedCount += batch.length;
      }
    }

    console.log(`[import-qonun] Saqlandi: ${savedCount}/${result.moddalar.length} ta modda`);

    // Natijani qaytarish
    const first3 = result.moddalar.slice(0, 3).map(m => ({
      raqam: m.modda_raqami,
      sarlavha: m.sarlavha.slice(0, 60),
      bob: m.bob_nomi?.slice(0, 50) || '',
      matn_uzunligi: m.matn.length,
      lex_id: m.lex_element_id,
    }));

    const last3 = result.moddalar.slice(-3).map(m => ({
      raqam: m.modda_raqami,
      sarlavha: m.sarlavha.slice(0, 60),
      bob: m.bob_nomi?.slice(0, 50) || '',
      matn_uzunligi: m.matn.length,
      lex_id: m.lex_element_id,
    }));

    return new Response(JSON.stringify({
      success: true,
      qonun: {
        kod: qonunKod,
        nom: qonunNom,
        doc_id: docId,
        oxirgi_tahrir: result.oxirgi_tahrir_sanasi,
      },
      modda_soni: result.moddalar.length,
      saved_count: savedCount,
      gaps: result.gaps,
      superscript_moddalar: result.superscript_moddalar,
      first_3: first3,
      last_3: last3,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[import-qonun] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg.slice(0, 300) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
