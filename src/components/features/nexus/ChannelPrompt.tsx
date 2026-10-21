import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { QuotaInfo } from '@/hooks/useNexusAiChat';

const BOT_URL = 'https://t.me/NaSheraibot';

/** Mini App ichida Telegram havolasi Telegram'ning o'zida ochiladi, saytda — yangi oynada. */
function openTelegram(url: string) {
  const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void; initData?: string } } }).Telegram?.WebApp;
  if (tg?.initData && tg.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/** Javob olingandan keyin kuniga bir marta: kanalga qo'shilish taklifi (+bonus savol). A'zolarga chiqmaydi. */
export default function ChannelPrompt({ quota, answered, onCheck }: {
  quota: QuotaInfo | null;
  answered: boolean;          // shu sessiyada yangi javob keldi
  onCheck: () => void;        // limitni qayta so'rash (server a'zolikni qayta tekshiradi)
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!answered || !quota?.channel || quota.channel_member === true || quota.is_unlimited) return;
    const key = `nasher_channel_prompt_${new Date().toISOString().slice(0, 10)}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch { /* xotira yopiq (maxfiy oyna) — baribir bir marta ko'rsatamiz */ }
    setOpen(true);
  }, [answered, quota]);

  if (!quota?.channel) return null;
  const channelUrl = `https://t.me/${quota.channel.replace(/^@/, '')}`;
  const bonus = quota.channel_bonus ?? 2;
  const joined = quota.channel_member === true;
  const linked = quota.channel_member !== null && quota.channel_member !== undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{joined ? 'Rahmat! 🎉' : '📢 Kanalimizga qo\'shiling'}</DialogTitle>
          <DialogDescription>
            {joined
              ? `Bonus qo'shildi: endi har 5 soatda ${quota.limit} ta savol berasiz.`
              : `${quota.channel} kanaliga qo'shiling — har 5 soatda +${bonus} ta qo'shimcha savol olasiz.`}
            {!joined && !linked && ' Bonusni olish uchun @NaSheraibot ga kiring va saytdagi telefon raqamingizni ulashing — akkauntingiz Telegram bilan bog\'lanadi.'}
            {!joined && checked && linked && ' Hali a\'zolik topilmadi — qo\'shilganingizdan keyin qayta tekshiring.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {joined ? (
            <Button onClick={() => setOpen(false)}>Yopish</Button>
          ) : (
            <>
              <Button onClick={() => openTelegram(channelUrl)}>Kanalga qo'shilish</Button>
              {linked
                ? <Button variant="outline" onClick={() => { setChecked(true); onCheck(); }}>Qo'shildim — tekshirish</Button>
                : <Button variant="outline" onClick={() => openTelegram(BOT_URL)}>Botni ochish</Button>}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
