// Telegram Mini App: faqat NaSher AI, to'liq ekranda (sayt menyulari va boshqa bo'limlarsiz).
// Foydalanuvchi Telegram initData orqali aniqlanadi (nasher-bot miniapp_auth imzoni tekshiradi).
import { useEffect, useState } from 'react';
import NexusAI from '@/components/features/NexusAI';
import ToolsPage from '@/components/features/nexus/tools/ToolsPage';
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
  close?: () => void;
  isFullscreen?: boolean;
  onEvent?: (e: string, cb: () => void) => void;
  offEvent?: (e: string, cb: () => void) => void;
}

function webApp(): TgWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

export default function NasherMiniApp() {
  const [userId, setUserId] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [needRegister, setNeedRegister] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const initialChatId = new URLSearchParams(window.location.search).get('chat') || undefined;
  // ?tool=menu|aliment|boj|shablon|sud — vositalar sahifasi (bot tugmalari shu bilan ochadi); bo'sh — chat
  const [tool, setTool] = useState(new URLSearchParams(window.location.search).get('tool') || '');

  useEffect(() => {
    document.title = 'NaSher AI';
    const wa = webApp();
    if (!wa?.initData) {
      setXato("Bu sahifa Telegram ichida, NaSher AI boti orqali ochiladi.");
      return;
    }
    wa.ready();
    wa.expand();
    const syncFull = () => setFullscreen(!!webApp()?.isFullscreen);
    wa.onEvent?.('fullscreenChanged', syncFull);
    try {
      if (wa.isVersionAtLeast?.('8.0')) wa.requestFullscreen?.();
      wa.disableVerticalSwipes?.();   // chat oynasini pastga tortganda Mini App yopilib ketmasin
      wa.setHeaderColor?.('#ffffff');
      wa.setBackgroundColor?.('#ffffff');
      syncFull();
    } catch (e) {
      console.warn('[NasherMiniApp] Telegram sozlamasi:', e);
    }
    supabase.functions.invoke('nasher-bot', { body: { action: 'miniapp_auth', init_data: wa.initData } })
      .then(({ data, error }) => {
        if (data?.need_register) { setNeedRegister(true); return; }
        if (error || !data?.user_id) throw new Error(error?.message || data?.error || 'Kirish tasdiqlanmadi');
        setUserId(data.user_id);
      })
      .catch((e) => {
        console.error('[NasherMiniApp] kirish xatosi:', e);
        setXato("Kirishda xatolik. Mini App'ni yopib, qayta oching.");
      });
    return () => wa.offEvent?.('fullscreenChanged', syncFull);
  }, []);

  if (needRegister) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontSize: 44 }}>📱</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '12px 0 8px', color: '#1f1e1d' }}>Avval botda ro'yxatdan o'ting</h2>
          <p style={{ color: '#555', lineHeight: 1.5, marginBottom: 20 }}>
            Botga qaytib, <b>/start</b> ni bosing — FanFaster akkauntingiz avtomatik ochiladi.
          </p>
          <button
            onClick={() => webApp()?.close?.()}
            style={{ background: '#2563EB', color: '#fff', border: 0, borderRadius: 12, padding: '12px 20px', fontSize: 15, fontWeight: 600, width: '100%' }}
          >Botga qaytish</button>
        </div>
      </div>
    );
  }
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
    // To'liq ekranda sarlavha Telegram tugmalari ("Yopish" / "⌄ …") qatoriga joylashadi — ikki qavat bo'sh joy bo'lmaydi
    <main
      className={fullscreen ? 'nasher-tg-full' : undefined}
      style={{
        height: '100dvh',
        overflow: 'hidden',
        paddingTop: fullscreen
          ? 'var(--tg-safe-area-inset-top, 0px)'
          : 'calc(var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px))',
        paddingBottom: 'var(--tg-safe-area-inset-bottom, 0px)',
        background: '#fff',
      }}
    >
      {tool
        ? <div style={{ height: '100%', overflowY: 'auto' }}><ToolsPage tool={tool} onChange={setTool} onChat={() => setTool('')} /></div>
        : <NexusAI userId={userId} initialChatId={initialChatId} />}
    </main>
  );
}
