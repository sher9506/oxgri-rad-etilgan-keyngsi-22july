import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Tiklash tartibi — avval ota-jadvallar, keyin bolalar-jadvallar
const TARTIB = [
  'settings', 'yangiliklar',
  'ustoz', 'talabalar',
  'testlar', 'test_javoblar', 'test_sessiyalar',
  'toplamlar', 'javoblar',
  'om_bolimlar', 'om_boblar', 'om_materiallar', 'om_korishlar', 'om_chunks', 'ai_cache',
  'sj_bolimlar', 'sj_boblar', 'sj_savollar', 'sj_natijalar',
  'premium_bolimlar', 'premium_boblar', 'premium_kontent',
  'xp_tarix',
  'chatlar', 'chat_azolar', 'chat_habarlar',
  'payments',
  'bildirishnomalar', 'fraud_urinishlar', 'profil_tahrirlashlar',
  'auto_start_signals', 'chaqiruvlar',
  'yordam_xabarlar',
  'blog_posts',
];

const CONFLICT_COLS: Record<string, string> = {
  settings: 'key',
};

interface TableResult {
  jadval: string;
  backup_soni: number;
  tiklandi: number;
  xato: number;
  xato_xabar: string;
  holat: 'ok' | 'partial' | 'error' | 'empty' | 'no_table' | 'no_match';
  ogohlantirishlar: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const diag: string[] = [];

  // 1. Service role key tekshiruvi
  const hasKey = SERVICE_ROLE_KEY.length > 10;
  diag.push(`service role key: ${hasKey ? 'ha (uzunlik=' + SERVICE_ROLE_KEY.length + ')' : 'YO\'Q — kritik xato!'}`);
  diag.push(`supabase url: ${SUPABASE_URL ? 'ha' : 'YO\'Q'}`);
  console.log(`[restore-backup] service_role_key=${hasKey}, url=${!!SUPABASE_URL}`);

  if (!hasKey) {
    return new Response(
      JSON.stringify({
        muvaffaqiyat: false,
        xabar: 'SERVICE ROLE KEY topilmadi — edge function to\'g\'ri ishlamayapti',
        tafsilotlar: diag,
        natijalar: [],
        statistika: {},
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const db = body?.database;
    if (!db || typeof db !== 'object') {
      return new Response(
        JSON.stringify({
          muvaffaqiyat: false,
          xabar: "Noto'g'ri zahira fayl formati — 'database' maydoni topilmadi",
          tafsilotlar: diag,
          natijalar: [],
          statistika: {},
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Backup kalitlarini haqiqiy jadval nomlari bilan solishtirish
    const backupKeys = Object.keys(db);
    const knownTables = new Set(TARTIB);
    for (const key of backupKeys) {
      if (!knownTables.has(key)) {
        diag.push(`⚠️ Backup kaliti '${key}' hech qanday jadvalga mos kelmadi`);
      }
    }

    // 3. Barcha jadvallar ro'yxati — avval TARTIBdagilar, keyin qolganlari
    const barchaJadvallar = [
      ...TARTIB.filter(k => db[k] !== undefined),
      ...backupKeys.filter(k => !TARTIB.includes(k)),
    ];

    const natijalar: TableResult[] = [];
    const statistika: Record<string, number> = {};
    let hammasiOk = true;

    for (const tableName of barchaJadvallar) {
      const rows = db[tableName];
      const backupSoni = Array.isArray(rows) ? rows.length : 0;

      // ALOHIDA try/catch — bitta jadvalda xato bo'lsa, qolganlari davom etadi
      try {
        if (!Array.isArray(rows) || rows.length === 0) {
          natijalar.push({
            jadval: tableName, backup_soni: 0, tiklandi: 0, xato: 0,
            xato_xabar: '', holat: 'empty', ogohlantirishlar: [],
          });
          statistika[tableName] = 0;
          continue;
        }

        // 4. Jadvalning haqiqiy ustunlarini olish
        const { data: colsData, error: colsErr } = await supabaseAdmin
          .rpc('get_table_columns', { table_name_param: tableName });

        let validColumns: Set<string> | null = null;

        if (!colsErr && colsData && Array.isArray(colsData) && colsData.length > 0) {
          validColumns = new Set(colsData.map((r: any) => r.column_name));
        } else if (colsErr) {
          // RPC yo'q yoki xato — probe orqali ustunlarni aniqlash
          const { data: probeRow, error: probeErr } = await supabaseAdmin
            .from(tableName)
            .select('*')
            .limit(1);

          if (probeErr) {
            natijalar.push({
              jadval: tableName, backup_soni: backupSoni, tiklandi: 0, xato: backupSoni,
              xato_xabar: `Jadval ustunlarini o'qib bo'lmadi: ${probeErr.message}`,
              holat: 'no_table', ogohlantirishlar: [],
            });
            statistika[tableName] = 0;
            hammasiOk = false;
            continue;
          }

          if (probeRow && probeRow.length > 0) {
            validColumns = new Set(Object.keys(probeRow[0]));
          }
          // Bo'sh jadval bo'lsa validColumns = null — barcha ustunlar qabul qilinadi
        }

        // 5. Har bir qatorni filtrlash — faqat jadvalda mavjud ustunlar
        const ogohlantirishlar: string[] = [];
        const cleanedRows = rows.map((row: any) => {
          if (!validColumns) return row;
          const filtered: Record<string, any> = {};
          for (const [key, value] of Object.entries(row)) {
            if (validColumns.has(key)) {
              filtered[key] = value;
            }
          }
          // Olib tashlangan ustunlarni log qilish
          const removed = Object.keys(row).filter(k => !validColumns.has(k));
          if (removed.length > 0 && ogohlantirishlar.length < 3) {
            ogohlantirishlar.push(`Olib tashlandi: ${removed.join(', ')}`);
          }
          return filtered;
        });

        // 6. Batch upsert — service role bilan
        const BATCH = 100;
        const conflictCol = CONFLICT_COLS[tableName] || 'id';
        let ok = 0;
        let err = 0;
        const errMsgs: string[] = [];

        for (let i = 0; i < cleanedRows.length; i += BATCH) {
          const batch = cleanedRows.slice(i, i + BATCH);
          try {
            const { error: upsertErr } = await supabaseAdmin
              .from(tableName)
              .upsert(batch, { onConflict: conflictCol, ignoreDuplicates: false });

            if (upsertErr) {
              err += batch.length;
              if (errMsgs.length < 5) errMsgs.push(upsertErr.message);
              console.error(`[restore-backup] ${tableName} batch ${i}:`, upsertErr.message);
            } else {
              ok += batch.length;
            }
          } catch (batchErr: any) {
            err += batch.length;
            if (errMsgs.length < 5) errMsgs.push(batchErr.message || String(batchErr));
            console.error(`[restore-backup] ${tableName} batch ${i} exception:`, batchErr);
          }
        }

        let holat: TableResult['holat'] = 'ok';
        if (err > 0 && ok === 0) holat = 'error';
        else if (err > 0 && ok > 0) holat = 'partial';

        if (holat !== 'ok') hammasiOk = false;

        natijalar.push({
          jadval: tableName,
          backup_soni: backupSoni,
          tiklandi: ok,
          xato: err,
          xato_xabar: errMsgs.join(' | ') || '',
          holat,
          ogohlantirishlar,
        });
        statistika[tableName] = ok;

      } catch (tableErr: any) {
        // ALOHIDA try/catch — bitta jadvalda xato bo'lsa, qolganlari davom etadi
        hammasiOk = false;
        natijalar.push({
          jadval: tableName,
          backup_soni: backupSoni,
          tiklandi: 0,
          xato: backupSoni,
          xato_xabar: tableErr.message || String(tableErr),
          holat: 'error',
          ogohlantirishlar: [],
        });
        statistika[tableName] = 0;
        console.error(`[restore-backup] ${tableName} jiddiy xato:`, tableErr);
      }
    }

    const jamiTiklandi = Object.values(statistika).reduce((s, v) => s + v, 0);
    const xatoJadvallar = natijalar.filter(r => r.holat === 'error' || r.holat === 'partial').length;

    const xabar = hammasiOk
      ? `Baza muvaffaqiyatli tiklandi! Jami ${jamiTiklandi} ta yozuv.`
      : `Qisman tiklandi: ${jamiTiklandi} ta yozuv tiklandi, ${xatoJadvallar} ta jadvalda xatolar bor.`;

    diag.push(`Jami jadvallar: ${barchaJadvallar.length}`);
    diag.push(`Jami yozuvlar tiklandi: ${jamiTiklandi}`);
    diag.push(`Xato jadvallar: ${xatoJadvallar}`);

    return new Response(
      JSON.stringify({
        muvaffaqiyat: hammasiOk,
        xabar,
        tafsilotlar: diag,
        natijalar,
        statistika,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[restore-backup] tashqi xato:', err);
    return new Response(
      JSON.stringify({
        muvaffaqiyat: false,
        xabar: err.message || 'Tiklashda noma\'lum xatolik',
        tafsilotlar: [...diag, `❌ ${err.message || 'xato'}`],
        natijalar: [],
        statistika: {},
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
