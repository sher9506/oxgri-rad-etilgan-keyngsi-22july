// Mikrofon: ovozni yozib (ko'pi bilan 2 daqiqa — keyin o'zi to'xtaydi), nasher-transcribe orqali matnga aylantiradi.
// Har yozuv o'z "avlod" raqamiga ega: bekor qilingan, sahifa yopilgan yoki suhbat almashgan yozuvning natijasi hech qayerga yuborilmaydi.
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
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const genRef = useRef(0);            // joriy yozuv raqami; bekor qilinsa oshadi — eski natija e'tiborsiz qoladi
  // eng so'nggi qayta chaqiruvlar: yozuv tugaganda joriy suhbat/rejim ishlatiladi (eski qiymat emas)
  const onTextRef = useRef(onText);
  const onErrorRef = useRef(onError);
  onTextRef.current = onText;
  onErrorRef.current = onError;
  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  const releaseMic = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };

  const transcribe = useCallback(async (blob: Blob, gen: number) => {
    setState({ phase: 'transcribing' });
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/nasher-transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ ustoz_id: userId, audio: await toBase64(blob), mime: blob.type || 'audio/webm' }),
        signal: AbortSignal.timeout(100_000),
      });
      const data = await res.json().catch(() => ({}));
      if (gen !== genRef.current) return;   // bekor qilingan / sahifa yopilgan / suhbat almashgan
      if (!res.ok || !data?.text) throw new Error(data?.error || `Ovoz o'qilmadi (${res.status})`);
      onTextRef.current(String(data.text));
    } catch (e) {
      if (gen !== genRef.current) return;
      console.error('[useVoiceRecorder] matnga aylantirish:', e);
      onErrorRef.current(e instanceof Error && e.name !== 'TimeoutError' ? e.message : "Ovozni o'qib bo'lmadi. Savolingizni yozib yuboring.");
    } finally {
      if (gen === genRef.current) setState({ phase: 'idle' });
    }
  }, [userId]);

  /** Yozishni tugatib yuborish. */
  const stop = useCallback(() => {
    clearTimer();
    if (recRef.current?.state === 'recording') recRef.current.stop();
  }, []);

  /** Bekor qilish: yozuv, mikrofon ruxsati kutilishi yoki matnga aylantirish — natija yuborilmaydi. */
  const cancel = useCallback(() => {
    genRef.current++;
    clearTimer();
    if (recRef.current?.state === 'recording') recRef.current.stop();
    recRef.current = null;
    releaseMic();
    setState({ phase: 'idle' });
  }, []);

  const start = useCallback(async () => {
    if (!supported || recRef.current) return;
    const gen = ++genRef.current;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      if (gen !== genRef.current) return;
      console.error('[useVoiceRecorder] mikrofon:', e);
      onErrorRef.current("Mikrofonga ruxsat berilmadi. Brauzer/Telegram sozlamalarida mikrofonni yoqing yoki savolni yozib yuboring.");
      return;
    }
    // ruxsat kutilayotganda bekor qilingan yoki sahifa yopilgan — mikrofon darhol o'chadi, yozuv boshlanmaydi
    if (gen !== genRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
    streamRef.current = stream;
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    // yozuv qanday to'xtasa ham (tugma, 2 daqiqa, qo'ng'iroq, mikrofon uzilishi) — taymer va mikrofon to'xtaydi
    rec.onstop = () => {
      clearTimer();
      releaseMic();
      if (recRef.current === rec) recRef.current = null;
      if (gen !== genRef.current || !chunks.length) { if (gen === genRef.current) setState({ phase: 'idle' }); return; }
      transcribe(new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] }), gen);
    };
    recRef.current = rec;
    rec.start(1000);
    const t0 = Date.now();
    setState({ phase: 'recording', sec: 0 });
    timerRef.current = window.setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      if (sec >= VOICE_MAX_SEC) stop();   // 2 daqiqa — o'zi to'xtab, yuboriladi
      else setState({ phase: 'recording', sec });
    }, 250);
  }, [supported, transcribe, stop]);

  // sahifa/komponent yopilsa — har qanday holatda bekor (mikrofon o'chadi, hech narsa yuborilmaydi)
  useEffect(() => cancel, [cancel]);

  return { state, supported, start, stop, cancel };
}
