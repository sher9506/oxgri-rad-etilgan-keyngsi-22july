import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const talabaId = formData.get('talaba_id') as string;
    const file = formData.get('file') as File | null;

    if (!talabaId || !file) {
      return new Response(
        JSON.stringify({ error: 'Talaba ID va rasm majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MIME tekshirish
    if (!ALLOWED_MIME.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'Faqat JPEG, PNG yoki WebP formatlari qabul qilinadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hajm tekshirish
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Rasm hajmi 2 MB dan oshmasligi kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Talaba mavjudligini va birlashtirilgan holatini tekshirish
    const { data: talaba, error: talabaErr } = await supabaseAdmin
      .from('talabalar')
      .select('id, google_user_id, telegram_chat_id')
      .eq('id', talabaId)
      .maybeSingle();

    if (talabaErr || !talaba) {
      return new Response(
        JSON.stringify({ error: 'Talaba topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SERVERDA birlashtirish shartini tekshirish
    const birlashtirilgan = talaba.google_user_id !== null && talaba.telegram_chat_id !== null;
    if (!birlashtirilgan) {
      return new Response(
        JSON.stringify({ error: 'Rasm qo\'yish uchun Google va Telegramni ulang' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fayl nomini aniqlash
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
    const filePath = `${talabaId}/avatar.${ext}`;

    // Eski rasm fayllarini o'chirish
    const oldExts = ['jpg', 'png', 'webp'].filter(e => e !== ext);
    const oldPaths = oldExts.map(e => `${talabaId}/avatar.${e}`);
    await supabaseAdmin.storage.from('avatars').remove(oldPaths);

    // Yangi rasmni yuklash
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      console.error('[upload-avatar] storage xato:', uploadErr);
      return new Response(
        JSON.stringify({ error: 'Rasm saqlanmadi' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Public URL olish
    const { data: urlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    // talabalar.avatar_url ni yangilash
    const { error: updateErr } = await supabaseAdmin
      .from('talabalar')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', talabaId);

    if (updateErr) {
      console.error('[upload-avatar] db update xato:', updateErr);
      return new Response(
        JSON.stringify({ error: 'Profil yangilanmadi' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ avatarUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[upload-avatar] xato:', err);
    return new Response(
      JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
