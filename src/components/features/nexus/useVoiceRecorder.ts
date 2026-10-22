// Mikrofon: ovozni yozib (ko'pi bilan 2 daqiqa — keyin o'zi to'xtaydi), nasher-transcribe orqali matnga aylantiradi.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export const VOICE_MAX_SEC = 120;

type VoiceState = { phase: 'idle' } | { phase: 'recording'; sec: number } | { phase: 'transcribing' };

// Safari/iOS (Telegram ham) webm yozmaydi — mp4 ga tushadi
const pickMime = () =>
  ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) ?? '';

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** onText — tayyor matn (chaqiruvchi savolni yuboradi), onError — foydalanuvchiga ko'rsatiladigan xabar. */
export function useVoiceRecorder(userId: string, onText: (text: string) => void, onError: (msg: string) => void) {
  const [state, setState] = useState<VoiceState>({ phase: 'idle' });
  const recRef = useRef<MediaRecorder | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const transcribe = useCallback(async (blob: Blob) => {
    setState({ phase: 'transcribing' });
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/nasher-transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ ustoz_id: userId, audio: await toBase64(blob), mime: blob.type || 'audio/webm' }),
        signal: AbortSignal.timeout(100_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.text) throw new Error(data?.error || `Ovoz o'qilmadi (${res.status})`);
      onText(String(data.text));
    } catch (e) {
      console.error('[useVoiceRecorder] matnga aylantirish:', e);
      onError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : "Ovozni o'qib bo'lmadi. Savolingizni yozib yuboring.");
    } finally {
      setState({ phase: 'idle' });
    }
  }, [userId, onText, onError]);

  const stop = useCallback((cancel = false) => {
    cancelledRef.current = cancel;
    clearTimer();
    if (recRef.current?.state === 'recording') recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!supported || recRef.current?.state === 'recording') return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error('[useVoiceRecorder] mikrofon:', e);
      onError("Mikrofonga ruxsat berilmadi. Brauzer/Telegram sozlamalarida mikrofonni yoqing yoki savolni yozib yuboring.");
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      recRef.current = null;
      if (cancelledRef.current || !chunks.length) { setState({ phase: 'idle' }); return; }
      transcribe(new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] }));
    };
    cancelledRef.current = false;
    recRef.current = rec;
    rec.start(1000);
    const t0 = Date.now();
    setState({ phase: 'recording', sec: 0 });
    timerRef.current = window.setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      if (sec >= VOICE_MAX_SEC) stop();   // 2 daqiqa — o'zi to'xtab, yuboriladi
      else setState({ phase: 'recording', sec });
    }, 250);
  }, [supported, transcribe, stop, onError]);

  // komponent yopilsa — yozuv bekor, mikrofon o'chadi
  useEffect(() => () => stop(true), [stop]);

  return { state, supported, start, stop };
}
