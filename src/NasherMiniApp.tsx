// Telegram Mini App: faqat NaSher AI, to'liq ekranda (sayt menyulari va boshqa bo'limlarsiz).
// Foydalanuvchi Telegram initData orqali aniqlanadi (nasher-bot miniapp_auth imzoni tekshiradi).
import { useEffect, useState } from 'react';
import NexusAI from '@/components/features/NexusAI';
import { supabase } from '@/lib/supabase';

interface TgWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  isVersionAtLeast?: (v: string) => boolean;
}

function webApp(): TgWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

export default function NasherMiniApp() {
  const [userId, setUserId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'NaSher AI';
    const wa = webApp();
    if (!wa?.initData) {
      setXato("Bu sahifa Telegram ichida, NaSher AI boti orqali ochiladi.");
      return;
    }
    wa.ready();
    wa.expand();
    try {
      if (wa.isVersionAtLeast?.('8.0')) wa.requestFullscreen?.();
      wa.disableVerticalSwipes?.();   // chat oynasini pastga tortganda Mini App yopilib ketmasin
      wa.setHeaderColor?.('#ffffff');
      wa.setBackgroundColor?.('#ffffff');
    } catch (e) {
      console.warn('[NasherMiniApp] Telegram sozlamasi:', e);
    }
    supabase.functions.invoke('nasher-bot', { body: { action: 'miniapp_auth', init_data: wa.initData } })
      .then(({ data, error }) => {
        if (error || !data?.user_id) throw new Error(error?.message || data?.error || 'Kirish tasdiqlanmadi');
        setUserId(data.user_id);
      })
      .catch((e) => {
        console.error('[NasherMiniApp] kirish xatosi:', e);
        setXato("Kirishda xatolik. Mini App'ni yopib, qayta oching.");
      });
  }, []);

  if (xato) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <p style={{ maxWidth: 320, color: '#444', lineHeight: 1.5 }}>{xato}</p>
      </div>
    );
  }
  if (!userId) {
    return <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: '#888', fontFamily: 'Inter, system-ui, sans-serif' }}>NaSher AI yuklanmoqda…</div>;
  }
  return (
    // To'liq ekranda Telegram tugmalari ustiga chiqmasligi uchun xavfsiz hudud (Telegram CSS o'zgaruvchilari)
    <main
      style={{
        height: '100dvh',
        overflow: 'hidden',
        paddingTop: 'calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px))',
        paddingBottom: 'var(--tg-safe-area-inset-bottom, 0px)',
        background: '#fff',
      }}
    >
      <NexusAI userId={userId} />
    </main>
  );
}
